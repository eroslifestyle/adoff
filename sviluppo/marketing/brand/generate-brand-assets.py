"""
Shadow Shield — Brand Asset Generator
Genera logo, icone e assets per Chrome Web Store
"""

from PIL import Image, ImageDraw, ImageFont
import os
import math

# Directories
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", ".."))  # reorg
ASSETS_DIR = os.path.join(PROJECT_ROOT, "assets")
BRAND_DIR = os.path.join(SCRIPT_DIR, "assets")
STORE_DIR = os.path.join(SCRIPT_DIR, "store-assets")

for d in [ASSETS_DIR, BRAND_DIR, STORE_DIR]:
    os.makedirs(d, exist_ok=True)

# Brand Colors
DEEP_SPACE = (10, 10, 26)
MIDNIGHT_BLUE = (18, 18, 42)
SHIELD_PURPLE = (124, 92, 252)
SOFT_PURPLE = (184, 169, 255)
PURE_WHITE = (255, 255, 255)
SUCCESS_GREEN = (74, 222, 128)
ALERT_RED = (244, 63, 94)
STEEL_GRAY = (138, 138, 170)


def draw_shield(draw, cx, cy, size, fill_color, outline_color=None):
    """Disegna uno scudo geometrico moderno"""
    s = size / 2

    # Punti dello scudo (forma moderna, non araldica)
    top = (cx, cy - s * 0.95)
    top_left = (cx - s * 0.82, cy - s * 0.65)
    top_right = (cx + s * 0.82, cy - s * 0.65)
    mid_left = (cx - s * 0.85, cy - s * 0.1)
    mid_right = (cx + s * 0.85, cy - s * 0.1)
    bot_left = (cx - s * 0.55, cy + s * 0.55)
    bot_right = (cx + s * 0.55, cy + s * 0.55)
    bottom = (cx, cy + s * 0.95)

    points = [top, top_right, mid_right, bot_right, bottom, bot_left, mid_left, top_left]
    draw.polygon(points, fill=fill_color, outline=outline_color)
    return points


def draw_stealth_symbol(draw, cx, cy, size, color):
    """Disegna il simbolo stealth (eye barred) dentro lo scudo"""
    s = size / 2

    # Occhio stilizzato (due archi)
    eye_w = s * 0.55
    eye_h = s * 0.22

    # Arco superiore
    bbox_top = [cx - eye_w, cy - eye_h * 1.8, cx + eye_w, cy + eye_h * 0.2]
    draw.arc(bbox_top, 200, 340, fill=color, width=max(2, int(size / 28)))

    # Arco inferiore
    bbox_bot = [cx - eye_w, cy - eye_h * 0.2, cx + eye_w, cy + eye_h * 1.8]
    draw.arc(bbox_bot, 20, 160, fill=color, width=max(2, int(size / 28)))

    # Pupilla
    pupil_r = max(2, int(s * 0.12))
    draw.ellipse(
        [cx - pupil_r, cy - pupil_r, cx + pupil_r, cy + pupil_r],
        fill=color,
    )

    # Barra diagonale (stealth/blocked)
    bar_w = max(2, int(size / 20))
    offset = s * 0.4
    draw.line(
        [(cx - offset, cy + offset), (cx + offset, cy - offset)],
        fill=color,
        width=bar_w,
    )


def generate_icon(size, with_bg=True):
    """Genera l'icona dello scudo a una dimensione specifica"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = max(1, int(size * 0.08))
    shield_size = size - margin * 2
    cx, cy = size // 2, size // 2

    if with_bg:
        # Background circolare scuro
        draw.ellipse(
            [margin // 2, margin // 2, size - margin // 2, size - margin // 2],
            fill=DEEP_SPACE,
        )

    # Scudo con gradiente simulato (due layer)
    draw_shield(draw, cx, cy, shield_size * 0.85, SHIELD_PURPLE)

    # Inner shield piu' scuro per profondita'
    inner_size = shield_size * 0.65
    draw_shield(draw, cx, cy, inner_size, MIDNIGHT_BLUE)

    # Simbolo stealth
    symbol_size = shield_size * 0.5
    draw_stealth_symbol(draw, cx, cy, symbol_size, PURE_WHITE)

    return img


def generate_store_tile():
    """Genera il tile 440x280 per Chrome Web Store"""
    w, h = 440, 280
    img = Image.new("RGB", (w, h), DEEP_SPACE)
    draw = ImageDraw.Draw(img)

    # Background gradient simulato
    for y in range(h):
        r = int(DEEP_SPACE[0] + (MIDNIGHT_BLUE[0] - DEEP_SPACE[0]) * (y / h) * 0.5)
        g = int(DEEP_SPACE[1] + (MIDNIGHT_BLUE[1] - DEEP_SPACE[1]) * (y / h) * 0.5)
        b = int(DEEP_SPACE[2] + (MIDNIGHT_BLUE[2] - DEEP_SPACE[2]) * (y / h) * 0.5)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Glow viola dietro l'icona
    glow_cx, glow_cy = w // 3, h // 2
    for r in range(80, 0, -1):
        alpha = int(30 * (r / 80))
        color = (SHIELD_PURPLE[0], SHIELD_PURPLE[1], SHIELD_PURPLE[2])
        dim_color = tuple(max(0, c - (80 - r) * 2) for c in color)
        draw.ellipse(
            [glow_cx - r, glow_cy - r, glow_cx + r, glow_cy + r],
            fill=dim_color,
        )

    # Icona scudo grande
    icon = generate_icon(120, with_bg=False)
    img.paste(icon, (w // 3 - 60, h // 2 - 60), icon)

    # Testo
    try:
        font_title = ImageFont.truetype("arial.ttf", 28)
        font_tag = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font_title = ImageFont.load_default()
        font_tag = ImageFont.load_default()

    text_x = w // 3 + 80
    draw.text((text_x, h // 2 - 30), "Shadow", fill=PURE_WHITE, font=font_title)
    draw.text((text_x, h // 2 + 5), "Shield", fill=SHIELD_PURPLE, font=font_title)
    draw.text((text_x, h // 2 + 45), "Navigate. Protected.", fill=STEEL_GRAY, font=font_tag)

    return img


def generate_promo_large():
    """Genera il banner promozionale 920x680"""
    w, h = 920, 680
    img = Image.new("RGB", (w, h), DEEP_SPACE)
    draw = ImageDraw.Draw(img)

    # Gradient background
    for y in range(h):
        ratio = y / h
        r = int(DEEP_SPACE[0] + (MIDNIGHT_BLUE[0] - DEEP_SPACE[0]) * ratio * 0.6)
        g = int(DEEP_SPACE[1] + (MIDNIGHT_BLUE[1] - DEEP_SPACE[1]) * ratio * 0.6)
        b = int(DEEP_SPACE[2] + (MIDNIGHT_BLUE[2] - DEEP_SPACE[2]) * ratio * 0.6)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Glow
    glow_cx, glow_cy = w // 2, h // 2 - 60
    for r in range(150, 0, -1):
        dim = max(0, int(20 * (r / 150)))
        color = tuple(max(0, c - (150 - r)) for c in SHIELD_PURPLE)
        draw.ellipse([glow_cx - r, glow_cy - r, glow_cx + r, glow_cy + r], fill=color)

    # Icona grande
    icon = generate_icon(200, with_bg=False)
    img.paste(icon, (w // 2 - 100, h // 2 - 160), icon)

    try:
        font_big = ImageFont.truetype("arial.ttf", 48)
        font_tag = ImageFont.truetype("arial.ttf", 20)
        font_features = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        font_big = ImageFont.load_default()
        font_tag = ImageFont.load_default()
        font_features = ImageFont.load_default()

    # Titolo
    title = "Shadow Shield"
    bbox = draw.textbbox((0, 0), title, font=font_big)
    tw = bbox[2] - bbox[0]
    draw.text((w // 2 - tw // 2, h // 2 + 70), title, fill=PURE_WHITE, font=font_big)

    # Tagline
    tagline = "Navigate. Protected."
    bbox = draw.textbbox((0, 0), tagline, font=font_tag)
    tw = bbox[2] - bbox[0]
    draw.text((w // 2 - tw // 2, h // 2 + 130), tagline, fill=SOFT_PURPLE, font=font_tag)

    # Features
    features = [
        "Block ads on every website",
        "Invisible to anti-adblock systems",
        "Zero data collection",
    ]
    y_start = h // 2 + 180
    for i, feat in enumerate(features):
        bbox = draw.textbbox((0, 0), feat, font=font_features)
        tw = bbox[2] - bbox[0]
        # Dot viola
        dot_x = w // 2 - tw // 2 - 15
        dot_y = y_start + i * 30 + 6
        draw.ellipse([dot_x, dot_y, dot_x + 6, dot_y + 6], fill=SHIELD_PURPLE)
        draw.text((w // 2 - tw // 2, y_start + i * 30), feat, fill=STEEL_GRAY, font=font_features)

    return img


def generate_screenshot_mockup():
    """Genera un mockup screenshot 1280x800 del popup"""
    w, h = 1280, 800
    img = Image.new("RGB", (w, h), (30, 30, 50))
    draw = ImageDraw.Draw(img)

    # Simula un browser con la pagina YouTube
    # Barra superiore
    draw.rectangle([0, 0, w, 40], fill=(45, 45, 65))
    draw.rectangle([200, 8, 900, 32], fill=(60, 60, 80), outline=(80, 80, 100))

    try:
        font_url = ImageFont.truetype("arial.ttf", 12)
        font_label = ImageFont.truetype("arial.ttf", 14)
    except OSError:
        font_url = ImageFont.load_default()
        font_label = ImageFont.load_default()

    draw.text((220, 13), "youtube.com/watch?v=...", fill=STEEL_GRAY, font=font_url)

    # Area contenuto (simula YouTube dark mode)
    draw.rectangle([0, 40, w, h], fill=(15, 15, 15))

    # Video player area
    draw.rectangle([40, 60, 860, 520], fill=(20, 20, 20))
    draw.text((400, 280), "Video Playing", fill=(80, 80, 80), font=font_label)

    # Sidebar
    for i in range(4):
        y = 60 + i * 120
        draw.rectangle([880, y, 1240, y + 100], fill=(25, 25, 25))
        draw.rectangle([880, y, 960, y + 100], fill=(35, 35, 35))

    # Popup overlay (in alto a destra)
    popup_x, popup_y = 960, 50
    popup_w, popup_h = 280, 320

    # Popup shadow
    draw.rectangle(
        [popup_x - 2, popup_y - 2, popup_x + popup_w + 2, popup_y + popup_h + 2],
        fill=(0, 0, 0),
    )
    # Popup body
    draw.rectangle(
        [popup_x, popup_y, popup_x + popup_w, popup_y + popup_h],
        fill=DEEP_SPACE,
    )

    # Popup header
    icon_small = generate_icon(30, with_bg=False)
    img.paste(icon_small, (popup_x + 15, popup_y + 15), icon_small)

    try:
        font_popup_title = ImageFont.truetype("arial.ttf", 15)
        font_popup_sub = ImageFont.truetype("arial.ttf", 9)
        font_popup_label = ImageFont.truetype("arial.ttf", 12)
        font_popup_stat = ImageFont.truetype("arial.ttf", 22)
        font_popup_small = ImageFont.truetype("arial.ttf", 9)
    except OSError:
        font_popup_title = font_popup_sub = font_popup_label = ImageFont.load_default()
        font_popup_stat = font_popup_small = ImageFont.load_default()

    draw.text((popup_x + 55, popup_y + 15), "Shadow Shield", fill=PURE_WHITE, font=font_popup_title)
    draw.text((popup_x + 55, popup_y + 35), "NAVIGATE. PROTECTED.", fill=STEEL_GRAY, font=font_popup_sub)

    # Toggle row
    ty = popup_y + 70
    draw.rounded_rectangle([popup_x + 15, ty, popup_x + popup_w - 15, ty + 40], radius=8, fill=MIDNIGHT_BLUE)
    draw.text((popup_x + 30, ty + 12), "Protezione", fill=PURE_WHITE, font=font_popup_label)
    # Toggle ON
    draw.rounded_rectangle([popup_x + popup_w - 60, ty + 8, popup_x + popup_w - 25, ty + 32], radius=12, fill=SHIELD_PURPLE)
    draw.ellipse([popup_x + popup_w - 42, ty + 11, popup_x + popup_w - 28, ty + 29], fill=PURE_WHITE)

    # Status
    draw.text((popup_x + 105, ty + 50), "Scudo attivo", fill=SHIELD_PURPLE, font=font_popup_label)

    # Stats
    sy = ty + 80
    draw.rounded_rectangle([popup_x + 15, sy, popup_x + popup_w - 15, sy + 70], radius=8, fill=MIDNIGHT_BLUE)
    draw.text((popup_x + 55, sy + 10), "847", fill=SHIELD_PURPLE, font=font_popup_stat)
    draw.text((popup_x + 35, sy + 42), "Elementi bloccati", fill=STEEL_GRAY, font=font_popup_small)
    draw.text((popup_x + 175, sy + 10), "2.1K", fill=SHIELD_PURPLE, font=font_popup_stat)
    draw.text((popup_x + 160, sy + 42), "Richieste bloccate", fill=STEEL_GRAY, font=font_popup_small)

    # Site info
    si_y = sy + 85
    draw.rounded_rectangle([popup_x + 15, si_y, popup_x + popup_w - 15, si_y + 35], radius=8, fill=MIDNIGHT_BLUE)
    draw.text((popup_x + 25, si_y + 10), "Sito:", fill=STEEL_GRAY, font=font_popup_small)
    draw.text((popup_x + 55, si_y + 10), "youtube.com", fill=SOFT_PURPLE, font=font_popup_label)

    # Footer
    draw.text((popup_x + 100, popup_y + popup_h - 25), "v2.0.0 — Stealth Mode", fill=(60, 60, 80), font=font_popup_small)

    # Arrow pointing to extension icon area
    draw.text((popup_x + 80, popup_y - 15), "Shadow Shield", fill=SHIELD_PURPLE, font=font_popup_small)

    return img


# =============================================
# GENERA TUTTI GLI ASSETS
# =============================================

print("Shadow Shield — Brand Asset Generator")
print("=" * 40)

# 1. Icone Chrome Extension
print("\n[1/5] Generando icone estensione...")
for size in [16, 19, 32, 38, 48, 128]:
    icon = generate_icon(size)
    icon.save(os.path.join(ASSETS_DIR, f"icon{size}.png"))
    icon.save(os.path.join(BRAND_DIR, f"icon{size}.png"))
    print(f"  icon{size}.png")

# 2. Logo grande (brand)
print("\n[2/5] Generando logo brand...")
logo_512 = generate_icon(512, with_bg=True)
logo_512.save(os.path.join(BRAND_DIR, "logo-512.png"))
print("  logo-512.png")

logo_no_bg = generate_icon(512, with_bg=False)
logo_no_bg.save(os.path.join(BRAND_DIR, "logo-512-transparent.png"))
print("  logo-512-transparent.png")

# 3. Store tile
print("\n[3/5] Generando Chrome Web Store assets...")
tile = generate_store_tile()
tile.save(os.path.join(STORE_DIR, "store-tile-440x280.png"))
print("  store-tile-440x280.png")

# 4. Promo banner
promo = generate_promo_large()
promo.save(os.path.join(STORE_DIR, "promo-large-920x680.png"))
print("  promo-large-920x680.png")

# 5. Screenshot mockup
print("\n[4/5] Generando screenshot mockup...")
screenshot = generate_screenshot_mockup()
screenshot.save(os.path.join(STORE_DIR, "screenshot-1280x800.png"))
print("  screenshot-1280x800.png")

# 6. Marquee banner
print("\n[5/5] Generando marquee banner...")
marquee_w, marquee_h = 1400, 560
marquee = Image.new("RGB", (marquee_w, marquee_h), DEEP_SPACE)
marquee_draw = ImageDraw.Draw(marquee)

# Gradient
for y in range(marquee_h):
    ratio = y / marquee_h
    r = int(DEEP_SPACE[0] + (MIDNIGHT_BLUE[0] - DEEP_SPACE[0]) * ratio * 0.4)
    g = int(DEEP_SPACE[1] + (MIDNIGHT_BLUE[1] - DEEP_SPACE[1]) * ratio * 0.4)
    b = int(DEEP_SPACE[2] + (MIDNIGHT_BLUE[2] - DEEP_SPACE[2]) * ratio * 0.4)
    marquee_draw.line([(0, y), (marquee_w, y)], fill=(r, g, b))

# Glow
for r in range(200, 0, -1):
    color = tuple(max(0, c - (200 - r)) for c in SHIELD_PURPLE)
    marquee_draw.ellipse(
        [marquee_w // 4 - r, marquee_h // 2 - r, marquee_w // 4 + r, marquee_h // 2 + r],
        fill=color,
    )

icon_big = generate_icon(180, with_bg=False)
marquee.paste(icon_big, (marquee_w // 4 - 90, marquee_h // 2 - 90), icon_big)

try:
    font_marquee = ImageFont.truetype("arial.ttf", 56)
    font_marquee_tag = ImageFont.truetype("arial.ttf", 22)
except OSError:
    font_marquee = ImageFont.load_default()
    font_marquee_tag = ImageFont.load_default()

text_x = marquee_w // 2
marquee_draw.text((text_x, marquee_h // 2 - 50), "Shadow Shield", fill=PURE_WHITE, font=font_marquee)
marquee_draw.text((text_x, marquee_h // 2 + 30), "Navigate. Protected.", fill=SOFT_PURPLE, font=font_marquee_tag)

marquee.save(os.path.join(STORE_DIR, "marquee-1400x560.png"))
print("  marquee-1400x560.png")

print("\n" + "=" * 40)
print("TUTTI GLI ASSETS GENERATI!")
print(f"  Icone estensione: {ASSETS_DIR}")
print(f"  Logo brand:       {BRAND_DIR}")
print(f"  Store assets:     {STORE_DIR}")
print("=" * 40)
