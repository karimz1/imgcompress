"""Execution-provider selection for onnxruntime (used by rembg sessions).

The same application image runs on CPU-only hosts (Mac/Docker, Intel NUC) and on
CUDA-capable hosts (NVIDIA PC with ``--gpus all``). We never hardcode a provider:
we ask onnxruntime which providers the current runtime actually offers and order
them by preference, always keeping CPU as a fallback.

Importing onnxruntime is deferred to call time so converter construction stays
lazy (see ``test_lazy_loading``).
"""

# Ordered by preference: GPU/accelerated first, CPU last as the universal fallback.
_PREFERENCE = (
    "CUDAExecutionProvider",
    "CoreMLExecutionProvider",
    "CPUExecutionProvider",
)


def get_execution_providers() -> list[str]:
    """Return the available onnxruntime providers ordered by preference.

    Falls back to CPU-only if onnxruntime cannot be imported or queried.
    """
    try:
        import onnxruntime as ort

        available = set(ort.get_available_providers())
    except Exception:
        return ["CPUExecutionProvider"]

    ordered = [provider for provider in _PREFERENCE if provider in available]
    if "CPUExecutionProvider" not in ordered:
        ordered.append("CPUExecutionProvider")
    return ordered
