"""Optional offline OCR of newly rendered pixels, never of source PDF content."""

import os
from pathlib import Path
import re
import shutil
import subprocess
from io import BytesIO


class PdfOcrError(ValueError):
    pass


class PdfOcr:
    @staticmethod
    def executable():
        configured = os.environ.get("IMGCOMPRESS_TESSERACT")
        if configured:
            return configured
        found = shutil.which("tesseract")
        if found:
            return found
        if os.name == "nt":
            candidate = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Tesseract-OCR/tesseract.exe"
            if candidate.is_file():
                return str(candidate)
        return None

    @staticmethod
    def _process_options():
        return {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}

    def status(self):
        executable = self.executable()
        if not executable:
            return {"available": False, "languages": []}
        try:
            result = subprocess.run(
                [executable, "--list-langs"], capture_output=True, text=True,
                timeout=10, check=True, **self._process_options(),
            )
            languages = [line.strip() for line in result.stdout.splitlines()
                         if re.fullmatch(r"[a-zA-Z0-9_/-]+", line.strip()) and line.strip() != "osd"]
            return {"available": bool(languages), "languages": languages}
        except (OSError, subprocess.SubprocessError):
            return {"available": False, "languages": []}

    def recognize(self, image, language, dpi=300):
        executable = self.executable()
        if not executable:
            raise PdfOcrError("OCR is not installed. Install Tesseract and its language data, then try again.")
        with BytesIO() as buffer:
            image.save(buffer, format="PNG", dpi=(dpi, dpi))
            try:
                result = subprocess.run(
                    [executable, "stdin", "stdout", "-l", language, "--dpi", str(dpi), "pdf"],
                    input=buffer.getvalue(), capture_output=True, timeout=180, check=True,
                    **self._process_options(),
                )
            except (OSError, subprocess.SubprocessError) as error:
                raise PdfOcrError("Text recognition failed. Check the OCR installation or try without OCR.") from error
        if not result.stdout.startswith(b"%PDF"):
            raise PdfOcrError("OCR did not produce a PDF. Try without OCR.")
        return result.stdout
