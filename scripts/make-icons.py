"""Generate the Tauri icon set from the cat portrait.

Run from the project root:
    python scripts/make-icons.py

The source image is expected at src-tauri/icons/source.jpg.
"""

from __future__ import annotations

import io
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
SOURCE = ICON_DIR / "source.jpg"

# Work large, then downsample for clean edges. The final canvas is 1024px;
# Tauri/macOS will derive the @2x sizes from the PNG chunks below.
SIZE = 2048
RADIUS = round(SIZE * 0.205)
FEATHER = 36
CROP_BOTTOM = 2200


def build_canvas() -> Image.Image:
    source = ImageOps.exif_transpose(Image.open(SOURCE)).convert("RGB")
    width, height = source.size

    # Blurred, slightly darkened copy fills the narrow side bands.
    backdrop = source.resize((SIZE, round(height * SIZE / width)), Image.LANCZOS)
    top = (backdrop.height - SIZE) // 2
    backdrop = backdrop.crop((0, top, SIZE, top + SIZE))
    backdrop = backdrop.filter(ImageFilter.GaussianBlur(46))
    backdrop = Image.eval(backdrop, lambda value: int(value * 0.9)).convert("RGBA")

    # The portrait keeps both ear tips and the full chin/whiskers.
    portrait = source.crop((0, 0, width, CROP_BOTTOM))
    portrait = portrait.resize(
        (round(width / CROP_BOTTOM * SIZE), SIZE), Image.LANCZOS
    ).convert("RGBA")

    canvas = backdrop.copy()
    left = (SIZE - portrait.width) // 2
    mask = Image.new("L", portrait.size, 255)
    draw = ImageDraw.Draw(mask)
    for offset in range(FEATHER):
        alpha = round(255 * offset / (FEATHER - 1))
        draw.line([(offset, 0), (offset, portrait.height)], fill=alpha)
        draw.line(
            [(portrait.width - 1 - offset, 0), (portrait.width - 1 - offset, portrait.height)],
            fill=alpha,
        )
    canvas.paste(portrait, (left, 0), mask)

    # Rounded-square silhouette.
    rounded = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(rounded).rounded_rectangle(
        [0, 0, SIZE - 1, SIZE - 1], radius=RADIUS, fill=255
    )
    canvas.putalpha(rounded)

    # Hairline cream rim keeps the photo separated from dark taskbars.
    rim = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle(
        [0, 0, SIZE - 1, SIZE - 1],
        radius=RADIUS,
        outline=(255, 249, 236, 54),
        width=max(2, round(SIZE * 0.003)),
    )
    return Image.alpha_composite(canvas, rim)


def png_bytes(image: Image.Image, size: int) -> bytes:
    buffer = io.BytesIO()
    image.resize((size, size), Image.LANCZOS).save(buffer, "PNG", optimize=True)
    return buffer.getvalue()


def write_icns(image: Image.Image) -> None:
    # Types understood by macOS: 16/32/64/128/256/512/1024 plus @2x slots.
    chunks = [
        ("icp4", 16),
        ("icp5", 32),
        ("icp6", 64),
        ("ic07", 128),
        ("ic08", 256),
        ("ic09", 512),
        ("ic10", 1024),
        ("ic11", 32),
        ("ic12", 64),
        ("ic13", 256),
        ("ic14", 512),
    ]
    payload = b"".join(
        kind.encode("ascii") + struct.pack(">I", 8 + len(png_bytes(image, size))) + png_bytes(image, size)
        for kind, size in chunks
    )
    (ICON_DIR / "icon.icns").write_bytes(
        b"icns" + struct.pack(">I", 8 + len(payload)) + payload
    )


def main() -> None:
    canvas = build_canvas()
    icon_1024 = canvas.resize((1024, 1024), Image.LANCZOS)

    icon_1024.save(ICON_DIR / "icon.png", optimize=True)
    icon_1024.resize((32, 32), Image.LANCZOS).save(ICON_DIR / "32x32.png", optimize=True)
    icon_1024.resize((128, 128), Image.LANCZOS).save(ICON_DIR / "128x128.png", optimize=True)
    icon_1024.resize((256, 256), Image.LANCZOS).save(
        ICON_DIR / "128x128@2x.png", optimize=True
    )
    icon_1024.resize((256, 256), Image.LANCZOS).save(ICON_DIR / "icon-256.png", optimize=True)

    icon_1024.save(
        ICON_DIR / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    write_icns(icon_1024)

    print("Tauri icons written to", ICON_DIR)


if __name__ == "__main__":
    main()
