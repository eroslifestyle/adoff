"""Generate 1400x560 large promotional tile for Edge Add-ons store.

SECONDARY generator (SSOT-aligned 2026-06-02: 138 rules, 4 layers, 15 languages, 30-day trial,
Founder pricing). Canonical: create_store_images_linux.py — both write promo_1400x560.png, run one.
"""
from PIL import Image, ImageDraw, ImageFont
import math, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

W, H = 2800, 1120
img = Image.new("RGB", (W, H), "#0a0a1a")
draw = ImageDraw.Draw(img)

# Background subtle radial
for x in range(0, W, 3):
    for y in range(0, H, 3):
        dx = (x - W / 2) / (W / 2)
        dy = (y - H / 2) / (H / 2)
        dist = min(1.0, math.sqrt(dx * dx + dy * dy))
        f = 1.0 - dist * 0.15
        draw.rectangle([x, y, x + 2, y + 2], fill=(int(10 * f), int(10 * f), int(26 + 10 * f)))

# Fonts
def font(name, size):
    return ImageFont.truetype(("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if "b" in name else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), size)

f_title = font("segoeuib", 88)
f_tag = font("segoeuib", 44)
f_section = font("segoeuib", 34)
f_item = font("segoeui", 26)
f_stat_num = font("segoeuib", 56)
f_stat_label = font("segoeuib", 22)
f_badge = font("segoeuib", 18)
f_small = font("segoeui", 20)

purple = "#7c5cfc"
green = "#4ade80"
red = "#f87171"
white = "#ffffff"
gray = "#9999bb"
dark_card = "#161636"
card_border = "#2a2a5a"

# ===== COL 1: BRAND (40-540) =====
cx_i, cy_i = 280, 260
for r in range(200, 0, -1):
    intensity = (1 - r / 200) * 0.3
    draw.ellipse(
        [cx_i - r, cy_i - r, cx_i + r, cy_i + r],
        fill=(int(10 + 114 * intensity), int(10 + 82 * intensity), int(26 + 226 * intensity)),
    )

icon_path = os.path.join(ROOT, "app", "assets", "icon128.png")
icon = Image.open(icon_path).convert("RGBA").resize((180, 180), Image.LANCZOS)
img.paste(icon, (cx_i - 90, cy_i - 90), icon)

# Title + tag
for text, fnt, color, y in [("AdOff", f_title, white, 380), ("Ads? Off!", f_tag, purple, 480)]:
    bb = draw.textbbox((0, 0), text, font=fnt)
    draw.text((cx_i - (bb[2] - bb[0]) // 2, y), text, fill=color, font=fnt)

# Stats
stats = [("138", "Rules"), ("4", "Layers"), ("0%", "Data")]
for i, (num, label) in enumerate(stats):
    sx = 60 + i * 170
    sy = 580
    draw.rounded_rectangle([sx, sy, sx + 150, sy + 110], radius=10, fill=dark_card, outline=card_border)
    for txt, fnt, col, offy in [(num, f_stat_num, purple, 8), (label, f_stat_label, gray, 72)]:
        bb = draw.textbbox((0, 0), txt, font=fnt)
        draw.text((sx + (150 - bb[2] + bb[0]) // 2, sy + offy), txt, fill=col, font=fnt)

# How it works
hw_y = 730
draw.text((60, hw_y), "How It Works", fill=white, font=f_section)
draw.line([(60, hw_y + 42), (350, hw_y + 42)], fill=purple, width=3)
for i, (n, txt) in enumerate([
    ("1.", "Network blocking (DNR rules)"),
    ("2.", "CSS cosmetic hiding"),
    ("3.", "Video ad neutralization (Pro)"),
    ("4.", "Stealth anti-detection (Pro)"),
]):
    y = hw_y + 58 + i * 38
    draw.text((70, y), n, fill=purple, font=f_item)
    draw.text((110, y), txt, fill="#ccccdd", font=f_item)

# Divider
draw.line([(560, 50), (560, H - 50)], fill="#222250", width=2)

# ===== COL 2: BEFORE / AFTER (600-1380) =====
col2 = 620

draw.text((col2, 50), "WITHOUT AdOff", fill=red, font=f_section)
draw.line([(col2, 92), (col2 + 360, 92)], fill="#5a2020", width=2)
problems = [
    "Intrusive ads on every page",
    "Slow page load (heavy scripts)",
    "Trackers follow you everywhere",
    "Pop-ups interrupt browsing",
    "Anti-adblock walls block content",
    "Personal data sold to advertisers",
    "Autoplay video ads waste bandwidth",
    "Malvertising security risks",
]
for i, p in enumerate(problems):
    draw.text((col2, 110 + i * 36), "X  " + p, fill="#cc8888", font=f_item)

after_y = 420
draw.text((col2, after_y), "WITH AdOff", fill=green, font=f_section)
draw.line([(col2, after_y + 42), (col2 + 360, after_y + 42)], fill="#205a20", width=2)
solutions = [
    "Clean pages, zero distractions",
    "Pages load up to 3x faster",
    "Complete tracker protection",
    "No pop-ups, no interruptions",
    "Stealth Mode bypasses ad-walls",
    "Zero data collection \u2014 100% local",
    "Blocks video pre-rolls & overlays",
    "Malicious script protection",
]
for i, s in enumerate(solutions):
    draw.text((col2, after_y + 58 + i * 36), "+  " + s, fill="#88cc88", font=f_item)

# Arrow
draw.text((col2 + 160, after_y - 28), "\u2193", fill=purple, font=f_section)

draw.line([(1400, 50), (1400, H - 50)], fill="#222250", width=2)

# ===== COL 3: FREE vs PRO (1440-2220) =====
col3 = 1460

draw.text((col3, 50), "FREE", fill=white, font=f_section)
draw.rounded_rectangle([col3 + 100, 50, col3 + 200, 82], radius=10, fill="#1a3a1a", outline="#2a5a2a")
draw.text((col3 + 115, 55), "FREE", fill=green, font=f_badge)

free_feats = [
    "Block ads on all websites",
    "Remove banners & pop-ups",
    "Block tracking requests",
    "CSS cosmetic filtering",
    "138 network rules",
    "Whitelist your favorite sites",
    "Per-site pause options",
    "Stats dashboard",
    "15 languages supported",
]
for i, f in enumerate(free_feats):
    draw.text((col3, 100 + i * 34), "+  " + f, fill="#bbbbdd", font=f_item)

pro_y = 440
draw.text((col3, pro_y), "PRO", fill=white, font=f_section)
draw.rounded_rectangle([col3 + 80, pro_y, col3 + 180, pro_y + 32], radius=10, fill="#2a1a5a", outline=purple)
draw.text((col3 + 100, pro_y + 5), "PRO", fill=purple, font=f_badge)

pro_feats = [
    "Stealth Mode anti-detection",
    "Bypass anti-adblock walls",
    "Bait element spoofing",
    "Variable & script neutralizer",
    "Fetch/XHR interception",
    "Scroll lock prevention",
    "Priority support",
    "30-day free trial included",
]
for i, f in enumerate(pro_feats):
    draw.text((col3, pro_y + 50 + i * 34), "+  " + f, fill="#bbbbdd", font=f_item)

draw.line([(2240, 50), (2240, H - 50)], fill="#222250", width=2)

# ===== COL 4: ARCHITECTURE + PRICING (2280-2760) =====
col4 = 2280

draw.text((col4, 50), "Architecture", fill=white, font=f_section)
draw.line([(col4, 92), (col4 + 300, 92)], fill=purple, width=2)

arch = [
    ("Layer 1", "declarativeNetRequest", "138 rules block HTTP requests"),
    ("Layer 2", "Content Script", "CSS + DOM hiding in ISOLATED"),
    ("Layer 3", "IMA SDK stub", "Video ad neutralization (MAIN)"),
    ("Layer 4", "Stealth Script", "MAIN world anti-detection"),
]
ay = 110
for layer, name, desc in arch:
    draw.rounded_rectangle([col4, ay, col4 + 480, ay + 80], radius=8, fill=dark_card, outline=card_border)
    draw.text((col4 + 12, ay + 8), layer, fill=purple, font=f_stat_label)
    draw.text((col4 + 12, ay + 32), name, fill=white, font=f_item)
    draw.text((col4 + 12, ay + 56), desc, fill=gray, font=f_small)
    ay += 95

# Privacy box
priv_y = ay + 20
draw.rounded_rectangle([col4, priv_y, col4 + 480, priv_y + 100], radius=10, fill="#0a1a0a", outline="#1a3a1a")
draw.text((col4 + 15, priv_y + 10), "Privacy Guarantee", fill=green, font=f_section)
draw.text((col4 + 15, priv_y + 50), "No accounts. No servers. No analytics.", fill="#88cc88", font=f_item)
draw.text((col4 + 15, priv_y + 76), "Everything runs 100% locally in your browser.", fill="#88cc88", font=f_small)

# Pricing
price_y = priv_y + 130
draw.text((col4, price_y), "Pricing", fill=white, font=f_section)
draw.line([(col4, price_y + 42), (col4 + 300, price_y + 42)], fill=purple, width=2)

prices = [
    ("Trial", "30 days free", "Full Pro features"),
    ("Monthly", "2.99 EUR/mo", "Cancel anytime"),
    ("Annual", "19.99 EUR/yr", "Founder price"),
    ("Lifetime", "99 EUR", "Founder, one-time"),
]
for i, (plan, price, note) in enumerate(prices):
    py = price_y + 55 + i * 50
    draw.rounded_rectangle([col4, py, col4 + 480, py + 42], radius=6, fill=dark_card, outline=card_border)
    draw.text((col4 + 12, py + 8), plan, fill=purple, font=f_stat_label)
    draw.text((col4 + 140, py + 8), price, fill=white, font=f_stat_label)
    draw.text((col4 + 320, py + 10), note, fill=gray, font=f_small)

# Accent bars
draw.rectangle([0, H - 8, W, H], fill=purple)
draw.rectangle([0, 0, W, 4], fill=purple)

# Downscale
final = img.resize((1400, 560), Image.LANCZOS)
out = os.path.join(ROOT, "sviluppo", "marketing", "assets", "store-assets", "promo_1400x560.png")
final.save(out, "PNG")
print(f"Done: {out}")
