"""
AdOff avatar — wordmark fedele allo STILE DEL SITO (site/).

Fonti verificate dal sito reale:
  - logo = testo "Ad"+"Off": .sn-logo span{color:#7c5cfc}, "Ad" #fff, weight 800
  - display font = Lexend (style.css), Inter per body
  - bg = Deep Space #0a0a1a
  - signature glow hero::before = radial-gradient(ellipse,
      rgba(124,92,252,0.22) 0%, transparent 70%) top-center
  - letter-spacing logo = -0.5px (tight)

Nessun magenta, nessuna forma inventata: SOLO lo stile del sito.

Output: assets/avatar-512.png, avatar-1024.png, avatar-preview.png
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SS = 4
BRAND = Path(__file__).resolve().parent
OUT = BRAND.parent / "assets"  # reorg: asset consolidati in marketing/assets
FONT = BRAND / "fonts" / "Lexend-var.ttf"

BG = (10, 10, 26)            # #0a0a1a Deep Space
WHITE = (255, 255, 255)      # "Ad"
PURPLE = (124, 92, 252)      # #7c5cfc "Off"
GLOW = (124, 92, 252)        # rgba(124,92,252,0.22) hero glow


def load_font(px: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), px)
    try:
        f.set_variation_by_axes([800])      # Lexend weight 800 (come sito)
    except Exception:
        pass
    return f


def radial_glow(S: int) -> Image.Image:
    """Glow viola radiale identico a hero::before (ellisse soft, top-center)."""
    g = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = g.load()
    cx, cy = S * 0.5, S * 0.30          # top-center come il sito
    rx, ry = S * 0.62, S * 0.58
    for y in range(S):
        for x in range(S):
            d = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 0.5
            if d < 1.0:
                a = int(0.22 * 255 * (1.0 - d) ** 1.4)   # 0.22 peak -> transparent 70%
                if a:
                    px[x, y] = (GLOW[0], GLOW[1], GLOW[2], a)
    return g


def measure(d, font, txt):
    b = d.textbbox((0, 0), txt, font=font)
    return b[2] - b[0], b[3] - b[1], b[0], b[1]


def build(size: int) -> Image.Image:
    S = size * SS
    img = Image.new("RGBA", (S, S), BG + (255,))
    img = Image.alpha_composite(img, radial_glow(S))
    d = ImageDraw.Draw(img)

    # dimensiona il font finche' "AdOff" ~ 0.80*S di larghezza
    target = S * 0.80
    fs = int(S * 0.30)
    for _ in range(60):
        f = load_font(fs)
        w, _, _, _ = measure(d, f, "AdOff")
        if w >= target:
            break
        fs += max(1, int(S * 0.004))
    f = load_font(fs)

    track = -fs * 0.035                 # letter-spacing negativo (tight, come sito)
    wAd, hh, oxAd, oyAd = measure(d, f, "Ad")
    wOff, _, _, _ = measure(d, f, "Off")
    total = wAd + track + wOff
    # bbox verticale reale per centratura ottica
    b = d.textbbox((0, 0), "AdOff", font=f)
    tw, th = b[2] - b[0], b[3] - b[1]
    x0 = (S - total) / 2
    y0 = (S - th) / 2 - b[1]

    d.text((x0, y0), "Ad", font=f, fill=WHITE)
    d.text((x0 + wAd + track, y0), "Off", font=f, fill=PURPLE)

    img = img.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    build(512).save(OUT / "avatar-512.png")
    build(1024).save(OUT / "avatar-1024.png")
    pv = Image.new("RGB", (256 + 96 + 48 + 80, 256 + 40), (24, 24, 34))
    x = 20
    for s in (256, 96, 48):
        pv.paste(build(s), (x, (256 + 40 - s) // 2), build(s))
        x += s + 20
    pv.save(OUT / "avatar-preview.png")
    print("OK: avatar-512/1024/preview (wordmark site-style, Lexend 800)")


if __name__ == "__main__":
    main()
