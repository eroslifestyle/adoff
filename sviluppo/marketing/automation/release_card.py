#!/usr/bin/env python3
"""Genera una release-card brandizzata AdOff per gli annunci Telegram.

Brand-identity locked (project_brand_identity): Deep Space #0a0a1a,
Shield Purple #7c5cfc, Pure White. Font Lexend ExtraBold (headline) +
Inter (body) + DejaVu Sans Mono (numeri). Logo watermark obbligatorio
(BRAND-HUB/2-LOGHI/avatar-1024.png) — solido in alto a sx + watermark
sfumato in basso a dx.

Fallback affidabile quando FLUX (sd-server :7860) non e' raggiungibile.
Ogni card e' "nuova" perche' headline/versione/bullet cambiano per release.

Uso:
  python3 release_card.py --version 3.5.5 \
      --headline "Smoother YouTube playback" \
      --bullet "..." --bullet "..." --out /tmp/card.png
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[3]  # automation→marketing→sviluppo→ChromePlugin
BRAND_HUB = ROOT / "sviluppo" / "marketing" / "BRAND-HUB"
LOGO_PATH = BRAND_HUB / "2-LOGHI" / "avatar-1024.png"
FONT_DIR = BRAND_HUB / "1-IDENTITA" / "font"

DEEP_SPACE = (10, 10, 26)       # #0a0a1a
SHIELD_PURPLE = (124, 92, 252)  # #7c5cfc
WHITE = (255, 255, 255)
MUTED = (176, 176, 200)

W, H = 1280, 800
MARGIN = 72

# Gli statici Lexend-*.ttf nel repo sono pointer LFS rotti → si usa il
# variable font (reale) con la variazione di peso richiesta.
LEXEND_VAR = FONT_DIR / "Lexend-var.ttf"
INTER_XB = Path("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf")
INTER_REG = Path("/usr/share/fonts/opentype/inter/Inter-Regular.otf")
INTER_SB = Path("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf")
MONO = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")


def font(path, size):
    try:
        return ImageFont.truetype(str(path), size)
    except Exception:
        return ImageFont.load_default()


def lexend(size, weight="ExtraBold", fallback=INTER_XB):
    """Lexend dal variable font con la variazione di peso; fallback Inter."""
    try:
        f = ImageFont.truetype(str(LEXEND_VAR), size)
        try:
            f.set_variation_by_name(weight)
        except Exception:
            pass
        return f
    except Exception:
        return font(fallback, size)


def radial_glow(size, color, radius_ratio=0.9):
    """Glow morbido (cerchio sfumato) su layer RGBA trasparente."""
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    cx, cy = size[0] // 2, size[1] // 2
    r = int(min(size) * radius_ratio / 2)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (120,))
    return glow.filter(ImageFilter.GaussianBlur(radius=140))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True)
    ap.add_argument("--headline", required=True)
    ap.add_argument("--bullet", action="append", default=[], dest="bullets")
    ap.add_argument("--cta", default="Get it free — adoff.app")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    img = Image.new("RGB", (W, H), DEEP_SPACE)

    # glow viola in alto a destra
    glow = radial_glow((900, 900), SHIELD_PURPLE, radius_ratio=0.8)
    img.paste(Image.alpha_composite(
        Image.new("RGBA", (900, 900), (0, 0, 0, 0)), glow).convert("RGB"),
        (W - 620, -360), glow)

    # watermark logo (obbligatorio) in basso a destra, parzialmente fuori
    # frame come watermark, opacita' leggibile sul dark
    if LOGO_PATH.exists():
        wm = Image.open(LOGO_PATH).convert("RGBA").resize((560, 560))
        alpha = wm.split()[3].point(lambda a: int(a * 0.34))
        wm.putalpha(alpha)
        img.paste(wm, (W - 430, H - 410), wm)

    draw = ImageDraw.Draw(img)

    # brand wordmark in alto a sinistra: "Ad"(bianco) + "Off"(viola)
    f_wm = lexend(52, "ExtraBold")
    draw.text((MARGIN, MARGIN), "Ad", font=f_wm, fill=WHITE)
    adw = draw.textlength("Ad", font=f_wm)
    draw.text((MARGIN + adw, MARGIN), "Off", font=f_wm, fill=SHIELD_PURPLE)

    # version pill in alto a destra
    f_ver = font(MONO, 34)
    vtxt = f"v{args.version}"
    vb = draw.textbbox((0, 0), vtxt, font=f_ver)
    vw, vh = vb[2] - vb[0], vb[3] - vb[1]
    pad = 22
    px2, py2 = W - MARGIN, MARGIN + 86
    px1, py1 = px2 - (vw + pad * 2), MARGIN + 18
    draw.rounded_rectangle([px1, py1, px2, py2], radius=18,
                           outline=SHIELD_PURPLE, width=3)
    draw.text((px1 + pad, py1 + (py2 - py1 - vh) / 2 - vb[1]), vtxt,
              font=f_ver, fill=SHIELD_PURPLE)

    # label "NEW RELEASE"
    f_label = font(INTER_SB, 28)
    draw.text((MARGIN, MARGIN + 150), "NEW RELEASE", font=f_label,
              fill=SHIELD_PURPLE)

    # headline (wrap manuale)
    f_head = lexend(72, "ExtraBold")
    y = MARGIN + 190
    words = args.headline.split()
    line, lines = "", []
    for w in words:
        test = (line + " " + w).strip()
        if draw.textlength(test, font=f_head) > W - 2 * MARGIN - 180:
            lines.append(line)
            line = w
        else:
            line = test
    if line:
        lines.append(line)
    for ln in lines:
        draw.text((MARGIN, y), ln, font=f_head, fill=WHITE)
        y += 82

    # bullets (riga singola: i testi vanno tenuti concisi a monte)
    f_bul = font(INTER_REG, 34)
    bx = MARGIN + 46
    y += 36
    for b in args.bullets:
        draw.ellipse([MARGIN + 6, y + 15, MARGIN + 24, y + 33],
                     fill=SHIELD_PURPLE)
        draw.text((bx, y), b, font=f_bul, fill=WHITE)
        y += 64

    # footer CTA + tagline (ancorati in basso)
    f_cta = font(INTER_SB, 34)
    f_tag = lexend(36, "Bold")
    fy = H - MARGIN - 30
    draw.text((MARGIN, fy), args.cta, font=f_cta, fill=WHITE)
    tag = "Ads? Off!"
    tw = draw.textlength(tag, font=f_tag)
    draw.text((W - MARGIN - tw, fy - 4), tag, font=f_tag, fill=SHIELD_PURPLE)

    img.save(args.out, "PNG")
    print(f"saved {args.out} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
