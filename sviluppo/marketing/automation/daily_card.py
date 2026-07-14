#!/usr/bin/env python3
"""Card giornaliera brandizzata per i post delle 20:00 su @adoffapp.

Ogni tema del rotation (telegram_daily_post.THEMES) ha il proprio visual
geometrico + headline dedicata; la composizione varia ogni giorno (seed
dalla data: posizione glow, tinta accent nel range viola, variante
headline) cosi' nessuna card e' identica alla precedente.

Brand-identity locked (project_brand_identity): Deep Space #0a0a1a,
Shield Purple #7c5cfc, Pure White. Font Lexend var (headline) + Inter
(body) + DejaVu Mono (numeri). Logo watermark obbligatorio
(BRAND-HUB/2-LOGHI/avatar-1024.png).

Uso CLI (test):
  python3 daily_card.py --theme stealth --out /tmp/card.png [--seed 42]
Uso da telegram_daily_post.py:
  from daily_card import build_card
  path, headline = build_card("stealth", facts, "/tmp/adoff_daily.png")
"""
import argparse
import hashlib
import math
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]  # automation→marketing→sviluppo→ChromePlugin
BRAND_HUB = ROOT / "sviluppo" / "marketing" / "BRAND-HUB"
LOGO_PATH = BRAND_HUB / "2-LOGHI" / "avatar-1024.png"
FONT_DIR = BRAND_HUB / "1-IDENTITA" / "font"

DEEP_SPACE = (10, 10, 26)
SHIELD_PURPLE = (124, 92, 252)
WHITE = (255, 255, 255)
MUTED = (176, 176, 200)
DANGER = (255, 92, 92)
OK_GREEN = (94, 222, 160)

W, H = 1280, 800
MARGIN = 72
ICON_CX, ICON_CY = W - 330, 330       # centro area icona (colonna destra)

LEXEND_VAR = FONT_DIR / "Lexend-var.ttf"
INTER_XB = Path("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf")
INTER_REG = Path("/usr/share/fonts/opentype/inter/Inter-Regular.otf")
INTER_SB = Path("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf")
MONO = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")

# ─── Visual per tema: headline (varianti ruotate), subline, icona ─────────────
THEME_VISUALS = {
    "stealth": {
        "headlines": ["Invisible by design", "They can't see us coming",
                      "Anti-adblock walls? Walked through"],
        "sub": "Stealth layer — undetectable to anti-adblock systems",
        "icon": "stealth",
    },
    "video-ads": {
        "headlines": ["Video ads? Skipped.", "Zero pre-rolls. Zero waiting.",
                      "Your video starts NOW"],
        "sub": "Pre-roll & mid-roll neutralized — player keeps working",
        "icon": "video",
    },
    "privacy": {
        "headlines": ["Zero data collected", "Your browsing stays yours",
                      "No tracking. No telemetry."],
        "sub": "Privacy-first ad blocking — no account needed",
        "icon": "privacy",
    },
    "universal": {
        "headlines": ["Every site. One shield.", "Blocks ads everywhere",
                      "{network_rules}+ rules, {blocking_layers} layers"],
        "sub": "{network_rules}+ network rules across {blocking_layers} protection layers",
        "icon": "universal",
    },
    "lightweight": {
        "headlines": ["Featherweight. Full power.", "Fast pages, clean pages",
                      "Built light on Manifest V3"],
        "sub": "Minimal CPU & RAM footprint — zero slowdown",
        "icon": "lightweight",
    },
    "multi-browser": {
        "headlines": ["One blocker, {supported_browsers} browsers",
                      "Same shield, every browser"],
        "sub": "Chrome · Firefox · Edge · Opera · Brave — Safari soon",
        "icon": "browsers",
    },
    "trial-value": {
        "headlines": ["{trial_days} days of Pro. Free.", "Try Pro free for {trial_days} days"],
        "sub": "Then just {monthly} EUR/month — core blocking free forever",
        "icon": "trial",
    },
    "vs-ublock": {
        "headlines": ["Built to just work", "No setup. No detection."],
        "sub": "AdOff vs uBlock Origin — the invisible alternative",
        "icon": "versus",
    },
    "vs-abp": {
        "headlines": ["No 'acceptable ads'. Ever.", "No paid whitelists here"],
        "sub": "AdOff vs AdBlock Plus — blocks everything, no exceptions",
        "icon": "versus",
    },
    "vs-adguard": {
        "headlines": ["Effortless. Invisible. Free core.", "Zero-config protection"],
        "sub": "AdOff vs AdGuard — stealth-first, privacy-first",
        "icon": "versus",
    },
    "feature-pause": {
        "headlines": ["Pause it. Support a creator.", "One click to whitelist"],
        "sub": "Per-site pause that re-enables itself — you stay in control",
        "icon": "pause",
    },
    "feature-counter": {
        "headlines": ["Watch the ads pile up. Blocked.", "Proof it's working"],
        "sub": "Live counter of every real ad AdOff stopped",
        "icon": "counter",
    },
}
DEFAULT_VISUAL = {
    "headlines": ["Ads? Off!"],
    "sub": "The invisible ad blocker",
    "icon": "stealth",
}


# ─── Font helpers (come release_card) ─────────────────────────────────────────
def _font(path, size):
    try:
        return ImageFont.truetype(str(path), size)
    except Exception:
        return ImageFont.load_default()


def _lexend(size, weight="ExtraBold"):
    try:
        f = ImageFont.truetype(str(LEXEND_VAR), size)
        try:
            f.set_variation_by_name(weight)
        except Exception:
            pass
        return f
    except Exception:
        return _font(INTER_XB, size)


def _glow_layer(color, radius, blur=120, alpha=120):
    pad = radius + blur
    side = pad * 2
    layer = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([pad - radius, pad - radius, pad + radius, pad + radius],
              fill=color + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(radius=blur))


def _paste_glow(img, color, cx, cy, radius, blur=120, alpha=120):
    g = _glow_layer(color, radius, blur, alpha)
    # paste con mask (non alpha_composite): supporta coordinate negative
    img.paste(g, (cx - g.size[0] // 2, cy - g.size[1] // 2), g)


def _shift_purple(seed_byte):
    """Accent leggermente variato giorno per giorno restando nel range brand."""
    dr = (seed_byte % 31) - 15            # ±15 su rosso/blu, viola resta viola
    r = max(96, min(160, SHIELD_PURPLE[0] + dr))
    b = max(225, min(255, SHIELD_PURPLE[2] - dr // 2))
    return (r, SHIELD_PURPLE[1], b)


# ─── Icone geometriche (tutte dentro un box ~440px centrato su cx,cy) ─────────
def _shield_pts(cx, cy, s):
    return [(cx, cy - s), (cx + s * 0.86, cy - s * 0.62), (cx + s * 0.86, cy + s * 0.18),
            (cx, cy + s), (cx - s * 0.86, cy + s * 0.18), (cx - s * 0.86, cy - s * 0.62)]


def icon_stealth(d, cx, cy, accent):
    # scudo "che svanisce": 3 outline a opacita' decrescente + check pieno
    for i, (off, alpha) in enumerate([(64, 36), (32, 90), (0, 255)]):
        col = accent + (alpha,)
        d.polygon(_shield_pts(cx + off, cy, 190), outline=col, width=10)
    d.line([(cx - 70, cy + 5), (cx - 15, cy + 65), (cx + 85, cy - 70)],
           fill=WHITE + (255,), width=20, joint="curve")


def icon_video(d, cx, cy, accent):
    # player + play; tag "AD" barrato in alto a sinistra (il logo sta in alto a dx)
    d.rounded_rectangle([cx - 200, cy - 140, cx + 200, cy + 140], radius=36,
                        outline=accent + (255,), width=10)
    d.polygon([(cx - 45, cy - 65), (cx - 45, cy + 65), (cx + 75, cy)],
              fill=WHITE + (255,))
    bx, by = cx - 130, cy - 200
    d.rounded_rectangle([bx - 64, by - 34, bx + 64, by + 34], radius=16,
                        fill=DANGER + (255,))
    f = _lexend(40, "ExtraBold")
    tw = d.textlength("AD", font=f)
    d.text((bx - tw / 2, by - 28), "AD", font=f, fill=WHITE + (255,))
    d.line([(bx - 70, by + 38), (bx + 70, by - 38)], fill=WHITE + (255,), width=12)


def icon_privacy(d, cx, cy, accent):
    # lucchetto
    d.arc([cx - 105, cy - 215, cx + 105, cy + 5], start=180, end=360,
          fill=accent + (255,), width=22)
    d.rounded_rectangle([cx - 150, cy - 95, cx + 150, cy + 145], radius=34,
                        fill=accent + (255,))
    d.ellipse([cx - 26, cy - 22, cx + 26, cy + 30], fill=DEEP_SPACE + (255,))
    d.rounded_rectangle([cx - 12, cy + 10, cx + 12, cy + 88], radius=10,
                        fill=DEEP_SPACE + (255,))


def icon_universal(d, cx, cy, accent):
    # globo a meridiani
    r = 175
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=accent + (255,), width=10)
    d.ellipse([cx - r * 0.45, cy - r, cx + r * 0.45, cy + r],
              outline=accent + (170,), width=7)
    d.line([(cx - r, cy), (cx + r, cy)], fill=accent + (170,), width=7)
    for fy in (-0.5, 0.5):
        yy = cy + r * fy
        half = r * math.sqrt(1 - fy * fy)
        d.line([(cx - half, yy), (cx + half, yy)], fill=accent + (140,), width=6)
    d.polygon(_shield_pts(cx + r * 0.62, cy + r * 0.62, 78), fill=accent + (255,))
    d.line([(cx + r * 0.62 - 30, cy + r * 0.62), (cx + r * 0.62 - 8, cy + r * 0.62 + 26),
            (cx + r * 0.62 + 34, cy + r * 0.62 - 28)], fill=WHITE + (255,), width=10)


def icon_lightweight(d, cx, cy, accent):
    # fulmine bold
    pts = [(cx + 30, cy - 190), (cx - 110, cy + 30), (cx - 15, cy + 30),
           (cx - 45, cy + 190), (cx + 115, cy - 40), (cx + 15, cy - 40)]
    d.polygon(pts, fill=accent + (255,))
    for i in range(3):
        y = cy - 60 + i * 60
        d.line([(cx - 230, y), (cx - 150 - i * 18, y)], fill=MUTED + (150,), width=10)


def icon_browsers(d, cx, cy, accent):
    # 5 sfere-browser generiche + anello shield al centro
    cols = [(66, 133, 244), (255, 137, 60), (0, 178, 178), (220, 70, 70), accent]
    ring_r = 150
    for i, col in enumerate(cols):
        ang = math.radians(-90 + i * 72)
        px, py = cx + ring_r * math.cos(ang), cy + ring_r * math.sin(ang)
        d.ellipse([px - 52, py - 52, px + 52, py + 52], fill=col + (255,))
        d.ellipse([px - 52, py - 52, px + 52, py + 52], outline=WHITE + (60,), width=4)
    d.polygon(_shield_pts(cx, cy, 86), fill=DEEP_SPACE + (255,))
    d.polygon(_shield_pts(cx, cy, 86), outline=WHITE + (255,), width=8)
    d.line([(cx - 32, cy), (cx - 8, cy + 28), (cx + 38, cy - 30)],
           fill=accent + (255,), width=10)


def icon_trial(d, cx, cy, accent, facts=None):
    days = str((facts or {}).get("trial_days", 30))
    d.ellipse([cx - 185, cy - 185, cx + 185, cy + 185], outline=accent + (255,), width=14)
    d.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], outline=accent + (90,), width=4)
    f_num = _lexend(150, "ExtraBold")
    tw = d.textlength(days, font=f_num)
    d.text((cx - tw / 2, cy - 130), days, font=f_num, fill=WHITE + (255,))
    f_lab = _font(INTER_SB, 40)
    for i, lab in enumerate(["DAYS FREE"]):
        tw = d.textlength(lab, font=f_lab)
        d.text((cx - tw / 2, cy + 48 + i * 44), lab, font=f_lab, fill=accent + (255,))


def icon_versus(d, cx, cy, accent):
    # [logo sfera AdOff]  VS  [cerchio "?"] — il logo lo incolla il chiamante
    f_vs = _lexend(80, "ExtraBold")
    tw = d.textlength("VS", font=f_vs)
    d.text((cx - tw / 2, cy - 52), "VS", font=f_vs, fill=accent + (255,))
    d.ellipse([cx + 100, cy - 95, cx + 290, cy + 95], outline=MUTED + (200,), width=10)
    f_q = _lexend(96, "ExtraBold")
    tw = d.textlength("?", font=f_q)
    d.text((cx + 195 - tw / 2, cy - 70), "?", font=f_q, fill=MUTED + (220,))


def icon_pause(d, cx, cy, accent):
    d.ellipse([cx - 180, cy - 180, cx + 180, cy + 180], outline=accent + (255,), width=14)
    d.rounded_rectangle([cx - 78, cy - 85, cx - 22, cy + 85], radius=20, fill=WHITE + (255,))
    d.rounded_rectangle([cx + 22, cy - 85, cx + 78, cy + 85], radius=20, fill=accent + (255,))
    f = _font(INTER_SB, 34)
    lab = "this site only"
    tw = d.textlength(lab, font=f)
    d.text((cx - tw / 2, cy + 205), lab, font=f, fill=MUTED + (255,))


def icon_counter(d, cx, cy, accent, seed=0):
    # contatore stile badge: numero mono grande dentro pill
    n = 1000 + (seed % 9000)
    txt = f"{n:,}"
    f_num = _font(MONO, 110)
    tw = d.textlength(txt, font=f_num)
    pad = 48
    d.rounded_rectangle([cx - tw / 2 - pad, cy - 105, cx + tw / 2 + pad, cy + 55],
                        radius=34, outline=accent + (255,), width=10)
    d.text((cx - tw / 2, cy - 88), txt, font=f_num, fill=WHITE + (255,))
    f_lab = _font(INTER_SB, 38)
    lab = "ads blocked"
    tw2 = d.textlength(lab, font=f_lab)
    d.text((cx - tw2 / 2, cy + 95), lab, font=f_lab, fill=accent + (255,))
    d.line([(cx - tw / 2 - pad - 4, cy + 55 + 12), (cx + tw / 2 + pad + 4, cy + 55 + 12)],
           fill=accent + (70,), width=4)


# ─── Composizione card ────────────────────────────────────────────────────────
def _wrap(draw, text, fnt, max_w):
    words, line, lines = text.split(), "", []
    for w in words:
        test = (line + " " + w).strip()
        if draw.textlength(test, font=fnt) > max_w and line:
            lines.append(line)
            line = w
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def build_card(theme_key, facts, out_path, seed=None):
    """Genera la card per il tema; ritorna (path, headline_scelta)."""
    vis = THEME_VISUALS.get(theme_key, DEFAULT_VISUAL)
    if seed is None:
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        seed = int(hashlib.sha256(f"{day}:{theme_key}".encode()).hexdigest()[:8], 16)

    headline = vis["headlines"][seed % len(vis["headlines"])].format(**facts)
    sub = vis["sub"].format(**facts)
    accent = _shift_purple(seed >> 8 & 0xFF)

    img = Image.new("RGBA", (W, H), DEEP_SPACE + (255,))

    # glow principale dietro l'icona + glow secondario variabile
    _paste_glow(img, accent, ICON_CX, ICON_CY, 270, blur=130, alpha=95)
    gx_opts = [(120, H - 80), (W // 2, H + 120), (60, 60)]
    gx, gy = gx_opts[(seed >> 16) % len(gx_opts)]
    _paste_glow(img, accent, gx, gy, 200, blur=150, alpha=45)

    # pattern puntini sottile (meta' dei giorni)
    if (seed >> 4) % 2 == 0:
        dots = ImageDraw.Draw(img)
        for ix in range(0, W, 64):
            for iy in range(0, H, 64):
                if (ix + iy) % 128 == 0:
                    dots.ellipse([ix, iy, ix + 3, iy + 3], fill=WHITE + (16,))

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # icona tema
    icon = vis["icon"]
    if icon == "stealth":
        icon_stealth(d, ICON_CX, ICON_CY, accent)
    elif icon == "video":
        icon_video(d, ICON_CX, ICON_CY, accent)
    elif icon == "privacy":
        icon_privacy(d, ICON_CX, ICON_CY, accent)
    elif icon == "universal":
        icon_universal(d, ICON_CX, ICON_CY, accent)
    elif icon == "lightweight":
        icon_lightweight(d, ICON_CX, ICON_CY, accent)
    elif icon == "browsers":
        icon_browsers(d, ICON_CX, ICON_CY, accent)
    elif icon == "trial":
        icon_trial(d, ICON_CX, ICON_CY, accent, facts)
    elif icon == "pause":
        icon_pause(d, ICON_CX, ICON_CY, accent)
    elif icon == "counter":
        icon_counter(d, ICON_CX, ICON_CY, accent, seed)
    elif icon == "versus":
        icon_versus(d, ICON_CX + 10, ICON_CY, accent)
        if LOGO_PATH.exists():
            lg = Image.open(LOGO_PATH).convert("RGBA").resize((220, 220))
            layer.alpha_composite(lg, (ICON_CX + 10 - 315, ICON_CY - 110))

    img.alpha_composite(layer)
    draw = ImageDraw.Draw(img)

    # wordmark "Ad"(bianco)+"Off"(accent) in alto a sinistra
    f_wm = _lexend(52, "ExtraBold")
    draw.text((MARGIN, MARGIN), "Ad", font=f_wm, fill=WHITE)
    adw = draw.textlength("Ad", font=f_wm)
    draw.text((MARGIN + adw, MARGIN), "Off", font=f_wm, fill=accent)

    # headline (colonna sinistra, sotto il wordmark)
    f_head = _lexend(82, "ExtraBold")
    max_w = W - 620 - MARGIN          # lascia respiro alla colonna icona
    lines = _wrap(draw, headline, f_head, max_w)
    if len(lines) > 3:                # headline troppo lunga → font ridotto
        f_head = _lexend(64, "ExtraBold")
        lines = _wrap(draw, headline, f_head, max_w)
    y = 240
    for ln in lines:
        draw.text((MARGIN, y), ln, font=f_head, fill=WHITE)
        y += int(f_head.size * 1.16)

    # subline
    f_sub = _font(INTER_REG, 34)
    y += 18
    for ln in _wrap(draw, sub, f_sub, max_w + 60):
        draw.text((MARGIN, y), ln, font=f_sub, fill=MUTED)
        y += 46

    # logo sfera (obbligatorio) — firma solida in alto a destra
    if LOGO_PATH.exists():
        lg = Image.open(LOGO_PATH).convert("RGBA").resize((96, 96))
        img.alpha_composite(lg, (W - MARGIN - 96, MARGIN - 14))

    # footer: CTA sinistra + tagline destra
    f_cta = _font(INTER_SB, 34)
    f_tag = _lexend(36, "Bold")
    fy = H - MARGIN - 30
    draw.text((MARGIN, fy), "Get it free — adoff.app", font=f_cta, fill=WHITE)
    tag = "Ads? Off!"
    tw = draw.textlength(tag, font=f_tag)
    draw.text((W - MARGIN - tw, fy - 4), tag, font=f_tag, fill=accent)

    img.convert("RGB").save(out_path, "PNG")
    return str(out_path), headline


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--theme", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()
    facts = {"network_rules": 138, "blocking_layers": 4, "languages": 15,
             "supported_browsers": 5, "trial_days": 30, "monthly": 2.99,
             "annual_founder": 19.99}
    path, headline = build_card(args.theme, facts, args.out, args.seed)
    print(f"saved {path} — headline: {headline}")


if __name__ == "__main__":
    main()
