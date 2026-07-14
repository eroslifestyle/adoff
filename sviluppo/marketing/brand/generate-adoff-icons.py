"""
Generate AdOff Chrome extension icons.

Design: circular violet gradient background (#7c5cfc -> #4c3ad4),
white bold "Ad" text centered, white diagonal strike-through line.
Flat, modern, minimal style.

Output: assets/icon{16,19,32,38,48,128}.png
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SIZES: list[int] = [16, 19, 32, 38, 48, 128]

COLOR_BG_START = (124, 92, 252)   # #7c5cfc
COLOR_BG_END   = (76,  58, 212)   # #4c3ad4
COLOR_FG       = (255, 255, 255)  # white

ASSETS_DIR = Path(__file__).resolve().parents[3] / "assets"  # reorg: marketing/brand depth+1

# Strike-line thickness relative to icon size (0.12 = 12%)
LINE_THICKNESS_RATIO = 0.12
# Strike-line margin from circle edge (fraction of radius)
LINE_MARGIN_RATIO = 0.18


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lerp_color(a: tuple[int, int, int],
                b: tuple[int, int, int],
                t: float) -> tuple[int, int, int]:
    """Linear interpolation between two RGB colours."""
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def _gradient_circle(size: int) -> Image.Image:
    """
    Create a circular image with a top-left -> bottom-right gradient.

    Returns an RGBA image with transparent corners outside the circle.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = img.load()
    cx = cy = size / 2.0
    r  = size / 2.0

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy <= r * r:
                t = ((x + y) / (size * 2 - 2)) if size > 1 else 0.0
                rgb = _lerp_color(COLOR_BG_START, COLOR_BG_END, t)
                pixels[x, y] = (*rgb, 255)

    return img


def _best_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """
    Try to load a bold TrueType font at the given pixel size.
    Falls back to the PIL default bitmap font if no TTF is found.
    """
    candidates = [
        "arialbd.ttf", "Arial Bold.ttf",
        "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf",
        "Verdana Bold.ttf", "verdanab.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except (OSError, IOError):
            pass
    return ImageFont.load_default()


def _draw_ad_text(draw: ImageDraw.ImageDraw,
                  size: int,
                  font: ImageFont.FreeTypeFont | ImageFont.ImageFont) -> None:
    """Draw white "Ad" text centred on the canvas."""
    label = "Ad"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1]
    draw.text((tx, ty), label, font=font, fill=COLOR_FG)


def _draw_strike(draw: ImageDraw.ImageDraw, size: int) -> None:
    """
    Draw a white diagonal line from bottom-left to top-right of the circle,
    slightly inset from the edge, to create a "prohibited" look.
    """
    r      = size / 2.0
    margin = r * LINE_MARGIN_RATIO
    thick  = max(1, round(size * LINE_THICKNESS_RATIO))

    # 45-degree line: project margin inward from the circle perimeter
    offset = margin / math.sqrt(2)
    x0 = r - (r - offset)       # left side  (bottom-left area)
    y0 = r + (r - offset)
    x1 = r + (r - offset)       # right side (top-right area)
    y1 = r - (r - offset)

    draw.line([(x0, y0), (x1, y1)], fill=COLOR_FG, width=thick)


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate_icon(size: int, output_dir: Path) -> Path:
    """
    Generate a single AdOff icon at *size* x *size* pixels.

    Args:
        size: Icon dimension in pixels.
        output_dir: Directory where the PNG will be saved.

    Returns:
        Path to the written file.
    """
    # 2x supersample for anti-aliasing on small sizes
    scale  = 2 if size < 64 else 1
    render = size * scale

    # Gradient circle background
    img  = _gradient_circle(render)
    draw = ImageDraw.Draw(img)

    # Font size: ~45% of render size gives good visual weight
    font_px = max(6, round(render * 0.42))
    font    = _best_font(font_px)

    _draw_ad_text(draw, render, font)
    _draw_strike(draw, render)

    # Downsample to target size with high-quality filter
    if scale > 1:
        img = img.resize((size, size), Image.LANCZOS)

    output_path = output_dir / f"icon{size}.png"
    img.save(output_path, "PNG", optimize=True)
    return output_path


def main() -> None:
    """Generate all required icon sizes."""
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    for size in SIZES:
        path = generate_icon(size, ASSETS_DIR)
        print(f"  icon{size:>3}.png  ->  {path}")

    print(f"\nDone. {len(SIZES)} icons saved to: {ASSETS_DIR}")


if __name__ == "__main__":
    main()
