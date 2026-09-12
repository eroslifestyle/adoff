# SECONDARY generator (Linux paths + SSOT-aligned 2026-06-02: 138 rules, 15 langs, 30-day trial,
# 4 layers). Canonical generator is create_store_images_linux.py — keep both in sync if edited.
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = "/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/assets/store-assets"
os.makedirs(OUT_DIR, exist_ok=True)

ICON_PATH = "/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/assets/avatar-512.png"

# Colors
BG_DARK = (18, 18, 32)
BG_CARD = (28, 28, 48)
BLUE = (79, 195, 247)
PURPLE = (124, 77, 255)
GREEN = (76, 175, 80)
RED = (244, 67, 54)
WHITE = (255, 255, 255)
GRAY = (160, 160, 180)
LIGHT_GRAY = (200, 200, 220)
DARK_GRAY = (80, 80, 100)
YELLOW = (255, 215, 0)

def font(size, bold=False):
    path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(path, size)

def font_light(size):
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)

def draw_rounded_rect(draw, xy, radius, fill, outline=None, width=0):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

icon_orig = Image.open(ICON_PATH).convert("RGBA")


# === SCREENSHOT 1: Feature overview (1280x800) ===
def create_screenshot1():
    img = Image.new("RGB", (1280, 800), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Icon + Title
    icon_title = icon_orig.resize((70, 70), Image.LANCZOS)
    img.paste(icon_title, (555, 20), icon_title)
    draw.text((640, 100), "AdOff", fill=WHITE, font=font(52, True), anchor="mt")
    draw.text((640, 158), "Ads? Off!", fill=BLUE, font=font_light(26), anchor="mt")

    # Three feature cards
    cols = [
        {
            "title": "4 Layers of Protection",
            "items": [
                ("Network Blocking", "138 rules stop ad requests before loading", GREEN),
                ("Cosmetic Filtering", "Hides banners and sponsored content", BLUE),
                ("Video Ad Neutralization", "Skips pre-roll & mid-roll instantly", PURPLE),
                ("Stealth Anti-Detection", "Bypasses anti-adblock walls silently", PURPLE),
            ]
        },
        {
            "title": "Why AdOff?",
            "items": [
                ("Ultra-Light", "A fraction of typical blockers", GREEN),
                ("Works on Every Site", "Zero configuration needed", BLUE),
                ("Video Ad Skip", "Auto-skips video & overlay ads", PURPLE),
            ]
        },
        {
            "title": "Privacy & Trust",
            "items": [
                ("Zero Data Collection", "Nothing tracked, nothing sent", GREEN),
                ("100% Local", "No external servers, no analytics", BLUE),
                ("Manifest V3", "Built on latest Chrome standards", PURPLE),
            ]
        }
    ]

    col_width = 360
    col_start_x = 80
    card_y = 200
    card_h = 400

    for i, col in enumerate(cols):
        cx = col_start_x + i * (col_width + 40)
        draw_rounded_rect(draw, (cx, card_y, cx + col_width, card_y + card_h), 16, BG_CARD)
        draw.text((cx + col_width // 2, card_y + 28), col["title"], fill=WHITE, font=font(21, True), anchor="mt")
        draw.line((cx + 30, card_y + 60, cx + col_width - 30, card_y + 60), fill=DARK_GRAY, width=1)

        for j, (title, desc, color) in enumerate(col["items"]):
            iy = card_y + 85 + j * 88
            draw.ellipse((cx + 25, iy + 4, cx + 39, iy + 18), fill=color)
            draw.text((cx + 50, iy), title, fill=WHITE, font=font(18, True))
            draw.text((cx + 50, iy + 26), desc, fill=GRAY, font=font(14))

    # Bottom stats bar
    bar_y = 620
    draw_rounded_rect(draw, (80, bar_y, 1200, bar_y + 130), 16, BG_CARD)

    icon_small = icon_orig.resize((80, 80), Image.LANCZOS)
    img.paste(icon_small, (110, bar_y + 25), icon_small)

    stats = [
        ("138", "Blocking Rules", GREEN),
        ("15", "Languages", BLUE),
        ("30", "Day Trial", PURPLE),
        ("0", "Data Collected", YELLOW),
    ]
    for i, (val, label, color) in enumerate(stats):
        sx = 260 + i * 230
        draw.text((sx, bar_y + 28), val, fill=color, font=font(38, True))
        draw.text((sx, bar_y + 78), label, fill=GRAY, font=font(16))

    img.save(os.path.join(OUT_DIR, "screenshot1_features.png"), "PNG")
    print("Screenshot 1 (features) saved")


# === SCREENSHOT 2: Before/After (1280x800) ===
def create_screenshot2():
    img = Image.new("RGB", (1280, 800), BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.text((640, 35), "AdOff in Action", fill=WHITE, font=font(44, True), anchor="mt")
    draw.text((640, 88), "Clean browsing on every website", fill=GRAY, font=font_light(20), anchor="mt")

    panel_w = 560
    panel_h = 500
    gap = 40
    left_x = (1280 - 2 * panel_w - gap) // 2
    right_x = left_x + panel_w + gap
    panel_y = 130

    # LEFT - WITHOUT
    draw_rounded_rect(draw, (left_x, panel_y, left_x + panel_w, panel_y + panel_h), 16, (40, 20, 20))
    draw_rounded_rect(draw, (left_x, panel_y, left_x + panel_w, panel_y + 42), 16, (60, 30, 30))
    draw.text((left_x + panel_w // 2, panel_y + 21), "WITHOUT AdOff", fill=RED, font=font(18, True), anchor="mm")

    ad_blocks = [
        (left_x + 20, panel_y + 55, left_x + 540, panel_y + 120, "ADVERTISEMENT - BUY NOW"),
        (left_x + 20, panel_y + 135, left_x + 260, panel_y + 260, "SPONSORED\nCONTENT"),
        (left_x + 275, panel_y + 135, left_x + 540, panel_y + 195, "CLICK HERE!"),
        (left_x + 275, panel_y + 210, left_x + 540, panel_y + 260, "AD - SHOP NOW"),
        (left_x + 20, panel_y + 275, left_x + 540, panel_y + 340, "PROMOTED - LIMITED OFFER 50% OFF"),
        (left_x + 20, panel_y + 355, left_x + 350, panel_y + 480, "VIDEO AD\n\nSkip in 5...4...3..."),
        (left_x + 365, panel_y + 355, left_x + 540, panel_y + 420, "TRACKING\nCOOKIES"),
        (left_x + 365, panel_y + 435, left_x + 540, panel_y + 480, "POP-UP AD"),
    ]
    for pos in ad_blocks:
        x1, y1, x2, y2, txt = pos
        draw_rounded_rect(draw, (x1, y1, x2, y2), 8, (70, 25, 25), outline=(120, 40, 40), width=1)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        draw.text((cx, cy), txt, fill=(200, 80, 80), font=font(13, True), anchor="mm", align="center")

    # RIGHT - WITH
    draw_rounded_rect(draw, (right_x, panel_y, right_x + panel_w, panel_y + panel_h), 16, (20, 30, 45))
    draw_rounded_rect(draw, (right_x, panel_y, right_x + panel_w, panel_y + 42), 16, (25, 40, 60))
    draw.text((right_x + panel_w // 2, panel_y + 21), "WITH AdOff", fill=GREEN, font=font(18, True), anchor="mm")

    # Clean content
    for i in range(14):
        ly = panel_y + 60 + i * 32
        lw = [480, 420, 350, 490, 400, 460, 380, 500, 440, 360, 470, 410, 390, 450][i]
        draw_rounded_rect(draw, (right_x + 30, ly, right_x + 30 + lw, ly + 12), 6, (40, 55, 75))

    icon_badge = icon_orig.resize((45, 45), Image.LANCZOS)
    img.paste(icon_badge, (right_x + panel_w - 60, panel_y + panel_h - 60), icon_badge)

    # Bottom comparison
    stat_y = 660
    draw_rounded_rect(draw, (left_x, stat_y, left_x + panel_w, stat_y + 70), 12, (55, 22, 22))
    draw.text((left_x + panel_w // 2, stat_y + 20), "8 ads  |  15 trackers  |  3.2s page load", fill=(200, 100, 100), font=font(17), anchor="mt")
    draw.text((left_x + panel_w // 2, stat_y + 45), "Slow, cluttered, tracked", fill=(150, 70, 70), font=font(13), anchor="mt")

    draw_rounded_rect(draw, (right_x, stat_y, right_x + panel_w, stat_y + 70), 12, (22, 50, 30))
    draw.text((right_x + panel_w // 2, stat_y + 20), "0 ads  |  0 trackers  |  0.8s page load", fill=(100, 200, 120), font=font(17), anchor="mt")
    draw.text((right_x + panel_w // 2, stat_y + 45), "Fast, clean, private", fill=(70, 150, 80), font=font(13), anchor="mt")

    img.save(os.path.join(OUT_DIR, "screenshot2_before_after.png"), "PNG")
    print("Screenshot 2 (before/after) saved")


# === SCREENSHOT 3: Popup mockup (1280x800) ===
def create_screenshot3():
    img = Image.new("RGB", (1280, 800), BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.text((640, 35), "Simple & Powerful", fill=WHITE, font=font(44, True), anchor="mt")
    draw.text((640, 88), "One click to control everything", fill=GRAY, font=font_light(20), anchor="mt")

    # Popup mockup - centered
    popup_w = 340
    popup_h = 480
    px = (1280 - popup_w) // 2
    py = 130

    # Popup shadow
    draw_rounded_rect(draw, (px - 4, py - 4, px + popup_w + 4, py + popup_h + 4), 18, (40, 40, 60))
    draw_rounded_rect(draw, (px, py, px + popup_w, py + popup_h), 16, (22, 22, 38))

    # Popup header
    draw_rounded_rect(draw, (px, py, px + popup_w, py + 65), 16, BG_CARD)
    icon_pop = icon_orig.resize((40, 40), Image.LANCZOS)
    img.paste(icon_pop, (px + 15, py + 12), icon_pop)
    draw.text((px + 65, py + 15), "AdOff", fill=WHITE, font=font(22, True))
    draw.text((px + 65, py + 40), "Ads? Off!", fill=BLUE, font=font(13))
    draw_rounded_rect(draw, (px + 250, py + 18, px + 310, py + 42), 8, GREEN)
    draw.text((px + 280, py + 30), "PRO", fill=WHITE, font=font(13, True), anchor="mm")

    # Toggle row
    ty = py + 80
    draw.text((px + 20, ty), "Ad Blocking", fill=WHITE, font=font(17, True))
    draw.text((px + 20, ty + 24), "Active", fill=GREEN, font=font(13))
    # Toggle switch
    draw_rounded_rect(draw, (px + 265, ty + 5, px + 315, ty + 30), 12, GREEN)
    draw.ellipse((px + 290, ty + 8, px + 312, ty + 27), fill=WHITE)

    # Stats
    sy = ty + 60
    draw.line((px + 15, sy, px + popup_w - 15, sy), fill=DARK_GRAY, width=1)
    sy += 15
    stat_items = [
        ("Ads Blocked", "1,247", GREEN),
        ("Requests Stopped", "312", BLUE),
        ("Pages Protected", "89", PURPLE),
    ]
    for i, (label, val, color) in enumerate(stat_items):
        isy = sy + i * 42
        draw.text((px + 20, isy), label, fill=GRAY, font=font(15))
        draw.text((px + popup_w - 20, isy), val, fill=color, font=font(18, True), anchor="rt")

    # Pause options
    py2 = sy + 140
    draw.line((px + 15, py2, px + popup_w - 15, py2), fill=DARK_GRAY, width=1)
    py2 += 12
    draw.text((px + 20, py2), "Pause for this site", fill=WHITE, font=font(16, True))
    py2 += 30
    pause_opts = ["30 minutes", "1 hour", "This session", "Always"]
    for i, opt in enumerate(pause_opts):
        bx = px + 20 + i * 78
        draw_rounded_rect(draw, (bx, py2, bx + 72, py2 + 28), 8, BG_CARD, outline=DARK_GRAY, width=1)
        draw.text((bx + 36, py2 + 14), opt, fill=GRAY, font=font(10), anchor="mm")

    # Settings / Options
    py3 = py2 + 50
    draw.line((px + 15, py3, px + popup_w - 15, py3), fill=DARK_GRAY, width=1)
    py3 += 12
    draw_rounded_rect(draw, (px + 20, py3, px + popup_w - 20, py3 + 35), 8, BLUE)
    draw.text((px + popup_w // 2, py3 + 17), "Open Settings", fill=WHITE, font=font(14, True), anchor="mm")

    # Left features
    left_features = [
        ("Works on every website", "No lists to configure, no setup needed"),
        ("Video ad skipper", "Automatically skips video ads"),
        ("Per-site control", "4 pause options per website"),
    ]
    for i, (title, desc) in enumerate(left_features):
        fy = 180 + i * 100
        draw.ellipse((60, fy, 76, fy + 16), fill=BLUE)
        draw.text((90, fy - 3), title, fill=WHITE, font=font(17, True))
        draw.text((90, fy + 22), desc, fill=GRAY, font=font(13))

    # Right features
    right_features = [
        ("Stealth mode", "Invisible to anti-adblock detection"),
        ("Multi-language", "EN, IT, DE, FR, ES, PT"),
        ("Privacy first", "Zero tracking, 100% local"),
    ]
    for i, (title, desc) in enumerate(right_features):
        fy = 180 + i * 100
        fx = 820
        draw.ellipse((fx, fy, fx + 16, fy + 16), fill=PURPLE)
        draw.text((fx + 30, fy - 3), title, fill=WHITE, font=font(17, True))
        draw.text((fx + 30, fy + 22), desc, fill=GRAY, font=font(13))

    img.save(os.path.join(OUT_DIR, "screenshot3_popup.png"), "PNG")
    print("Screenshot 3 (popup) saved")


# === SMALL PROMO (440x280) ===
def create_small_promo():
    img = Image.new("RGB", (440, 280), BG_DARK)
    draw = ImageDraw.Draw(img)

    icon_large = icon_orig.resize((80, 80), Image.LANCZOS)
    img.paste(icon_large, (180, 20), icon_large)

    draw.text((220, 115), "AdOff", fill=WHITE, font=font(36, True), anchor="mt")
    draw.text((220, 158), "Ads? Off!", fill=BLUE, font=font_light(20), anchor="mt")
    draw.text((220, 200), "Block ads everywhere", fill=GRAY, font=font(14), anchor="mt")
    draw.text((220, 222), "Ultra-light  |  Stealth mode  |  Privacy first", fill=DARK_GRAY, font=font(12), anchor="mt")
    draw_rounded_rect(draw, (160, 252, 280, 256), 2, BLUE)

    img.save(os.path.join(OUT_DIR, "promo_440x280.png"), "PNG")
    print("Small promo saved")


# === LARGE PROMO (1400x560) ===
def create_large_promo():
    img = Image.new("RGB", (1400, 560), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Left branding
    icon_big = icon_orig.resize((110, 110), Image.LANCZOS)
    img.paste(icon_big, (100, 100), icon_big)

    draw.text((100, 230), "AdOff", fill=WHITE, font=font(60, True))
    draw.text((100, 300), "Ads? Off!", fill=BLUE, font=font_light(30))
    draw.text((100, 360), "The ad blocker that is invisible", fill=GRAY, font=font(19))
    draw.text((100, 388), "to anti-adblock systems.", fill=GRAY, font=font(19))
    draw_rounded_rect(draw, (100, 435, 340, 439), 2, PURPLE)
    draw.text((100, 460), "Chrome Extension  |  Manifest V3  |  Free", fill=DARK_GRAY, font=font(14))

    # Right feature cards
    features = [
        ("4-Layer Shield", "Network + Cosmetic +\nVideo + Stealth", BLUE),
        ("Ultra-light", "A fraction of\ntypical blockers", GREEN),
        ("Works Everywhere", "Every website,\nzero configuration", PURPLE),
        ("Privacy First", "Zero tracking,\nno data collection", YELLOW),
    ]

    card_w = 190
    card_h = 180
    start_x = 560

    for i, (title, desc, color) in enumerate(features):
        cx = start_x + i * (card_w + 15)
        cy = 80
        draw_rounded_rect(draw, (cx, cy, cx + card_w, cy + card_h), 14, BG_CARD, outline=color, width=2)
        draw_rounded_rect(draw, (cx + 2, cy + 2, cx + card_w - 2, cy + 8), 6, color)
        draw.text((cx + card_w // 2, cy + 40), title, fill=WHITE, font=font(17, True), anchor="mt")
        for li, line in enumerate(desc.split("\n")):
            draw.text((cx + card_w // 2, cy + 75 + li * 18), line, fill=GRAY, font=font(13), anchor="mt")

    # Bottom stats
    bar_y = 310
    draw_rounded_rect(draw, (560, bar_y, 1300, bar_y + 190), 14, BG_CARD)

    stats = [
        ("138", "Blocking Rules", BLUE),
        ("15", "Languages", GREEN),
        ("MV3", "Manifest V3", PURPLE),
        ("0 bytes", "Data Collected", YELLOW),
    ]
    for i, (val, label, color) in enumerate(stats):
        sx = 610 + i * 175
        draw.text((sx, bar_y + 25), val, fill=color, font=font(34, True))
        draw.text((sx, bar_y + 70), label, fill=GRAY, font=font(15))

    # Supported text
    draw.text((610, bar_y + 120), "Supported:", fill=DARK_GRAY, font=font(13))
    browsers = ["Chrome", "Edge", "Opera", "Brave", "Vivaldi"]
    bx = 700
    for b in browsers:
        draw_rounded_rect(draw, (bx, bar_y + 115, bx + 65, bar_y + 135), 6, (35, 35, 55))
        draw.text((bx + 32, bar_y + 125), b, fill=GRAY, font=font(11), anchor="mm")
        bx += 75

    img.save(os.path.join(OUT_DIR, "promo_1400x560.png"), "PNG")
    print("Large promo saved")


create_screenshot1()
create_screenshot2()
create_screenshot3()
create_small_promo()
create_large_promo()
print(f"\nAll 5 images saved in: {OUT_DIR}")
