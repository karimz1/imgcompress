from typing import Callable, Optional, Tuple

def find_best_quality_under_target(
    encoder: Callable[[int, bytes], bytes],
    data: bytes,
    target_bytes: int,
    *,
    q_min: int = 10,
    q_max: int = 95,
    max_attempts: int = 10,
) -> Tuple[int, bytes, int]:
    low, high = q_min, q_max
    best: Optional[Tuple[int, bytes, int]] = None

    for _ in range(max_attempts):
        if low > high:
            break
        q = (low + high) // 2
        out = encoder(q, data)
        size = len(out)
        if size <= target_bytes:
            best = (q, out, size)
            low = q + 1
        else:
            high = q - 1

    if best is None:
        out = encoder(q_min, data)
        return q_min, out, len(out)
    return best
