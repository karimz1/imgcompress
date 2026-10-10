"""
Builds the ONNX files for AI upscaling from the official Real-ESRGAN weights.

Runs in its own Docker build stage (see the Dockerfile). Only the .onnx files and
their .sha256 files are copied into the runtime image; torch, onnx and the .pth
files never get there.

The .pth format is a Python pickle and can run code when it is loaded, so:

1. The weights come from the official Real-ESRGAN v0.2.5.0 GitHub release and
   their SHA-256 is checked against the value pinned below BEFORE anything opens
   them. A mismatch stops the build.
2. They are loaded with torch.load(weights_only=True), which refuses anything
   that isn't plain tensors and containers.
3. The network is rebuilt from the upstream definition (SRVGGNetCompact) with
   strict key matching and exported to ONNX, a plain graph-and-weights format
   that onnxruntime executes without running any Python.
4. The exported graph is checked: only standard ONNX operators from a short
   allowlist, no custom domains, no external data. Its output is compared with
   the PyTorch model on random input.

Local use (outside Docker):

    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install onnx onnxruntime numpy
    python scripts/build_upscale_model.py ~/.imgcompress/models
"""

import argparse
import hashlib
import os
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

RELEASE_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0"
WEIGHTS_URL = f"{RELEASE_URL}/realesr-general-x4v3.pth"
WEIGHTS_SHA256 = "8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292"
WEIGHTS_FILENAME = "realesr-general-x4v3.pth"

# Must match MODEL_FILENAME / CHECKSUM_SUFFIX in
# backend/image_converter/infrastructure/upscale_model.py (a unit test checks it).
ONNX_FILENAME = "realesr-general-x4v3.onnx"
CHECKSUM_SUFFIX = ".sha256"

MODEL_SPECS = {
    "general": {
        "name": "realesr-general-x4v3",
        "sha256": WEIGHTS_SHA256,
        "num_conv": 32,
    },
    "anime": {
        "name": "realesr-animevideov3",
        "sha256": "b8a8376811077954d82ca3fcf476f1ac3da3e8a68a4f4d71363008000a18b75d",
        "num_conv": 16,
    },
}

OPSET = 17
# Exactly the operators SRVGGNetCompact exports to with the pinned torch version.
# Anything else means the graph is not what we expect; if a torch upgrade changes
# the export, the build fails here and this list has to be reviewed.
ALLOWED_OPS = frozenset({"Conv", "PRelu", "DepthToSpace", "Resize", "Add", "Constant"})
TOLERANCE = 1e-4


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_verified_weights(
    cache_dir: Path, url: str = WEIGHTS_URL, sha256: str = WEIGHTS_SHA256, filename: str = WEIGHTS_FILENAME
) -> Path:
    """
    Returns the path of the weights file after checking its SHA-256. Downloads
    only if there is no verified copy in cache_dir. Never loads the file.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    destination = cache_dir / filename
    if destination.is_file() and sha256_file(destination) == sha256:
        return destination

    fd, temp_name = tempfile.mkstemp(dir=cache_dir, prefix=f".{filename}.")
    try:
        with os.fdopen(fd, "wb") as out, urllib.request.urlopen(url, timeout=120) as response:
            shutil.copyfileobj(response, out)
        actual = sha256_file(Path(temp_name))
        if actual != sha256:
            raise RuntimeError(f"Checksum mismatch for {url}: expected {sha256}, got {actual}. Not loading it.")
        os.replace(temp_name, destination)
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)
    return destination


def check_graph(model) -> None:
    """Rejects anything but a plain graph of allowlisted standard operators."""
    import onnx

    onnx.checker.check_model(model, full_check=True)
    if model.functions:
        raise RuntimeError("ONNX model contains local functions")
    for opset in model.opset_import:
        if opset.domain not in ("", "ai.onnx"):
            raise RuntimeError(f"ONNX model imports a non-standard domain: {opset.domain!r}")
    for node in model.graph.node:
        if node.domain not in ("", "ai.onnx") or node.op_type not in ALLOWED_OPS:
            raise RuntimeError(f"Unexpected ONNX operator: {node.domain or 'ai.onnx'}::{node.op_type}")
    for tensor in model.graph.initializer:
        if tensor.data_location == onnx.TensorProto.EXTERNAL:
            raise RuntimeError(f"ONNX initializer {tensor.name} uses external data")


def build_reference_model(weights: Path, num_conv: int = 32):
    import torch
    from torch import nn
    from torch.nn import functional as F

    class SRVGGNetCompact(nn.Module):
        # Same layers as realesrgan/archs/srvgg_arch.py. Both models use
        # num_feat=64, upscale=4, PReLU. General uses 32 hidden convolutions;
        # anime uses 16.
        def __init__(self, num_feat=64, num_conv=32, upscale=4):
            super().__init__()
            self.upscale = upscale
            self.body = nn.ModuleList([nn.Conv2d(3, num_feat, 3, 1, 1), nn.PReLU(num_parameters=num_feat)])
            for _ in range(num_conv):
                self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
                self.body.append(nn.PReLU(num_parameters=num_feat))
            self.body.append(nn.Conv2d(num_feat, 3 * upscale * upscale, 3, 1, 1))
            self.upsampler = nn.PixelShuffle(upscale)

        def forward(self, x):
            out = x
            for layer in self.body:
                out = layer(out)
            return self.upsampler(out) + F.interpolate(x, scale_factor=self.upscale, mode="nearest")

    # weights_only=True: only tensors and plain containers are unpickled.
    state = torch.load(weights, map_location="cpu", weights_only=True)
    model = SRVGGNetCompact(num_conv=num_conv)
    model.load_state_dict(state.get("params", state), strict=True)
    model.eval()
    return model


def export_onnx(model, destination: Path) -> None:
    import torch

    torch.onnx.export(
        model,
        torch.rand(1, 3, 64, 64),
        str(destination),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {2: "height", 3: "width"}, "output": {2: "height_x4", 3: "width_x4"}},
        opset_version=OPSET,
        do_constant_folding=True,
        dynamo=False,
    )


def compare_with_reference(model, onnx_path: Path) -> float:
    import numpy as np
    import onnxruntime as ort
    import torch

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    rng = np.random.default_rng(0)
    worst = 0.0
    for height, width in [(64, 64), (100, 37), (200, 160)]:
        x = rng.random((1, 3, height, width), dtype=np.float32)
        with torch.no_grad():
            expected = model(torch.from_numpy(x)).numpy()
        worst = max(worst, float(np.abs(session.run(None, {input_name: x})[0] - expected).max()))
    return worst


def build(output_dir: Path, cache_dir: Path, model: str = "general") -> Path:
    spec = MODEL_SPECS[model]
    name = spec["name"]
    filename = f"{name}.onnx"
    # Verify first; nothing below may run on weights that failed the checksum.
    weights = fetch_verified_weights(
        cache_dir,
        url=f"{RELEASE_URL}/{name}.pth",
        sha256=spec["sha256"],
        filename=f"{name}.pth",
    )
    reference = build_reference_model(weights, num_conv=spec["num_conv"])

    import onnx

    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output_dir) as tmp:
        candidate = Path(tmp) / filename
        export_onnx(reference, candidate)
        check_graph(onnx.load(str(candidate)))
        worst = compare_with_reference(reference, candidate)
        if worst > TOLERANCE:
            raise RuntimeError(f"ONNX output differs from PyTorch by {worst:.2e} (limit {TOLERANCE:.0e})")

        destination = output_dir / filename
        os.chmod(candidate, 0o644)
        os.replace(candidate, destination)
    checksum = sha256_file(destination)
    checksum_path = output_dir / (filename + CHECKSUM_SUFFIX)
    checksum_path.write_text(f"{checksum}  {filename}\n", encoding="utf-8")
    os.chmod(checksum_path, 0o644)
    print(f"built {destination} (sha256 {checksum}), max diff to PyTorch {worst:.1e}")
    return destination


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("output_dir", type=Path, help="Directory for the .onnx and .sha256 files")
    parser.add_argument("--model", choices=["all", *MODEL_SPECS], default="all", help="Models to build (default: both)")
    parser.add_argument(
        "--cache", type=Path, default=None, help="Directory to keep the verified .pth between builds (default: temporary)"
    )
    args = parser.parse_args(argv)
    models = list(MODEL_SPECS) if args.model == "all" else [args.model]
    if args.cache is not None:
        for model in models:
            build(args.output_dir.expanduser(), args.cache.expanduser(), model)
    else:
        with tempfile.TemporaryDirectory() as cache:
            for model in models:
                build(args.output_dir.expanduser(), Path(cache), model)
    return 0


if __name__ == "__main__":
    sys.exit(main())
