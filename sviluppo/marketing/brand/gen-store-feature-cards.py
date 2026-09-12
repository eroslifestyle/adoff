#!/usr/bin/env python3
"""Compose professional branded feature-cards for store/SaaSHub from REAL product
screenshots. The UI stays the real screenshot (truthful); we add a brand background,
a browser-window frame, a Lexend headline and the AdOff logo.

Brand: Deep Space #0a0a1a · Shield Purple #7c5cfc · white. Font: Lexend.
Output: BRAND-HUB/5-SCREENSHOT-STORE/pro/  (inside the project).
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]  # .../sviluppo
HUB = ROOT / "marketing" / "BRAND-HUB"
SHOTS = HUB / "5-SCREENSHOT-STORE"
OUT = SHOTS / "pro"
OUT.mkdir(parents=True, exist_ok=True)
FONT_DIR = HUB / "1-IDENTITA" / "font"
LOGO = HUB / "2-LOGHI" / "avatar-512.png"

W, H = 1280, 800
DEEP = (10, 10, 26)
PURPLE = (124, 92, 252)
WHITE = (255, 255, 255)
MUTED = (170, 175, 200)


def font(name, size):
    return ImageFont.truetype(str(FONT_DIR / name), size)


def gradient_bg():
    bg = Image.new("RGB", (W, H), DEEP)
    px = bg.load()
    for y in range(H):
        t = y / H
        r = int(DEEP[0] + (22 - DEEP[0]) * t)
        g = int(DEEP[1] + (16 - DEEP[1]) * t)
        b = int(DEEP[2] + (46 - DEEP[2]) * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    # radial purple glow top-left
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-260, -360, 760, 460], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    tint = Image.new("RGB", (W, H), PURPLE)
    bg = Image.composite(tint, bg, glow.point(lambda v: int(v * 0.55)))
    return bg


def rounded(img, rad):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], rad, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def browser_frame(shot, fw):
    """Wrap a screenshot in a mac-style window; return RGBA at width fw."""
    ar = shot.height / shot.width
    iw, ih = fw, int(fw * ar)
    shot = shot.convert("RGB").resize((iw, ih), Image.LANCZOS)
    bar = 46
    frame = Image.new("RGB", (iw, ih + bar), (26, 27, 38))
    d = ImageDraw.Draw(frame)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([22 + i * 26, bar // 2 - 7, 36 + i * 26, bar // 2 + 7], fill=c)
    frame.paste(shot, (0, bar))
    return rounded(frame, 18)


def shadow(size, rad, blur=42, alpha=150):
    s = Image.new("RGBA", (size[0] + blur * 3, size[1] + blur * 3), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle(
        [blur * 1.5, blur * 1.5, blur * 1.5 + size[0], blur * 1.5 + size[1]], rad, fill=(0, 0, 0, alpha))
    return s.filter(ImageFilter.GaussianBlur(blur))


def make(shot_path, headline, sub, out_name):
    bg = gradient_bg()
    d = ImageDraw.Draw(bg)
    # official AdOff mark top-right (single brand mark; in-screenshot badge is bottom)
    mlogo = Image.open(LOGO).convert("RGBA").resize((56, 56), Image.LANCZOS)
    mf = font("Lexend-Bold.ttf", 30)
    mtw = d.textlength("AdOff", font=mf)
    bg.paste(mlogo, (W - 56 - 44, 52), mlogo)
    d.text((W - 56 - 44 - 12 - mtw, 66), "AdOff", font=mf, fill=WHITE)
    # headline
    hf = font("Lexend-ExtraBold.ttf", 60)
    d.text((70, 64), headline, font=hf, fill=WHITE)
    sf = font("Lexend-Bold.ttf", 26)
    d.text((72, 150), sub, font=sf, fill=PURPLE)
    # framed screenshot (sized to fit the canvas with bottom margin)
    shot = Image.open(shot_path)
    frame = browser_frame(shot, 720)
    fx = (W - frame.width) // 2
    fy = 210 + (560 - frame.height) // 2
    sh = shadow(frame.size, 18)
    bg.paste(sh, (fx - (sh.width - frame.width) // 2, fy - (sh.height - frame.height) // 2 + 16), sh)
    bg.paste(frame, (fx, fy), frame)
    # NB: no extra logo/wordmark — the real screenshot already carries AdOff
    # branding and the store lists the logo around the card. One mark only.
    out = OUT / out_name
    bg.save(out, "PNG")
    print("OK", out)


def make_wall(logos, headline, sub, out_name, cell=150, gap=58, chips=False):
    """Branded 'logo wall' card: AdOff mark + headline + a centered row of real
    third-party logos with labels. logos = list of (path, label)."""
    bg = gradient_bg()
    d = ImageDraw.Draw(bg)
    # AdOff mark top-center (single brand mark)
    logo = Image.open(LOGO).convert("RGBA").resize((58, 58), Image.LANCZOS)
    wf = font("Lexend-Bold.ttf", 30)
    wtxt_w = d.textlength("AdOff", font=wf)
    block_w = 58 + 12 + wtxt_w
    bx = (W - block_w) // 2
    bg.paste(logo, (int(bx), 64), logo)
    d.text((bx + 58 + 12, 80), "AdOff", font=wf, fill=WHITE)
    # headline + subtitle centered
    hf = font("Lexend-ExtraBold.ttf", 58)
    hw = d.textlength(headline, font=hf)
    d.text(((W - hw) // 2, 190), headline, font=hf, fill=WHITE)
    sf = font("Lexend-Bold.ttf", 27)
    sw = d.textlength(sub, font=sf)
    d.text(((W - sw) // 2, 280), sub, font=sf, fill=PURPLE)
    # logo row
    n = len(logos)
    total = n * cell + (n - 1) * gap
    x0 = (W - total) // 2
    y0 = 410
    lf = font("Lexend-Bold.ttf", 23)
    for i, (path, label) in enumerate(logos):
        cx = x0 + i * (cell + gap)
        if chips:
            # light rounded chip so any logo colour stays visible
            sh = shadow((cell, cell), 26, blur=24, alpha=110)
            bg.paste(sh, (cx - (sh.width - cell) // 2, y0 - (sh.height - cell) // 2 + 10), sh)
            chip = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
            ImageDraw.Draw(chip).rounded_rectangle([0, 0, cell, cell], 26, fill=(245, 246, 250, 255))
            bg.paste(chip, (cx, y0), chip)
            inner = int(cell * 0.62)
            im = Image.open(path).convert("RGBA")
            im.thumbnail((inner, inner), Image.LANCZOS)
            bg.paste(im, (cx + (cell - im.width) // 2, y0 + (cell - im.height) // 2), im)
        else:
            im = Image.open(path).convert("RGBA")
            im.thumbnail((cell, cell), Image.LANCZOS)
            bg.paste(im, (cx + (cell - im.width) // 2, y0 + (cell - im.height) // 2), im)
        lw = d.textlength(label, font=lf)
        d.text((cx + (cell - lw) // 2, y0 + cell + 22), label, font=lf, fill=(210, 214, 235))
    out = OUT / out_name
    bg.save(out, "PNG")
    print("OK", out)


if __name__ == "__main__":
    import sys
    BL = HUB / "3-IMMAGINI-SOCIAL" / "_assets" / "browser-logos"
    PL = HUB / "3-IMMAGINI-SOCIAL" / "banners-sponsored" / "logos"
    if "wall" in sys.argv or "browsers" in sys.argv:
        make_wall(
            [(BL / "c_chrome.png", "Chrome"), (BL / "c_edge.png", "Edge"),
             (BL / "c_brave.png", "Brave"), (BL / "c_opera.png", "Opera"),
             (BL / "c_firefox.png", "Firefox"), (BL / "c_safari.png", "Safari")],
            "Works on every browser.", "One ad blocker, all your browsers",
            "pro_browsers.png", cell=140, gap=52)
    if "wall" in sys.argv or "streaming" in sys.argv:
        make_wall(
            [(PL / "youtube.png", "YouTube"), (PL / "twitch.png", "Twitch"),
             (PL / "vimeo.png", "Vimeo"), (PL / "dailymotion.png", "Dailymotion")],
            "Ads off — even on streaming.", "Video pre-roll neutralized across platforms",
            "pro_streaming.png", cell=170, gap=80, chips=True)
    if len(sys.argv) > 1 and sys.argv[1] in ("wall", "browsers", "streaming"):
        raise SystemExit
    cards = [
        ("screenshot2_before_after.png", "Every ad, gone.", "On every website — instantly", "pro_before_after.png"),
        ("screenshot4_video.png", "Video ads? Off.", "Pre-roll neutralized at the SDK level", "pro_video.png"),
        ("screenshot5_stealth.png", "Invisible to anti-adblock.", "Stealth Mode keeps the blocker hidden", "pro_stealth.png"),
        ("screenshot3_popup.png", "Block. Count. Control.", "Real-time counters and per-site controls", "pro_popup.png"),
    ]
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for sp, h, s, o in cards:
        if only and only not in o:
            continue
        make(SHOTS / sp, h, s, o)
