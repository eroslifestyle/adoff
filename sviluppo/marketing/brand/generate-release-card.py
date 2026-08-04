from PIL import Image, ImageDraw, ImageFont
import os
import sys

# Uso: python3 generate-release-card.py <versione> <titoloRiga1> <titoloRiga2> <voce1> <voce2> <voce3>
if len(sys.argv) < 6:
    print("Uso: python3 generate-release-card.py <versione> <titoloRiga1> <titoloRiga2> <voce1> <voce2> <voce3>")
    sys.exit(1)

versione = sys.argv[1]
titolo_riga1 = sys.argv[2]
titolo_riga2 = sys.argv[3]
voce_1 = sys.argv[4]
voce_2 = sys.argv[5]
voce_3 = sys.argv[6]

COLORS = {
    'sfondo_profondo': (10, 10, 26),
    'blu_notte': (18, 18, 42),
    'viola_scudo': (124, 92, 252),
    'viola_tenue': (184, 169, 255),
    'bianco': (255, 255, 255),
    'testo_corpo': (226, 226, 240),
    'grigio_acciaio': (138, 138, 170),
    'verde_successo': (74, 222, 128),
}

WIDTH, HEIGHT = 1200, 628
MARGIN = 24
RADIUS = 28

def draw_rounded_rect(draw, xy, radius, fill):
    x1, y1, x2, y2 = xy
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.ellipse([x1, y1, x1 + radius * 2, y1 + radius * 2], fill=fill)
    draw.ellipse([x2 - radius * 2, y1, x2, y1 + radius * 2], fill=fill)
    draw.ellipse([x1, y2 - radius * 2, x1 + radius * 2, y2], fill=fill)
    draw.ellipse([x2 - radius * 2, y2 - radius * 2, x2, y2], fill=fill)

def load_font(primary_path, fallback_path, size):
    for path in [primary_path, fallback_path]:
        try:
            if path and os.path.exists(path):
                return ImageFont.truetype(path, size)
        except (OSError, IOError, TypeError):
            continue
    return ImageFont.load_default()

img = Image.new('RGB', (WIDTH, HEIGHT), COLORS['sfondo_profondo'])
draw = ImageDraw.Draw(img)

# Rettangolo blu notte con angoli arrotondati
draw_rounded_rect(draw, [MARGIN, MARGIN, WIDTH - MARGIN, HEIGHT - MARGIN], RADIUS, COLORS['blu_notte'])

# Barra accent verticale sinistra
ACCENT_X = 90
ACCENT_Y = 160
ACCENT_H = 105  # solo l'altezza del titolo: piu' in basso taglierebbe i punti elenco
draw_rounded_rect(draw, [ACCENT_X, ACCENT_Y, ACCENT_X + 6, ACCENT_Y + ACCENT_H], 3, COLORS['viola_scudo'])

# Logo in alto a destra
logo_path = 'sviluppo/marketing/BRAND-HUB/2-LOGHI/avatar-512.png'
if os.path.exists(logo_path):
    try:
        logo = Image.open(logo_path).convert('RGBA')
        logo = logo.resize((96, 96), Image.LANCZOS)
        img.paste(logo, (WIDTH - 80 - 96, 64), logo)
    except Exception:
        pass

# Caricamento font
font_small = load_font(
    'sviluppo/marketing/BRAND-HUB/1-IDENTITA/font/Lexend-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
font_title = load_font(
    'sviluppo/marketing/BRAND-HUB/1-IDENTITA/font/Lexend-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 46)
font_body = load_font(
    'sviluppo/marketing/BRAND-HUB/1-IDENTITA/font/Lexend-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
font_footer = load_font(
    'sviluppo/marketing/BRAND-HUB/1-IDENTITA/font/Lexend-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)

LEFT = 96

# Riga versione
draw.text((LEFT, 100), 'VERSION ' + versione, font=font_small, fill=COLORS['viola_tenue'])

# Titolo su due righe
y_title = 145
draw.text((LEFT, y_title), titolo_riga1, font=font_title, fill=COLORS['bianco'])
draw.text((LEFT, y_title + 55), titolo_riga2, font=font_title, fill=COLORS['bianco'])

# Elenco con pallini verdi
y_list = 265
items = [voce_1, voce_2, voce_3]
for item in items:
    draw.ellipse([LEFT - 20, y_list + 8, LEFT - 12, y_list + 16], fill=COLORS['verde_successo'])
    draw.text((LEFT, y_list), item, font=font_body, fill=COLORS['testo_corpo'])
    y_list += 40

# Riga finale
draw.text((LEFT, 415), 'adoff.app', font=font_footer, fill=COLORS['grigio_acciaio'])

# Salva
output_path = 'sviluppo/marketing/BRAND-HUB/3-IMMAGINI-SOCIAL/release-' + versione + '__1200x628__en.png'
os.makedirs(os.path.dirname(output_path), exist_ok=True)
img.save(output_path)
print(f"Salvato: {output_path}")
print(f"Dimensioni: {img.size}")
