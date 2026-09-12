#!/usr/bin/env python3
"""Genera la release-card brand per l'annuncio Telegram @adoffapp (v3.5.14 / uBO sunset).

Hero di sfondo via shim OmniaStudio flux2 (fallback: gradiente Deep Space composto in locale),
overlay testo brand (Lexend) + logo watermark. Palette: Deep Space #0a0a1a / Shield Purple
#7c5cfc / white. Nessun logo di terze parti nell'asset.
"""
import sys
from pathlib import Path
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]  # sviluppo/
HUB = ROOT / "marketing" / "BRAND-HUB"
FONT_DIR = HUB / "1-IDENTITA" / "font"
LOGO = HUB / "2-LOGHI" / "avatar-1024.png"
OUT_DIR = HUB / "3-IMMAGINI-SOCIAL" / "telegram"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "release-3.5.14-ublock-mv3.png"

W, H = 1280, 720
DEEP = (10, 10, 26)
PURPLE = (124, 92, 252)
WHITE = (255, 255, 255)
MUTE = (176, 176, 200)

HERO_PROMPT = (
    "abstract dark cyberspace background, deep space navy #0a0a1a, glowing violet purple "
    "energy shield motif, soft bokeh particles, minimal, premium tech, lots of empty dark "
    "negative space on the left, no text, no logos, cinematic"
)


def _shield(draw, cx, cy, w, h, outline, width):
    """Sagoma scudo brand (stroke) centrata in (cx,cy)."""
    top = cy - h // 2
    pts = [
        (cx, top), (cx + w // 2, top + h * 0.16),
        (cx + w // 2, cy + h * 0.10),
        (cx, cy + h // 2),
        (cx - w // 2, cy + h * 0.10),
        (cx - w // 2, top + h * 0.16), (cx, top),
    ]
    draw.line(pts, fill=outline, width=width, joint="curve")


def hero_background():
    """Sfondo Deep Space composto in locale (zero watermark di terze parti):
    glow radiale viola + scudo brand sulla destra."""
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
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    return img, "gradient"


def font(name, size):
    # Lexend brand font (static instances materializzati dal variabile, 2026-06-17).
    return ImageFont.truetype(str(FONT_DIR / name), size)


def main():
    img, mode = hero_background()

    # Fascia gradiente scura in basso: copre eventuali watermark del generatore
    # (es. residuo "OmniaStudio") e migliora la leggibilità di chip/tagline/logo.
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
    # Striscia piena opaca sul bordo inferiore: azzera qualsiasi watermark del generatore.
    d.rectangle([0, H - 50, W, H], fill=DEEP)
    M = 80

    # eyebrow
    d.text((M, 120), "CHROME · JUNE 30, 2026", font=font("Lexend-Bold.ttf", 26), fill=PURPLE)

    # headline (due righe ad alto contrasto)
    f_h = font("Lexend-ExtraBold.ttf", 74)
    d.text((M, 168), "uBlock Origin", font=f_h, fill=WHITE)
    d.text((M, 250), "stopped on Chrome.", font=f_h, fill=WHITE)
    f_h2 = font("Lexend-ExtraBold.ttf", 74)
    d.text((M, 348), "AdOff", font=f_h2, fill=PURPLE)
    w_adoff = d.textlength("AdOff ", font=f_h2)
    d.text((M + w_adoff, 348), "didn't.", font=f_h2, fill=WHITE)

    # subhead
    f_s = font("Lexend-Bold.ttf", 30)
    d.text((M, 470), "Built for Manifest V3 from day one.", font=f_s, fill=MUTE)
    d.text((M, 512), "Full-strength blocking. Ultra-light. Free.", font=f_s, fill=MUTE)

    # version chip
    chip = "v3.5.14"
    f_v = font("Lexend-Bold.ttf", 26)
    tw = d.textlength(chip, font=f_v)
    d.rounded_rectangle([M, 600, M + tw + 44, 652], radius=14, fill=PURPLE)
    d.text((M + 22, 609), chip, font=f_v, fill=WHITE)

    # tagline
    d.text((M + tw + 70, 609), "Ads? Off.", font=font("Lexend-ExtraBold.ttf", 30), fill=WHITE)

    # logo watermark (bottom-right)
    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA").resize((150, 150))
        img_rgba = img.convert("RGBA")
        img_rgba.alpha_composite(logo, (W - 150 - 56, H - 150 - 48))
        img = img_rgba.convert("RGB")

    img.save(OUT, "PNG")
    print(f"OK [{mode}] → {OUT}")


if __name__ == "__main__":
    main()
