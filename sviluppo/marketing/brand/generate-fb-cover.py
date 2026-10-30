"""
AdOff — Facebook cover (1640x624) deterministica, brand-exact.

Stile fedele al sito (Deep Space #0a0a1a + glow viola radiale hero +
wordmark Lexend "Ad" bianco / "Off" #7c5cfc). Motivo: finestre pubblicitarie
SINTETICHE (no brand reali) con ✕ rosso che si dissolvono in particelle viola
→ "ogni pub spenta". Testo nitido (Lexend). Zero blu, brand-safe.

Safe-zone FB: soggetto centrato, angolo basso-sx alleggerito (overlay foto
profilo su mobile). Output: assets/fb-cover-1640x624.png (+ preview).
"""
from __future__ import annotations
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BRAND = Path(__file__).resolve().parent
OUT = BRAND.parent / "assets"  # reorg: asset in marketing/assets
FONT = BRAND / "fonts" / "Lexend-var.ttf"

W, H, SS = 1640, 624, 2
BG = (10, 10, 26)
MID = (18, 18, 42)
PURPLE = (124, 92, 252)
SOFT = (184, 169, 255)
WHITE = (255, 255, 255)
GREY = (138, 138, 170)
RED = (244, 63, 94)
random.seed(7)


def font(px, w=800):
    f = ImageFont.truetype(str(FONT), px)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f


def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build():
    w, h = W * SS, H * SS
    img = Image.new("RGB", (w, h), BG)
    px = img.load()
    # vertical deep-space gradient
    for y in range(h):
        c = lerp((8, 8, 20), (14, 13, 34), y / h)
        for x in range(w):
            px[x, y] = c
    # signature radial purple glow, top-center (come hero del sito)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gp = glow.load()
    cx, cy, rx, ry = w * 0.42, h * 0.20, w * 0.55, h * 0.95
    for y in range(h):
        for x in range(w):
            d = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 0.5
            if d < 1:
                a = int(70 * (1 - d) ** 1.6)
                if a: gp[x, y] = (PURPLE[0], PURPLE[1], PURPLE[2], a)
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    d = ImageDraw.Draw(img)

    def rrect(box, r, **k): d.rounded_rectangle(box, radius=r, **k)

    # ---- finestre ad sintetiche (no brand) con ✕ rosso, lato sinistro ----
    wins = [(0.045, 0.30, 0.215, 0.40, 1.0),
            (0.020, 0.58, 0.175, 0.30, 0.85),
            (0.155, 0.10, 0.165, 0.27, 0.7),
            (0.175, 0.62, 0.150, 0.26, 0.55)]
    for fx, fy, fw, fh, op in wins:
        x0, y0 = fx * w, fy * h
        x1, y1 = x0 + fw * w, y0 + fh * h
        card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        a = int(255 * op)
        cd.rounded_rectangle([x0, y0, x1, y1], radius=14 * SS,
                             fill=(MID[0], MID[1], MID[2], int(210 * op)),
                             outline=(PURPLE[0], PURPLE[1], PURPLE[2], int(150 * op)),
                             width=max(1, 2 * SS))
        # barra titolo + 3 pallini
        cd.rounded_rectangle([x0, y0, x1, y0 + 14 * SS], radius=8 * SS,
                             fill=(PURPLE[0], PURPLE[1], PURPLE[2], int(70 * op)))
        for i in range(3):
            ccx = x0 + (10 + i * 9) * SS
            cd.ellipse([ccx, y0 + 5 * SS, ccx + 5 * SS, y0 + 10 * SS],
                       fill=(SOFT[0], SOFT[1], SOFT[2], int(180 * op)))
        # contenuto fittizio (righe)
        for i in range(3):
            ly = y0 + (24 + i * 11) * SS
            cd.rounded_rectangle([x0 + 9 * SS, ly, x1 - (14 + i * 22) * SS, ly + 5 * SS],
                                 radius=3 * SS, fill=(GREY[0], GREY[1], GREY[2], int(120 * op)))
        # ✕ rosso che "spegne"
        mx, my, ms = (x0 + x1) / 2, (y0 + y1) / 2 + 6 * SS, min(fw * w, fh * h) * 0.22
        for dx in (-1, 1):
            cd.line([mx - ms, my - ms * dx, mx + ms, my + ms * dx],
                    fill=(RED[0], RED[1], RED[2], a), width=max(2, 5 * SS))
        img = Image.alpha_composite(img, card)
    d = ImageDraw.Draw(img)

    # ---- particelle viola (dissolvenza verso il centro) ----
    for _ in range(110):
        t = random.random()
        x = (0.22 + t * 0.30) * w + random.uniform(-30, 30) * SS
        y = random.uniform(0.12, 0.92) * h
        r = random.uniform(1.2, 4.5) * SS * (1.3 - t)
        col = lerp(PURPLE, SOFT, random.random())
        a = int(random.uniform(60, 170) * (1 - t * 0.5))
        ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(ov).ellipse([x - r, y - r, x + r, y + r],
                                   fill=(col[0], col[1], col[2], a))
        img = Image.alpha_composite(img, ov)
    d = ImageDraw.Draw(img)

    # ---- wordmark centrale "AdOff" (Lexend 800) ----
    cxw = w * 0.585
    fs = int(h * 0.30)
    f = font(fs, 800)
    track = -fs * 0.035
    wAd = d.textbbox((0, 0), "Ad", font=f); wAd = wAd[2] - wAd[0]
    bb = d.textbbox((0, 0), "AdOff", font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x0 = cxw - tw / 2
    y0 = h * 0.27 - bb[1]
    # glow dietro il wordmark
    gl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(gl).text((x0, y0), "AdOff", font=f,
                            fill=(PURPLE[0], PURPLE[1], PURPLE[2], 130))
    img = Image.alpha_composite(img, gl.filter(ImageFilter.GaussianBlur(14 * SS)))
    d = ImageDraw.Draw(img)
    d.text((x0, y0), "Ad", font=f, fill=WHITE)
    d.text((x0 + wAd + track, y0), "Off", font=f, fill=PURPLE)

    # ---- tagline ----
    ft = font(int(h * 0.072), 600)
    tag = "Watch anything. Read anything. Zero ads, anywhere."
    tb = d.textbbox((0, 0), tag, font=ft)
    d.text((cxw - (tb[2] - tb[0]) / 2, h * 0.555), tag, font=ft, fill=(226, 226, 240))

    # ---- chip feature (no '15-day', regola copy) ----
    chips = ["All browsers", "No tracking", "ultraleggera", "Invisible to anti-adblock"]
    fc = font(int(h * 0.050), 600)
    gap = 14 * SS
    widths = [d.textbbox((0, 0), c, font=fc)[2] + 34 * SS for c in chips]
    total = sum(widths) + gap * (len(chips) - 1)
    cx2 = cxw - total / 2
    cy2 = h * 0.70
    ch = int(h * 0.10)
    for c, cw in zip(chips, widths):
        rrect([cx2, cy2, cx2 + cw, cy2 + ch], ch / 2,
              fill=(MID[0], MID[1], MID[2], 255),
              outline=(PURPLE[0], PURPLE[1], PURPLE[2], 200), width=max(1, 2 * SS))
        tbx = d.textbbox((0, 0), c, font=fc)
        d.text((cx2 + (cw - (tbx[2] - tbx[0])) / 2, cy2 + (ch - (tbx[3] - tbx[1])) / 2 - tbx[1]),
               c, font=fc, fill=SOFT)
        cx2 += cw + gap

    out = img.convert("RGB").resize((W, H), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    out.save(OUT / "fb-cover-1640x624.png")
    out.resize((820, 312), Image.LANCZOS).save(OUT / "fb-cover-preview.png")
    print("OK: fb-cover-1640x624.png + preview")


if __name__ == "__main__":
    build()
