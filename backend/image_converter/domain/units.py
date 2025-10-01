from dataclasses import dataclass

SI, IEC = 1000, 1024

def to_bytes(value: float, unit: str = "KB", system: str = "IEC") -> int:
    base = IEC if system.upper() == "IEC" else SI
    unit = unit.upper()
    factor = {"KB": base, "MB": base**2, "GB": base**3}.get(unit, 1)
    return int(round(value * factor))

@dataclass(frozen=True)
class TargetSize:
    bytes: int
    tolerance: float = 0.02
    margin: float = 0.98

    @property
    def soft_limit(self) -> int:
        return int(self.bytes * self.margin)

    def within_tolerance(self, actual: int) -> bool:
        return actual <= int(self.bytes * (1 + self.tolerance))
