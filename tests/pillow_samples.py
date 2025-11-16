import os
from PIL import Image, ImageDraw
from backend.image_converter.core.internals.utls import load_supported_formats

def generate_pillow_samples(dirpath: str, is_supported_predicate):
    os.makedirs(dirpath, exist_ok=True)
    created = []
    reg = Image.registered_extensions()
    supported_exts = load_supported_formats()
    for ext in supported_exts:
        fmt = reg.get(ext)
        if not fmt:
            print(f"[pillow samples] No Pillow format for extension {ext}, skipping.")
            continue
        fname = f"_generated_pillow_sample{ext}"
        path = os.path.join(dirpath, fname)
        if is_supported_predicate is not None and not is_supported_predicate(path):
            continue
        # Use sensible defaults for mode/size
        mode = "RGB"
        size = (32, 24)
        if fmt in ("PNG", "ICNS", "ICO"):
            mode = "RGBA"
        elif fmt == "GIF":
            mode = "P"
        elif fmt == "XBM":
            mode = "1"
        elif fmt == "SPIDER":
            mode = "F"
        if fmt == "ICO":
            size = (64, 64)

        im = Image.new(mode, size)
        draw = ImageDraw.Draw(im)
        w, h = size
        for i in range(min(w, h)):
            if mode == "P":
                im.putpalette([v for rgb in [(j, j, j) for j in range(256)] for v in rgb])
                im.putpixel((i, i), (i % 256))
            elif mode == "1":
                im.putpixel((i, i), 1)
            elif mode == "RGBA":
                im.putpixel((i, i), (i % 256, (i * 2) % 256, (i * 3) % 256, 128 if i % 2 else 255))
            elif mode == "F":
                im.putpixel((i, i), float(i) / float(min(w, h)))
            else:
                im.putpixel((i, i), (i % 256, (i * 2) % 256, (i * 3) % 256))
        try:
            draw.rectangle([1, 1, w - 2, h - 2])
        except Exception:
            pass
        try:
            im.save(path, format=fmt)
            created.append(fname)
        except Exception as e:
            print(f"[pillow samples] Skip {fmt} -> {ext}: {e}")
    print(f"[pillow samples] Created: {created}")
    return created


def generate_pillow_samples(dirpath: str, is_supported_predicate):
    os.makedirs(dirpath, exist_ok=True)
    created = []
    reg = Image.registered_extensions()  # {".png": "PNG", ...}
    supported_exts = load_supported_formats()
    for ext in supported_exts:
        fmt = reg.get(ext)
        if not fmt:
            print(f"[pillow samples] No Pillow format for extension {ext}, skipping.")
            continue
        fname = f"_generated_pillow_sample{ext}"
        path = os.path.join(dirpath, fname)
        if is_supported_predicate is not None and not is_supported_predicate(path):
            continue
        # Use sensible defaults for mode/size
        mode = "RGB"
        size = (32, 24)
        if fmt in ("PNG", "ICNS", "ICO"):
            mode = "RGBA"
        elif fmt == "GIF":
            mode = "P"
        elif fmt == "XBM":
            mode = "1"
        elif fmt == "SPIDER":
            mode = "F"
        if fmt == "ICO":
            size = (64, 64)

        im = Image.new(mode, size)
        draw = ImageDraw.Draw(im)
        w, h = size
        for i in range(min(w, h)):
            if mode == "P":
                im.putpalette([v for rgb in [(j, j, j) for j in range(256)] for v in rgb])
                im.putpixel((i, i), (i % 256))
            elif mode == "1":
                im.putpixel((i, i), 1)
            elif mode == "RGBA":
                im.putpixel((i, i), (i % 256, (i * 2) % 256, (i * 3) % 256, 128 if i % 2 else 255))
            elif mode == "F":
                im.putpixel((i, i), float(i) / float(min(w, h)))
            else:
                im.putpixel((i, i), (i % 256, (i * 2) % 256, (i * 3) % 256))
        try:
            draw.rectangle([1, 1, w - 2, h - 2])
        except Exception:
            pass
        try:
            im.save(path, format=fmt)
            created.append(fname)
        except Exception as e:
            print(f"[pillow samples] Skip {fmt} -> {ext}: {e}")
    print(f"[pillow samples] Created: {created}")
    return created