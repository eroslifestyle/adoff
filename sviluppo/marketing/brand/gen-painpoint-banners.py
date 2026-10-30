#!/usr/bin/env python3
"""5 banner AdOff 965x88 pain-point driven (BMP <2MB) per pubblico non esperto.

Stile (memoria feedback_comm_style_painpoint): tono empatico/sfogo, messaggio
chiaro + sottotitolo che spiega cosa fa AdOff, CTA varie sempre "free", loghi
reali a colori delle piattaforme/browser. Sfondo brand PULITO (max leggibilita').
Brand: Deep Space #0a0a1a / Shield Purple #7c5cfc / white; font Lexend.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
MK = ROOT / "sviluppo" / "marketing"
OUT = MK / "BRAND-HUB" / "3-IMMAGINI-SOCIAL" / "banners-sponsored"
LOGOS = OUT / "logos"
FONT_VAR = str(MK / "video-engine" / "public" / "Lexend-var.ttf")
ADOFF_LOGO = MK / "BRAND-HUB" / "2-LOGHI" / "avatar-1024.png"

W, H = 965, 88
DEEP = (10, 10, 26)
DEEP2 = (22, 20, 48)
PURPLE = (124, 92, 252)
PURPLE_HI = (157, 132, 255)
WHITE = (246, 246, 251)
MUTED = (176, 178, 204)

BANNERS = [
    dict(key="01-video",
         head="Tired of ads ruining every video?",
         sub="AdOff removes video ads automatically — you just press play.",
         cta="Watch Ad-Free — Free",
         logos=["youtube", "twitch", "vimeo", "dailymotion"]),
    dict(key="02-popups",
         head="Pop-ups & scam ads driving you crazy?",
         sub="AdOff blocks pop-ups, fake buttons & scams before they appear.",
         cta="Get Protected — Free",
         logos=["__warn__", "__popup__", "__shield__"]),
    dict(key="03-tracking",
         head="Sick of being followed across the web?",
         sub="AdOff stops the ads & trackers that spy on what you do.",
         cta="Stay Private — Free",
         logos=["facebook", "instagram", "tiktok", "x"]),
    dict(key="04-browsers",
         head="Whatever browser you use — ads gone.",
         sub="Works on Chrome, Firefox, Safari, Edge & Opera. One click.",
         cta="Add It — Free",
         logos=["chrome", "firefox", "safari", "edge", "opera"]),
    dict(key="05-allinone",
         head="Ads. Pop-ups. Trackers. Gone for good.",
         sub="The all-in-one ad blocker that just works, everywhere.",
         cta="Install Now — Free",
         logos=["youtube", "chrome", "facebook", "tiktok"]),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_VAR, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:                                    # noqa: BLE001
        pass
    return f


def tw(draw, text, fnt):
    b = draw.textbbox((0, 0), text, font=fnt)
    return b[2] - b[0], b[3] - b[1], b


def fit(draw, text, weight, max_w, start, lo=12):
    s = start
    while s > lo:
        f = font(weight, s)
        if tw(draw, text, f)[0] <= max_w:
            return f
        s -= 1
    return font(weight, lo)


def make_bg() -> Image.Image:
    """Sfondo brand pulito: gradiente Deep Space + glow viola morbido a destra."""
    img = Image.new("RGB", (W, H), DEEP)
    px = img.load()
    for x in range(W):
        t = x / W
        for y in range(H):
            ty = abs(y - H / 2) / (H / 2)
            base = [DEEP[i] + (DEEP2[i] - DEEP[i]) * (0.35 + 0.65 * t) * (1 - 0.35 * ty)
                    for i in range(3)]
            px[x, y] = (int(base[0]), int(base[1]), int(base[2]))
    # glow viola radiale (dietro logo-zona/CTA, lato destro)
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.6, -H, W * 1.05, H * 2], fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    tint = Image.new("RGB", (W, H), PURPLE)
    img = Image.composite(tint, img, glow.point(lambda v: int(v * 0.45)))
    # barra accento in basso
    d = ImageDraw.Draw(img)
    d.rectangle([0, H - 3, W, H], fill=PURPLE)
    return img


def logo_chip(name: str, size: int) -> Image.Image:
    """Logo reale su chip bianco arrotondato (leggibile su sfondo scuro)."""
    chip = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(chip)
    r = size // 4
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r,
                        fill=(255, 255, 255, 255))
    pad = max(4, size // 6)
    inner = size - pad * 2
    fp = LOGOS / f"{name}.png"
    logo = Image.open(fp).convert("RGBA").resize((inner, inner), Image.LANCZOS)
    chip.paste(logo, (pad, pad), logo)
    return chip


def shield_icon(size: int) -> Image.Image:
    """Icona scudo viola con check (per banner pop-up/truffe, niente brand)."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = s // 8
    pts = [(s / 2, m), (s - m, m + s * 0.18), (s - m, s * 0.55),
           (s / 2, s - m), (m, s * 0.55), (m, m + s * 0.18)]
    d.polygon(pts, fill=PURPLE)
    # check bianco
    d.line([(s * 0.33, s * 0.5), (s * 0.45, s * 0.63), (s * 0.68, s * 0.34)],
           fill=WHITE, width=max(3, s // 12), joint="curve")
    return img


def warn_icon(size: int) -> Image.Image:
    """Triangolo di avviso giallo con '!' (pubblicita' ingannevole/truffa)."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = s // 8
    d.polygon([(s / 2, m), (s - m, s - m), (m, s - m)], fill=(255, 196, 0))
    d.line([(s / 2, s * 0.38), (s / 2, s * 0.66)], fill=(30, 24, 10),
           width=max(3, s // 11))
    d.ellipse([s / 2 - s * 0.05, s * 0.72, s / 2 + s * 0.05, s * 0.82],
              fill=(30, 24, 10))
    return img


def popup_icon(size: int) -> Image.Image:
    """Finestra pop-up bloccata (bordo rosso + X) su chip bianco."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 4, fill=(255, 255, 255, 255))
    pad = s // 5
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=s // 12,
                        outline=(231, 76, 60), width=max(2, s // 16))
    d.line([(pad + s * 0.08, pad + s * 0.08), (s - pad - s * 0.08, s - pad - s * 0.08)],
           fill=(231, 76, 60), width=max(2, s // 16))
    return img


def paste_adoff(img):
    pad = 12
    target_h = 50
    logo = Image.open(ADOFF_LOGO).convert("RGBA")
    sc = target_h / logo.size[1]
    logo = logo.resize((int(logo.size[0] * sc), target_h), Image.LANCZOS)
    img.paste(logo, (pad, (H - target_h) // 2), logo)
    return pad + logo.size[0] + 16


def draw_label(draw):
    txt = "SPONSORED AD"
    f = font("Bold", 10)
    w, h, b = tw(draw, txt, f)
    px, py = 7, 3
    bw, bh = w + px * 2, h + py * 2
    bx, by = W - bw - 11, 6
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 2,
                           fill=(8, 6, 20, 175))
    draw.text((bx + px - b[0], by + py - b[1]), txt, font=f, fill=(208, 206, 226))
    return bx


def draw_cta(img, draw, text):
    f = font("ExtraBold", 16)
    w, h, b = tw(draw, text, f)
    px, py = 18, 11
    bw, bh = w + px * 2, h + py * 2
    bx = W - bw - 14
    by = (H - bh) // 2 + 4
    # ombra + bottone pill viola
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([bx, by + 2, bx + bw, by + bh + 2],
                                         radius=bh // 2, fill=(0, 0, 0, 90))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4)))
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 2, fill=PURPLE)
    draw.text((bx + px - b[0], by + py - b[1]), text, font=f, fill=WHITE)
    return bx


def compose(bn: dict) -> Path:
    img = make_bg().convert("RGBA")
    draw = ImageDraw.Draw(img)
    text_x = paste_adoff(img)
    draw_label(draw)
    cta_x = draw_cta(img, draw, bn["cta"])

    # zona loghi: subito a sinistra della CTA
    chip = 34
    gap = 9
    names = bn["logos"]
    n = len(names)
    zone_w = n * chip + (n - 1) * gap
    lx = cta_x - 18 - zone_w
    ly = (H - chip) // 2
    drawn = {"__shield__": shield_icon, "__warn__": warn_icon,
             "__popup__": popup_icon}
    for i, nm in enumerate(names):
        ico = drawn[nm](chip) if nm in drawn else logo_chip(nm, chip)
        img.alpha_composite(ico, (lx + i * (chip + gap), ly))

    # testo: headline + sub, a sinistra fino ai loghi
    avail = lx - 14 - text_x
    fhead = fit(draw, bn["head"], "ExtraBold", avail, 23, 16)
    _, hh, hb = tw(draw, bn["head"], fhead)
    fsub = fit(draw, bn["sub"], "Medium", avail, 14, 11)
    _, sh, sbb = tw(draw, bn["sub"], fsub)
    gapv = 8
    total = hh + gapv + sh
    top = (H - total) // 2
    draw.text((text_x, top - hb[1]), bn["head"], font=fhead, fill=WHITE)
    sy = top + hh + gapv - sbb[1]
    draw.text((text_x, sy), bn["sub"], font=fsub, fill=MUTED)

    final = img.convert("RGB")
    bmp = OUT / f"adoff-banner-{bn['key']}.bmp"
    final.save(bmp, format="BMP")
    final.save(OUT / f"adoff-banner-{bn['key']}.png", format="PNG")
    return bmp


def main():
    for old in OUT.glob("adoff-sponsored-*"):          # rimuovi i vecchi generici
        old.unlink()
    for bn in BANNERS:
        bmp = compose(bn)
        sz = bmp.stat().st_size
        with Image.open(bmp) as im:
            dims = im.size
        ok = "OK" if dims == (W, H) and sz < 2 * 1024 * 1024 else "CHECK"
        print(f"{bmp.name:34s} {dims[0]}x{dims[1]} {sz/1024:6.1f}KB [{ok}]")


if __name__ == "__main__":
    main()
