import os
from pathlib import Path

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("imgcompress")
BASE = os.environ.get("IMGCOMPRESS_URL", "http://localhost:5000")


async def _compress(input_paths: list[str], output_format: str, quality: int,
                    width: int | None, target_size_kb: int | None,
                    use_rembg: bool) -> dict:
    files = []
    for p in input_paths:
        path = Path(p)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {p}")
        files.append(("files[]", (path.name, path.read_bytes(), "application/octet-stream")))

    data = {"format": output_format, "quality": str(quality), "use_rembg": "true" if use_rembg else "false"}
    if width is not None:
        data["width"] = str(width)
    if target_size_kb is not None:
        data["target_size_kb"] = str(target_size_kb)

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(f"{BASE}/api/compress", data=data, files=files)
        response.raise_for_status()
        return response.json()


@mcp.tool()
async def compress_images(
    input_paths: list[str],
    output_format: str = "jpeg",
    quality: int = 85,
    width: int | None = None,
    target_size_kb: int | None = None,
) -> dict:
    """Compress or convert one or more images. Returns dest_folder (UUID) and
    converted_files needed for download_file / download_all.

    output_format: one of jpeg, png, ico, avif, pdf (default: jpeg)
    quality: 1-100 (default: 85)
    width: resize to this width in pixels, keeping aspect ratio (optional)
    target_size_kb: target output file size in KB (optional)
    """
    return await _compress(input_paths, output_format, quality, width, target_size_kb, use_rembg=False)


@mcp.tool()
async def remove_background(
    input_paths: list[str],
    output_format: str = "png",
) -> dict:
    """Remove the background from one or more images using the rembg AI model.
    Returns dest_folder and converted_files.

    output_format: one of jpeg, png, ico, avif, pdf (default: png — preserves transparency)
    """
    return await _compress(input_paths, output_format, quality=85, width=None,
                           target_size_kb=None, use_rembg=True)


@mcp.tool()
async def download_file(folder: str, filename: str, save_to: str) -> str:
    """Download a single processed file to save_to path on disk.
    Use folder and filename from the compress_images / remove_background response."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(f"{BASE}/api/download", params={"folder": folder, "file": filename})
        response.raise_for_status()
    dest = Path(save_to)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(response.content)
    return str(dest)


@mcp.tool()
async def download_all(folder: str, save_to: str) -> str:
    """Download all processed files from a session as a ZIP archive to save_to path."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(f"{BASE}/api/download_all", params={"folder": folder})
        response.raise_for_status()
    dest = Path(save_to)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(response.content)
    return str(dest)


@mcp.tool()
async def list_supported_formats() -> list[str]:
    """Return all image formats the imgcompress server can process."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{BASE}/api/images_supported")
        response.raise_for_status()
    return response.json().get("supported_formats", [])


@mcp.tool()
async def health_check() -> dict:
    """Check if the imgcompress backend is reachable and running."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{BASE}/api/health/backend")
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError:
        return {"status": "unreachable", "url": BASE}


if __name__ == "__main__":
    mcp.run()
