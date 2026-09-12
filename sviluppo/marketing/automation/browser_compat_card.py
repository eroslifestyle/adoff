#!/usr/bin/env python3
"""Banner 'compatibile con tutti i browser' per AdOff (post Telegram).

Brand-identity locked: Deep Space #0a0a1a, Shield Purple #7c5cfc, white,
font Lexend var (ExtraBold/Bold) + Inter. Logo AdOff watermark obbligatorio.
I loghi browser (uso nominativo) sono PNG a colori ufficiali da
alrra/browser-logos, scaricati in --logos-dir come c_<name>.png.

Uso:
  python3 browser_compat_card.py --logos-dir /tmp/browser_logos --out /tmp/x.png
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[3]  # automation→marketing→sviluppo→ChromePlugin
BRAND_HUB = ROOT / "sviluppo" / "marketing" / "BRAND-HUB"
LOGO_PATH = BRAND_HUB / "2-LOGHI" / "avatar-1024.png"
FONT_DIR = BRAND_HUB / "1-IDENTITA" / "font"
LEXEND_VAR = FONT_DIR / "Lexend-var.ttf"
INTER_XB = Path("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf")
INTER_REG = Path("/usr/share/fonts/opentype/inter/Inter-Regular.otf")
INTER_SB = Path("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf")

DEEP_SPACE = (10, 10, 26)
SHIELD_PURPLE = (124, 92, 252)
WHITE = (255, 255, 255)
MUTED = (190, 190, 210)
W, H = 1280, 800
MARGIN = 72

# ordine + label dei browser (uso nominativo)
BROWSERS = [
    ("chrome", "Chrome"),
    ("edge", "Edge"),
    ("firefox", "Firefox"),
    ("opera", "Opera"),
    ("brave", "Brave"),
    ("safari", "Safari"),
]


def font(path, size):
    try:
        return ImageFont.truetype(str(path), size)
    except Exception:
        return ImageFont.load_default()


def lexend(size, weight="ExtraBold"):
    try:
        f = ImageFont.truetype(str(LEXEND_VAR), size)
        try:
            f.set_variation_by_name(weight)
        except Exception:
            pass
        return f
    except Exception:
        return font(INTER_XB, size)


def glow(size, color, ratio=0.8, blur=140, alpha=120):
    g = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    cx, cy = size[0] // 2, size[1] // 2
    r = int(min(size) * ratio / 2)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    return g.filter(ImageFilter.GaussianBlur(blur))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--logos-dir", required=True)
    ap.add_argument("--headline", default="Works on every browser")
    ap.add_argument("--cta", default="Get it free — adoff.app")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    ldir = Path(args.logos_dir)

    img = Image.new("RGB", (W, H), DEEP_SPACE)
    g = glow((1000, 1000), SHIELD_PURPLE, ratio=0.85, blur=160, alpha=110)
    img.paste(g.convert("RGB"), (W // 2 - 500, -260), g)

    # watermark AdOff logo (obbligatorio), in basso a destra
    if LOGO_PATH.exists():
        wm = Image.open(LOGO_PATH).convert("RGBA").resize((460, 460))
        a = wm.split()[3].point(lambda v: int(v * 0.30))
        wm.putalpha(a)
        img.paste(wm, (W - 360, H - 340), wm)

    draw = ImageDraw.Draw(img)

    # wordmark AdOff in alto a sinistra
    f_wm = lexend(50, "ExtraBold")
    draw.text((MARGIN, MARGIN), "Ad", font=f_wm, fill=WHITE)
    adw = draw.textlength("Ad", font=f_wm)
    draw.text((MARGIN + adw, MARGIN), "Off", font=f_wm, fill=SHIELD_PURPLE)

    # headline centrata
    f_head = lexend(70, "ExtraBold")
    hb = draw.textbbox((0, 0), args.headline, font=f_head)
    hw = hb[2] - hb[0]
    draw.text(((W - hw) / 2, 188), args.headline, font=f_head, fill=WHITE)

    # riga loghi browser + nomi
    n = len(BROWSERS)
    logo_px = 132
    cell_w = (W - 2 * MARGIN) / n
    row_cy = 430
    f_name = font(INTER_SB, 30)
    for i, (key, label) in enumerate(BROWSERS):
        cx = MARGIN + cell_w * (i + 0.5)
        p = ldir / f"c_{key}.png"
        if p.exists():
            lg = Image.open(p).convert("RGBA")
            lg.thumbnail((logo_px, logo_px), Image.LANCZOS)
            img.paste(lg, (int(cx - lg.width / 2), int(row_cy - lg.height / 2)), lg)
        # nome sotto
        nb = draw.textbbox((0, 0), label, font=f_name)
        nw = nb[2] - nb[0]
        draw.text((cx - nw / 2, row_cy + logo_px / 2 + 18), label,
                  font=f_name, fill=MUTED)

    # subline
    f_sub = font(INTER_REG, 32)
    sub = "One ad blocker. All your browsers. Invisible to anti-adblock."
    sb = draw.textbbox((0, 0), sub, font=f_sub)
    sw = sb[2] - sb[0]
    draw.text(((W - sw) / 2, 600), sub, font=f_sub, fill=MUTED)

    # footer
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
