#!/usr/bin/env python3
"""Genera la release-card brand AdOff parametrizzata."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Palette (identica all'originale)
W, H = 1280, 720
DEEP = (10, 10, 26)
PURPLE = (124, 92, 252)
WHITE = (255, 255, 255)
MUTE = (176, 176, 200)

# Layout dinamico
M = 80
Y_START_HEADLINE = 168
STEP_HEADLINE = 82
Y_START_SUB = 470
STEP_SUB = 42

# Asset brand: stessa fonte del generatore storico (gen-release-card-mv3.py)
HUB = Path(__file__).resolve().parents[1] / "marketing" / "BRAND-HUB"
FONT_DIR = HUB / "1-IDENTITA" / "font"
LOGO = HUB / "2-LOGHI" / "avatar-1024.png"


def _shield(draw, cx, cy, w, h, outline, width):
    """Sagoma scudo brand."""
    top = cy - h // 2
    pts = [
        (cx, top), (cx + w // 2, top + h * 0.16),
        (cx + w // 2, cy + h * 0.10), (cx, cy + h // 2),
        (cx - w // 2, cy + h * 0.10), (cx - w // 2, top + h * 0.16), (cx, top),
    ]
    draw.line(pts, fill=outline, width=width, joint="curve")


def hero_background():
    """Sfondo Deep Space: glow radiale + scudo brand sulla destra."""
    img = Image.new("RGB", (W, H), DEEP)
    glow = Image.new("RGB", (W, H), DEEP)
    gd = ImageDraw.Draw(glow)
    cx, cy = int(W * 0.74), int(H * 0.46)
    for r in range(460, 0, -5):
        a = max(0, 78 - int(r / 6.5))
        col = (DEEP[0] + a // 2, DEEP[1] + a // 3, min(70, DEEP[2] + a))
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    img = Image.blend(img, glow, 0.95)
    sd = ImageDraw.Draw(img)
    _shield(sd, cx, cy, 360, 420, (150, 120, 255), 6)
    _shield(sd, cx, cy, 300, 350, (110, 84, 210), 3)
    return img.filter(ImageFilter.GaussianBlur(0.6))


def fnt(name, size):
    return ImageFont.truetype(str(FONT_DIR / name), size)


def compute_wrap(lines, useful_width):
    """Riduce la size delle headline fino a rientrare nella larghezza utile."""
    size = 74
    while size >= 46:
        test_font = fnt("Lexend-ExtraBold.ttf", size)
        if all(ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(t, font=test_font) <= useful_width for t in lines):
            return size
        size -= 6
    return 46


def main():
    parser = argparse.ArgumentParser(description="Genera release-card AdOff")
    parser.add_argument("--out", required=True, help="Path PNG output")
    parser.add_argument("--eyebrow", help="Testo eyebrow (opzionale)")
    parser.add_argument("--line1", required=True, help="Prima riga headline")
    parser.add_argument("--line2", required=True, help="Seconda riga headline")
    parser.add_argument("--line3-accent", help="Parola viola terza riga (opzionale)")
    parser.add_argument("--line3-rest", help="Resto terza riga (opzionale)")
    parser.add_argument("--sub1", required=True, help="Prima riga subhead")
    parser.add_argument("--sub2", help="Seconda riga subhead (opzionale)")
    parser.add_argument("--chip", required=True, help="Versione chip (es. v3.5.59)")
    args = parser.parse_args()

    # Larghezza utile per wrapping headline
    useful_width = W - 2 * M - 200
    lines_to_check = [args.line1, args.line2]
    if args.line3_accent:
        lines_to_check.append(args.line3_accent)
    if args.line3_rest:
        lines_to_check.append(args.line3_rest)
    size_h = compute_wrap(lines_to_check, useful_width)
    f_h = fnt("Lexend-ExtraBold.ttf", size_h)

    img = hero_background()

    # Fascia gradiente scura in basso
    band_h = 150
    band = Image.new("RGBA", (W, band_h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for y in range(band_h):
        a = int(235 * (y / band_h) ** 1.4)
        bd.line([(0, y), (W, y)], fill=(DEEP[0], DEEP[1], DEEP[2], a))
    img = img.convert("RGBA")
    img.alpha_composite(band, (0, H - band_h))
    img = img.convert("RGB")

    d = ImageDraw.Draw(img)
    # Striscia opaca bordo inferiore
    d.rectangle([0, H - 50, W, H], fill=DEEP)

    # Eyebrow (opzionale)
    y = 120
    if args.eyebrow:
        d.text((M, y), args.eyebrow, font=fnt("Lexend-Bold.ttf", 26), fill=PURPLE)

    # Headline con Y dinamiche
    y = Y_START_HEADLINE
    d.text((M, y), args.line1, font=f_h, fill=WHITE)
    y += STEP_HEADLINE
    d.text((M, y), args.line2, font=f_h, fill=WHITE)

    # Terza riga headline (opzionale)
    if args.line3_accent:
        y += STEP_HEADLINE
        d.text((M, y), args.line3_accent, font=f_h, fill=PURPLE)
        if args.line3_rest:
            w_acc = d.textlength(args.line3_accent + " ", font=f_h)
            d.text((M + w_acc, y), args.line3_rest, font=f_h, fill=WHITE)

    # Subhead con Y dinamiche
    f_s = fnt("Lexend-Bold.ttf", 30)
    y = Y_START_SUB
    d.text((M, y), args.sub1, font=f_s, fill=MUTE)
    if args.sub2:
        y += STEP_SUB
        d.text((M, y), args.sub2, font=f_s, fill=MUTE)

    # Version chip
    f_v = fnt("Lexend-Bold.ttf", 26)
    tw = d.textlength(args.chip, font=f_v)
    d.rounded_rectangle([M, 600, M + tw + 44, 652], radius=14, fill=PURPLE)
    d.text((M + 22, 609), args.chip, font=f_v, fill=WHITE)

    # Tagline (identica all'originale)
    d.text((M + tw + 70, 609), "Ads? Off.", font=fnt("Lexend-ExtraBold.ttf", 30), fill=WHITE)

    # Logo watermark bottom-right
    logo = LOGO
    if logo.exists():
        logo_img = Image.open(logo).convert("RGBA").resize((150, 150))
        img_rgba = img.convert("RGBA")
        img_rgba.alpha_composite(logo_img, (W - 150 - 56, H - 150 - 48))
        img = img_rgba.convert("RGB")

    # Output
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    print(f"OK -> {out}")


if __name__ == "__main__":
    main()
