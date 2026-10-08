"""
Checks that the bundled upscaling model really is Real-ESRGAN's realesr-general-x4v3.

The ONNX file the Docker build downloads is a third-party export, so this script
rebuilds the network from the upstream definition (SRVGGNetCompact), loads the
official weights from the Real-ESRGAN v0.2.5.0 GitHub release (checksum pinned
below), and compares both on random input. Not part of the app or CI; run it
when the pinned model changes.

    pip install torch --index-url https://download.pytorch.org/whl/cpu
    python scripts/verify_upscale_model.py
"""

import hashlib
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.image_converter.infrastructure.upscale_model import UPSCALE_MODEL, download_model  # noqa: E402

OFFICIAL_WEIGHTS_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth"
OFFICIAL_WEIGHTS_SHA256 = "8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292"
TOLERANCE = 1e-4


def build_reference(weights: Path):
    import torch
    from torch import nn
    from torch.nn import functional as F

    class SRVGGNetCompact(nn.Module):
        # Same layers as realesrgan/archs/srvgg_arch.py (num_feat=64, num_conv=32, upscale=4, prelu).
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

    state = torch.load(weights, map_location="cpu", weights_only=True)
    model = SRVGGNetCompact()
    model.load_state_dict(state.get("params", state), strict=True)
    model.eval()

    def run(x: np.ndarray) -> np.ndarray:
        with torch.no_grad():
            return model(torch.from_numpy(x)).numpy()

    return run


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        weights = Path(tmp) / "realesr-general-x4v3.pth"
        urllib.request.urlretrieve(OFFICIAL_WEIGHTS_URL, weights)
        digest = hashlib.sha256(weights.read_bytes()).hexdigest()
        if digest != OFFICIAL_WEIGHTS_SHA256:
            print(f"official weights checksum mismatch: {digest}")
            return 1

        onnx_path = download_model(target_dir=Path(tmp))
        reference = build_reference(weights)
        session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        input_name = session.get_inputs()[0].name

        rng = np.random.default_rng(0)
        worst = 0.0
        for height, width in [(64, 64), (100, 37), (200, 160)]:
            x = rng.random((1, 3, height, width), dtype=np.float32)
            diff = float(np.abs(session.run(None, {input_name: x})[0] - reference(x)).max())
            worst = max(worst, diff)
            print(f"{height}x{width}: max abs diff {diff:.2e}")

    if worst > TOLERANCE:
        print(f"{UPSCALE_MODEL.filename} does NOT match the official weights")
        return 1
    print(f"{UPSCALE_MODEL.filename} matches the official Real-ESRGAN weights")
    return 0


if __name__ == "__main__":
    sys.exit(main())
