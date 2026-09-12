#!/usr/bin/env python3
"""Genera 5 banner placeholder AdOff 965x88 (BMP, <2MB) con scritta "SPONSORED AD".

Pipeline: sfondo via shim OmniaStudio (flux2) -> resize-cover 965x88 ->
tint brand Deep Space -> composizione logo + headline + label "SPONSORED AD" ->
export BMP 24-bit. Fallback gradiente procedurale se lo shim non risponde.

Brand: Deep Space #0a0a1a / Shield Purple #7c5cfc / white; font Lexend.
Asset brand-policy: nessun nome/logo di terze parti nelle immagini.
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[3]            # .../ChromePlugin
MARKETING = ROOT / "sviluppo" / "marketing"
sys.path.insert(0, str(MARKETING / "video-engine"))
import omnia_shim  # noqa: E402

OUT_DIR = MARKETING / "BRAND-HUB" / "3-IMMAGINI-SOCIAL" / "banners-sponsored"
OUT_DIR.mkdir(parents=True, exist_ok=True)
BG_DIR = OUT_DIR / "_bg"
BG_DIR.mkdir(exist_ok=True)

# I .ttf statici (Bold/ExtraBold) sono stub 404 rotti: si usa il variable font.
FONT_VAR = str(MARKETING / "video-engine" / "public" / "Lexend-var.ttf")
F_XBOLD = "ExtraBold"
F_BOLD = "Bold"
LOGO = MARKETING / "BRAND-HUB" / "2-LOGHI" / "avatar-1024.png"

W, H = 965, 88
DEEP = (10, 10, 26)        # #0a0a1a
PURPLE = (124, 92, 252)    # #7c5cfc
WHITE = (245, 245, 250)

STYLE = ("abstract premium tech background, deep space dark navy base color, "
         "glowing violet purple accents, subtle geometric shield motif, soft "
         "bokeh light, cinematic gradient, minimal, ultra-wide horizontal "
         "composition, high detail, no text, no words, no logos")
NEG = ("text, words, letters, typography, watermark, logo, brand logo, ui "
       "clutter, people, faces, low quality, blurry, jpeg artifacts")

BANNERS = [
    dict(key="01-video", headline="Skip Every Video Ad", sub="",
         prompt="floating holographic video play-button icons dissolving into "
                "glowing particles, motion streak lines, " + STYLE),
    dict(key="02-streaming", headline="Zero Ads on Streaming", sub="",
         prompt="stacked translucent video stream frames fading away, signal "
                "waves, flowing energy ribbons, " + STYLE),
    dict(key="03-browsers", headline="Works on Every Browser",
         sub="Chrome   Firefox   Safari   Edge   Opera",
         prompt="five glowing abstract rounded window frame outlines aligned "
                "in a row, connected light nodes, network lines, " + STYLE),
    dict(key="04-tagline", headline="Ads? Off.", sub="",
         prompt="a glowing power toggle switch turning off, hexagon shield "
                "emblem, energy dissipating into sparks, " + STYLE),
    dict(key="05-adfree", headline="Browse 100% Ad-Free", sub="",
         prompt="clean empty glowing rectangular slots softly crossed out, "
                "sparkles of clarity, calm flowing gradient, " + STYLE),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_VAR, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:                            # noqa: BLE001
        pass
    return f


def gen_bg(b: dict) -> Image.Image:
    cache = BG_DIR / f"{b['key']}.png"
    if cache.is_file():
        return Image.open(cache).convert("RGB")
    try:
        print(f"  flux2 -> {b['key']} ...", flush=True)
        data = omnia_shim.image(b["prompt"], aspect_ratio="16:9",
                                endpoint="flux2", negative_prompt=NEG,
                                timeout_s=300)
        cache.write_bytes(data)
        return Image.open(cache).convert("RGB")
    except Exception as e:                       # noqa: BLE001
        print(f"  ! flux2 fallito ({e}); gradiente procedurale", flush=True)
        return procedural_bg(b)


def procedural_bg(b: dict) -> Image.Image:
    img = Image.new("RGB", (W, H), DEEP)
    px = img.load()
    for x in range(W):
        t = x / W
        for y in range(H):
            ty = y / H
            r = int(DEEP[0] + (PURPLE[0] - DEEP[0]) * (t * 0.55 * (1 - ty * 0.4)))
            g = int(DEEP[1] + (PURPLE[1] - DEEP[1]) * (t * 0.45))
            bl = int(DEEP[2] + (PURPLE[2] - DEEP[2]) * (0.35 + t * 0.4))
            px[x, y] = (min(r, 255), min(g, 255), min(bl, 255))
    return img


def cover_resize(src: Image.Image) -> Image.Image:
    sw, sh = src.size
    scale = max(W / sw, H / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    src = src.resize((nw, nh), Image.LANCZOS)
    left = (nw - W) // 2
    top = (nh - H) // 2
    return src.crop((left, top, left + W, top + H))


def brand_tint(bg: Image.Image) -> Image.Image:
    bg = ImageEnhance.Brightness(bg).enhance(0.62)
    bg = ImageEnhance.Color(bg).enhance(1.05)
    # vignette/gradient verso Deep Space sul lato sinistro (zona testo)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for x in range(W):
        a = int(210 * max(0, 1 - x / (W * 0.72)))   # piu' scuro a sinistra
        od.line([(x, 0), (x, H)], fill=(DEEP[0], DEEP[1], DEEP[2], a))
    out = Image.alpha_composite(bg.convert("RGBA"), overlay)
    return out.convert("RGB")


def add_logo(img: Image.Image) -> int:
    """Logo a sinistra; ritorna x dove inizia il testo."""
    pad = 14
    target_h = H - pad * 2 + 8
    logo = Image.open(LOGO).convert("RGBA")
    lw, lh = logo.size
    scale = target_h / lh
    logo = logo.resize((int(lw * scale), target_h), Image.LANCZOS)
    ly = (H - logo.size[1]) // 2
    img.paste(logo, (pad, ly), logo)
    return pad + logo.size[0] + 18


def draw_sponsored_label(draw: ImageDraw.ImageDraw) -> int:
    """Pill 'SPONSORED AD' in alto a destra; ritorna x sinistro della pill."""
    txt = "SPONSORED AD"
    f = font(F_BOLD, 12)
    bb = draw.textbbox((0, 0), txt, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    padx, pady = 9, 4
    bw, bh = tw + padx * 2, th + pady * 2
    bx = W - bw - 12
    by = 8
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 2,
                           fill=(255, 255, 255, 235))
    draw.text((bx + padx - bb[0], by + pady - bb[1]), txt, font=f,
              fill=(18, 14, 40))
    return bx


def fit_font(draw, text, path, max_w, start, min_size=18):
    size = start
    while size > min_size:
        f = font(path, size)
        bb = draw.textbbox((0, 0), text, font=f)
        if bb[2] - bb[0] <= max_w:
            return f
        size -= 1
    return font(path, min_size)


def compose(b: dict) -> Path:
    bg = cover_resize(gen_bg(b))
    img = brand_tint(bg)
    draw = ImageDraw.Draw(img, "RGBA")
    text_x = add_logo(img)
    label_x = draw_sponsored_label(draw)
    avail_w = label_x - text_x - 16

    has_sub = bool(b["sub"])
    head_size = 34 if not has_sub else 28
    fhead = fit_font(draw, b["headline"], F_XBOLD, avail_w, head_size)
    hb = draw.textbbox((0, 0), b["headline"], font=fhead)
    hh = hb[3] - hb[1]

    if has_sub:
        fsub = fit_font(draw, b["sub"], F_BOLD, avail_w, 15, 11)
        sb = draw.textbbox((0, 0), b["sub"], font=fsub)
        sh = sb[3] - sb[1]
        gap = 7
        total = hh + gap + sh
        ty = (H - total) // 2 - hb[1]
        draw.text((text_x, ty), b["headline"], font=fhead, fill=WHITE)
        sy = ty + hb[1] + hh + gap - sb[1]
        draw.text((text_x, sy), b["sub"], font=fsub, fill=PURPLE)
    else:
        ty = (H - hh) // 2 - hb[1]
        # accento viola: una piccola barra a sinistra del titolo
        bar_h = hh + 8
        draw.rounded_rectangle(
            [text_x, (H - bar_h) // 2, text_x + 5, (H + bar_h) // 2],
            radius=2, fill=PURPLE)
        tx = text_x + 14
        draw.text((tx, ty), b["headline"], font=fhead, fill=WHITE)

    final = img.convert("RGB")
    out = OUT_DIR / f"adoff-sponsored-{b['key']}.bmp"
    final.save(out, format="BMP")
    # PNG anteprima per controllo veloce
    final.save(OUT_DIR / f"adoff-sponsored-{b['key']}.png", format="PNG")
    return out


def main():
    print(f"Output: {OUT_DIR}")
    results = []
    for b in BANNERS:
        print(f"[{b['key']}] {b['headline']}")
        out = compose(b)
        sz = out.stat().st_size
        with Image.open(out) as im:
            dims = im.size
        flag = "OK" if (dims == (W, H) and sz < 2 * 1024 * 1024) else "CHECK"
        print(f"  -> {out.name}  {dims[0]}x{dims[1]}  {sz/1024:.1f} KB  [{flag}]")
        results.append((out, dims, sz))
    print("\nFatto:", len(results), "banner")


if __name__ == "__main__":
    main()
