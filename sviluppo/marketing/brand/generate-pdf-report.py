"""
Shadow Shield / Veil — Business Plan PDF Generator
Genera un PDF professionale con grafici, tabelle e strategia
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable
)
from reportlab.lib import colors
from io import BytesIO

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "store-assets")
os.makedirs(OUT_DIR, exist_ok=True)
PDF_PATH = os.path.join(OUT_DIR, "Business-Plan-Veil.pdf")

# Colors
PURPLE = HexColor("#7c5cfc")
DARK = HexColor("#0a0a1a")
GRAY = HexColor("#666666")
GREEN = HexColor("#4ade80")
RED = HexColor("#f43f5e")
WHITE = HexColor("#ffffff")
LIGHT_BG = HexColor("#f5f5ff")

# =============================================
# CHART GENERATORS
# =============================================

def chart_market_share():
    """Grafico quote di mercato ad blocker"""
    fig, ax = plt.subplots(figsize=(7, 4))
    names = ['AdBlock\nPlus', 'Brave\nBrowser', 'Ghostery', 'AdBlock', 'uBlock\nOrigin', 'AdGuard', 'Privacy\nBadger', 'Veil\n(target Y1)']
    users = [400, 100, 100, 63, 45, 17, 1, 0.05]
    colors_list = ['#cccccc', '#cccccc', '#cccccc', '#cccccc', '#cccccc', '#cccccc', '#cccccc', '#7c5cfc']

    bars = ax.barh(names, users, color=colors_list, height=0.6, edgecolor='white', linewidth=0.5)
    ax.set_xlabel('Milioni di utenti', fontsize=10)
    ax.set_title('Mercato Ad Blocker — Utenti (milioni)', fontsize=13, fontweight='bold', pad=15)
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f'{x:.0f}M'))
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    for bar, val in zip(bars, users):
        ax.text(bar.get_width() + 2, bar.get_y() + bar.get_height()/2,
                f'{val:.0f}M' if val >= 1 else f'{val*1000:.0f}K', va='center', fontsize=9)

    plt.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf

def chart_pricing():
    """Grafico confronto prezzi mensili"""
    fig, ax = plt.subplots(figsize=(7, 3.5))
    names = ['Veil Pro', 'Ghostery', 'AdGuard\nApp', 'AdBlock\nPlus', 'Total\nAdblock']
    prices = [1.50, 2.00, 3.33, 4.00, 8.25]
    colors_list = ['#7c5cfc', '#aaaaaa', '#aaaaaa', '#aaaaaa', '#aaaaaa']

    bars = ax.bar(names, prices, color=colors_list, width=0.5, edgecolor='white')
    ax.set_ylabel('Euro/mese', fontsize=10)
    ax.set_title('Confronto Prezzi Mensili', fontsize=13, fontweight='bold', pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.set_ylim(0, 10)

    for bar, val in zip(bars, prices):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.2,
                f'{val:.2f}', ha='center', fontsize=11, fontweight='bold')

    plt.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf

def chart_lifetime():
    """Grafico confronto lifetime pricing"""
    fig, ax = plt.subplots(figsize=(5, 3))
    names = ['Veil', 'AdGuard']
    prices = [19.90, 99.99]
    colors_list = ['#7c5cfc', '#aaaaaa']

    bars = ax.bar(names, prices, color=colors_list, width=0.4)
    ax.set_title('Confronto Prezzo Lifetime', fontsize=13, fontweight='bold', pad=15)
    ax.set_ylabel('Euro', fontsize=10)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    for bar, val in zip(bars, prices):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 2,
                f'{val:.2f}', ha='center', fontsize=13, fontweight='bold')

    plt.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf

def chart_revenue():
    """Grafico proiezione revenue 3 anni"""
    fig, ax = plt.subplots(figsize=(7, 4))
    years = ['Anno 1', 'Anno 2', 'Anno 3']
    revenue = [95, 430, 1340]
    downloads = [50, 200, 500]

    ax2 = ax.twinx()

    bars = ax.bar(years, revenue, color='#7c5cfc', width=0.35, alpha=0.8, label='Revenue (K EUR)')
    line = ax2.plot(years, downloads, color='#4ade80', marker='o', linewidth=2.5, markersize=8, label='Download (K)')

    ax.set_ylabel('Revenue (migliaia EUR)', fontsize=10)
    ax2.set_ylabel('Download (migliaia)', fontsize=10, color='#4ade80')
    ax.set_title('Proiezione Revenue e Download — 3 Anni', fontsize=13, fontweight='bold', pad=15)
    ax.spines['top'].set_visible(False)
    ax2.spines['top'].set_visible(False)

    for bar, val in zip(bars, revenue):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 20,
                f'{val}K', ha='center', fontsize=11, fontweight='bold', color='#7c5cfc')

    lines, labels = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines + lines2, labels + labels2, loc='upper left', fontsize=9)

    plt.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf

def chart_extension_size():
    """Grafico confronto dimensioni estensione"""
    fig, ax = plt.subplots(figsize=(6, 3))
    names = ['Veil', 'uBlock\nLite', 'ABP', 'AdGuard']
    sizes = [0.149, 1.5, 2.8, 3.2]
    colors_list = ['#7c5cfc', '#aaaaaa', '#aaaaaa', '#aaaaaa']

    bars = ax.barh(names, sizes, color=colors_list, height=0.5)
    ax.set_xlabel('Dimensione (MB)', fontsize=10)
    ax.set_title('Dimensione Estensione (MB)', fontsize=13, fontweight='bold', pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    for bar, val in zip(bars, sizes):
        label = f'{val:.0f} KB' if val < 1 else f'{val:.1f} MB'
        ax.text(bar.get_width() + 0.05, bar.get_y() + bar.get_height()/2,
                label, va='center', fontsize=10, fontweight='bold')

    plt.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf

def chart_funnel():
    """Grafico funnel conversione"""
    fig, ax = plt.subplots(figsize=(6, 4))
    stages = ['Impression\nStore', 'Download', 'Utente\nAttivo 7gg', 'Trial\nPro', 'Pagante']
    values = [100, 30, 20, 5, 2]
    colors_list = ['#d4d4ff', '#b8a9ff', '#9b8aff', '#7c5cfc', '#4c3ad4']

    bars = ax.barh(stages[::-1], values[::-1], color=colors_list[::-1], height=0.6)
    ax.set_xlabel('% del totale', fontsize=10)
    ax.set_title('Funnel di Conversione Stimato', fontsize=13, fontweight='bold', pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    for bar, val in zip(bars, values[::-1]):
        ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                f'{val}%', va='center', fontsize=11, fontweight='bold')

    plt.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf

# =============================================
# PDF BUILDER
# =============================================

def build_pdf():
    doc = SimpleDocTemplate(
        PDF_PATH, pagesize=A4,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        leftMargin=2*cm, rightMargin=2*cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'],
        fontSize=28, spaceAfter=6, textColor=HexColor('#1a1a2e'), fontName='Helvetica-Bold')
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
        fontSize=14, spaceAfter=20, textColor=GRAY, fontName='Helvetica')
    h1_style = ParagraphStyle('H1', parent=styles['Heading1'],
        fontSize=18, spaceBefore=20, spaceAfter=10, textColor=HexColor('#1a1a2e'),
        fontName='Helvetica-Bold')
    h2_style = ParagraphStyle('H2', parent=styles['Heading2'],
        fontSize=14, spaceBefore=15, spaceAfter=8, textColor=PURPLE, fontName='Helvetica-Bold')
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, spaceAfter=8, leading=14, fontName='Helvetica')
    small_style = ParagraphStyle('Small', parent=styles['Normal'],
        fontSize=8, textColor=GRAY, fontName='Helvetica')
    bold_style = ParagraphStyle('Bold', parent=body_style, fontName='Helvetica-Bold')

    elements = []

    def hr():
        elements.append(Spacer(1, 5))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#e0e0e0')))
        elements.append(Spacer(1, 5))

    def add_table(data, col_widths=None, header=True):
        style_cmds = [
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#d0d0d0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]
        if header:
            style_cmds += [
                ('BACKGROUND', (0, 0), (-1, 0), PURPLE),
                ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
            ]
            for row in range(1, len(data)):
                if row % 2 == 0:
                    style_cmds.append(('BACKGROUND', (0, row), (-1, row), LIGHT_BG))

        t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
        t.setStyle(TableStyle(style_cmds))
        elements.append(t)

    def add_chart(chart_func, width=16*cm, height=9*cm):
        buf = chart_func()
        elements.append(Image(buf, width=width, height=height))

    # =============================================
    # PAGE 1: COVER
    # =============================================
    elements.append(Spacer(1, 4*cm))
    elements.append(Paragraph("VEIL", ParagraphStyle('Cover', fontSize=52,
        textColor=PURPLE, fontName='Helvetica-Bold', alignment=TA_CENTER)))
    elements.append(Paragraph("Browse Unveiled.", ParagraphStyle('CoverSub', fontSize=18,
        textColor=GRAY, fontName='Helvetica', alignment=TA_CENTER, spaceAfter=30)))
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("Business Plan & Strategia Commerciale", ParagraphStyle('CoverTitle',
        fontSize=22, textColor=HexColor('#1a1a2e'), fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=10)))
    elements.append(Paragraph("Ad Blocker Chrome — Stealth Anti-Detection", ParagraphStyle('CoverDesc',
        fontSize=14, textColor=GRAY, fontName='Helvetica', alignment=TA_CENTER, spaceAfter=40)))
    hr()
    elements.append(Paragraph("Aprile 2026 | Versione 1.0 | Confidenziale", small_style))
    elements.append(PageBreak())

    # =============================================
    # PAGE 2: EXECUTIVE SUMMARY
    # =============================================
    elements.append(Paragraph("1. Executive Summary", h1_style))
    elements.append(Paragraph(
        "<b>Veil</b> e' un ad blocker per Chrome leggero (ultraleggera), invisibile ai sistemi anti-adblock, "
        "con un modello freemium a prezzi accessibili (1.50 EUR/mese). Si inserisce nel mercato sfruttando "
        "il vuoto lasciato da uBlock Origin (disabilitato su Chrome dopo Manifest V3) e il conflitto "
        "di interessi di AdBlock Plus (vende whitelist ad aziende).", body_style))

    elements.append(Paragraph("Opportunita' di mercato", h2_style))
    add_table([
        ['Metrica', 'Valore'],
        ['Utenti ad blocker globali', '912 milioni (2026)'],
        ['Utenti Chrome', '3.4 miliardi'],
        ['uBlock Origin utenti orfani (Chrome)', '~29 milioni'],
        ['TAM (Total Addressable Market)', '~500M utenti Chrome che vogliono blocco ads'],
        ['SAM (Serviceable)', '~50M utenti attivi cercano alternativa post-MV3'],
        ['Target Anno 1', '50,000 download'],
    ], col_widths=[9*cm, 8*cm])

    elements.append(PageBreak())

    # =============================================
    # PAGE 3: ANALISI COMPETITOR
    # =============================================
    elements.append(Paragraph("2. Analisi Competitor", h1_style))
    add_chart(chart_market_share, width=16*cm, height=8.5*cm)
    elements.append(Spacer(1, 0.5*cm))

    elements.append(Paragraph("Matrice competitiva", h2_style))
    add_table([
        ['Tool', 'Utenti', 'Prezzo', 'Stealth', 'Whitelist\nAds', 'Vende\nDati', 'Dim.'],
        ['Veil (noi)', '—', '1.50/mo', 'SI', 'NO', 'NO', 'ultraleggera'],
        ['uBlock Lite', '16M', 'Free', 'NO', 'NO', 'NO', '1.5MB'],
        ['AdBlock Plus', '400M', '4/mo', 'NO', 'SI', 'NO', '2.8MB'],
        ['AdBlock', '63M', 'Free', 'NO', 'SI', 'NO', '2MB'],
        ['AdGuard', '17M', '3.3/mo', 'App', 'NO', 'NO', '3.2MB'],
        ['Ghostery', '100M+', '2-12/mo', 'NO', 'NO', 'Ex-si', '1MB'],
        ['Total Adblock', 'N/D', '8.25/mo', 'NO', 'NO', '?', '?'],
        ['Stands', 'N/D', 'Free', 'NO', 'NO', 'SI', '?'],
    ], col_widths=[2.5*cm, 1.8*cm, 2*cm, 1.5*cm, 1.8*cm, 1.5*cm, 1.5*cm])

    elements.append(Paragraph("Problemi dei competitor", h2_style))
    add_table([
        ['Competitor', 'Problema principale'],
        ['uBlock Origin', 'Disabilitato su Chrome (Manifest V3). La versione Lite ha 1/10 della capacita\''],
        ['AdBlock Plus', 'Guadagna vendendo whitelist: aziende pagano per far passare le ads'],
        ['AdBlock', 'Stesso conflitto di ABP (Acceptable Ads attivo per default)'],
        ['Total Adblock', 'Pricing ingannevole: 19 EUR primo anno poi 99 EUR senza avviso chiaro'],
        ['Stands', 'Vende i dati di navigazione degli utenti a data broker'],
        ['Ghostery', 'Passato controverso: vendeva dati utente (cambiato dal 2017)'],
    ], col_widths=[3.5*cm, 13.5*cm])

    elements.append(PageBreak())

    # =============================================
    # PAGE 4: VANTAGGI COMPETITIVI
    # =============================================
    elements.append(Paragraph("3. Vantaggi Competitivi", h1_style))

    add_chart(chart_extension_size, width=14*cm, height=7*cm)
    elements.append(Spacer(1, 0.5*cm))

    elements.append(Paragraph("I nostri 6 differenziatori", h2_style))
    add_table([
        ['#', 'Differenziatore', 'Dettaglio'],
        ['1', 'Piu\' leggero di tutti', 'ultraleggera vs 1.5-3.2 MB dei competitor (20x piu\' leggero)'],
        ['2', 'Stealth anti-detection', 'Unico ad blocker Chrome con evasione anti-adblock attiva'],
        ['3', 'Zero whitelist', 'Non vendiamo spazio alle aziende per mostrare ads'],
        ['4', 'Zero data selling', 'Non raccogliamo ne\' vendiamo dati degli utenti'],
        ['5', 'Prezzo piu\' basso', '1.50/mese vs 2-8 EUR dei competitor paganti'],
        ['6', 'Lifetime accessibile', '19.90 EUR vs 100 EUR di AdGuard'],
    ], col_widths=[1*cm, 4*cm, 12*cm])

    elements.append(PageBreak())

    # =============================================
    # PAGE 5: PRICING
    # =============================================
    elements.append(Paragraph("4. Modello di Pricing", h1_style))

    add_chart(chart_pricing, width=16*cm, height=8*cm)
    elements.append(Spacer(1, 0.5*cm))

    elements.append(Paragraph("Struttura tier", h2_style))
    add_table([
        ['', 'Free (forever)', 'Pro', 'Lifetime'],
        ['Prezzo', '0 EUR', '1.50/mese\n15/anno (2 mesi gratis)', '19.90 una tantum'],
        ['Blocco ads network', 'SI (107 regole)', 'SI (500+ regole)', 'SI (500+ regole)'],
        ['CSS hiding', 'SI', 'SI', 'SI'],
        ['YouTube ad skip', 'SI (base)', 'SI (avanzato)', 'SI (avanzato)'],
        ['Stealth anti-detection', 'NO', 'SI', 'SI'],
        ['Auto-cookie consent', 'NO', 'SI', 'SI'],
        ['Statistiche dettagliate', 'NO', 'SI', 'SI'],
        ['Whitelist per sito', 'SI', 'SI', 'SI'],
        ['Supporto', 'Community', 'Email prioritario', 'Email prioritario'],
    ], col_widths=[4*cm, 4.5*cm, 4.5*cm, 4*cm])

    elements.append(Spacer(1, 0.5*cm))
    add_chart(chart_lifetime, width=12*cm, height=7*cm)

    elements.append(PageBreak())

    # =============================================
    # PAGE 6: REVENUE PROJECTION
    # =============================================
    elements.append(Paragraph("5. Proiezione Finanziaria", h1_style))

    add_chart(chart_revenue, width=16*cm, height=8.5*cm)
    elements.append(Spacer(1, 0.5*cm))

    add_table([
        ['Metrica', 'Anno 1', 'Anno 2', 'Anno 3'],
        ['Download totali', '50,000', '200,000', '500,000'],
        ['Utenti free', '45,000 (90%)', '176,000 (88%)', '425,000 (85%)'],
        ['Abbonati Pro', '2,000', '10,000', '30,000'],
        ['Acquisti Lifetime', '3,000', '14,000', '45,000'],
        ['Revenue annuale', '~95,000 EUR', '~430,000 EUR', '~1,340,000 EUR'],
        ['Costi operativi', '~5,000 EUR', '~30,000 EUR', '~100,000 EUR'],
        ['Margine', '~90,000 EUR', '~400,000 EUR', '~1,240,000 EUR'],
    ], col_widths=[4*cm, 4.3*cm, 4.3*cm, 4.3*cm])

    elements.append(Paragraph("<i>Costi operativi: hosting sito, Stripe fees (2.9%), supporto, tools. "
        "Nessun costo server per l'estensione (gira nel browser dell'utente).</i>", small_style))

    elements.append(PageBreak())

    # =============================================
    # PAGE 7: STRATEGIA ZERO BUDGET
    # =============================================
    elements.append(Paragraph("6. Go-To-Market a Budget Zero", h1_style))

    elements.append(Paragraph(
        "La strategia si basa su <b>distribuzione organica</b>: il Chrome Web Store e' il nostro canale "
        "di acquisizione principale (gratuito). Ogni canale sotto ha costo zero.", body_style))

    add_chart(chart_funnel, width=14*cm, height=8.5*cm)
    elements.append(Spacer(1, 0.5*cm))

    elements.append(Paragraph("Canali di acquisizione (tutti gratuiti)", h2_style))
    add_table([
        ['Canale', 'Azione', 'Utenti stimati', 'Costo'],
        ['Chrome Web Store', 'Listing ottimizzato con keyword SEO, screenshot, video demo', '30,000/anno', '0 (5 EUR registrazione)'],
        ['Product Hunt', 'Lancio con tag Ad Blocker + Privacy + Chrome Extension', '5,000 in 1 settimana', '0'],
        ['Reddit', 'Post su r/privacy, r/chrome, r/uBlockOrigin (29M utenti orfani)', '3,000/mese', '0'],
        ['Hacker News', 'Show HN: post tecnico su stealth anti-detection', '2,000 in 1 giorno', '0'],
        ['SEO Blog', '3 articoli: "best ad blocker chrome 2026", "ublock alternative"', '5,000/mese dopo 3 mesi', '0'],
        ['YouTube IT', 'Contattare 5 YouTuber tech italiani per review gratuita', '2,000-10,000', '0'],
        ['Passaparola', 'Referral: invita amico = 1 mese Pro gratis', 'Virale', '0 (costo opportunita\')'],
        ['GitHub', 'Open source parziale per credibilita\' community', 'Trust signal', '0'],
    ], col_widths=[3*cm, 6.5*cm, 3*cm, 4.5*cm])

    elements.append(Paragraph("Strategia temporale", h2_style))
    add_table([
        ['Fase', 'Periodo', 'Azioni', 'Obiettivo'],
        ['Pre-lancio', 'Settimana 1-2', 'Sito landing, privacy policy, store listing', 'Presenza online'],
        ['Lancio', 'Settimana 3', 'Product Hunt + Reddit + HN + store live', '5,000 download'],
        ['Crescita org.', 'Mese 2-3', 'SEO blog, YouTube, referral program', '20,000 download'],
        ['Espansione', 'Mese 4-6', 'Firefox/Edge, localizzazione DE/FR/ES', '50,000 download'],
        ['Monetizzazione', 'Mese 3+', 'Lancio Pro tier, A/B test pricing', '2% conversion'],
    ], col_widths=[3*cm, 3*cm, 6*cm, 5*cm])

    elements.append(PageBreak())

    # =============================================
    # PAGE 8: COME ENTRARE NEL MERCATO
    # =============================================
    elements.append(Paragraph("7. Come Entrare in un Mercato da 912M di Utenti a Budget Zero", h1_style))

    elements.append(Paragraph("Il segreto: non competere su tutto, domina una nicchia", h2_style))
    elements.append(Paragraph(
        "Non cerchiamo di battere uBlock Origin o AdBlock Plus frontalmente. "
        "Ci posizioniamo nella <b>nicchia specifica</b> che nessuno serve:", body_style))

    add_table([
        ['Nicchia', 'Dimensione', 'Perche\' e\' nostra'],
        ['Utenti Chrome che vogliono\nad blocker DOPO la morte\ndi uBlock Origin', '~29M', 'uBlock Lite ha 1/10 della capacita\'.\nNoi siamo la vera alternativa MV3.'],
        ['Utenti che hanno siti\nche rilevano l\'ad blocker\ne li bloccano', '~100M+', 'Siamo l\'UNICO con stealth\nanti-detection su Chrome.'],
        ['Utenti italiani', '~5M', 'Nessun competitor e\' pensato\nper il mercato italiano.'],
        ['Utenti attenti al prezzo\n(vs AdGuard 100 EUR lifetime)', '~50M', 'Lifetime a 19.90 EUR.\n5x meno del competitor.'],
    ], col_widths=[4.5*cm, 2.5*cm, 10*cm])

    elements.append(Paragraph("Flywheel della crescita", h2_style))
    elements.append(Paragraph(
        "<b>1.</b> Utente scarica gratis dal Chrome Store -> "
        "<b>2.</b> Funziona bene, nessun sito lo rileva -> "
        "<b>3.</b> Lascia recensione 5 stelle -> "
        "<b>4.</b> Ranking sale sullo store -> "
        "<b>5.</b> Piu' download organici -> "
        "<b>6.</b> Piu' recensioni -> ripeti. "
        "Questo ciclo e' gratuito e si auto-alimenta.", body_style))

    elements.append(Paragraph("Le 3 mosse che costano zero e generano migliaia di utenti", h2_style))

    elements.append(Paragraph("<b>Mossa 1: Il Post Reddit da 10,000 utenti</b>", bold_style))
    elements.append(Paragraph(
        "Scrivi un post su r/uBlockOrigin: 'Ho costruito un ad blocker MV3 che funziona davvero su Chrome. "
        "Stealth mode incluso. Gratuito.' Questo subreddit ha 29M di utenti frustrati dalla morte di uBlock "
        "su Chrome. Un post genuino (non spam) puo' generare 10,000+ download in 48 ore.", body_style))

    elements.append(Paragraph("<b>Mossa 2: Product Hunt Launch</b>", bold_style))
    elements.append(Paragraph(
        "Prepara screenshot professionali, video GIF di 30 secondi, descrizione chiara. "
        "Lancia di martedi' mattina (massimo traffico). Con la giusta presentazione, "
        "un tool privacy/ad-block puo' fare 500-1000 upvote e finire in homepage.", body_style))

    elements.append(Paragraph("<b>Mossa 3: Il Video YouTube 'Ho battuto AdBlock Plus'</b>", bold_style))
    elements.append(Paragraph(
        "Crea un video confronto: 'Ho testato 10 ad blocker su 50 siti. Ecco quale vince.' "
        "Mostra test reali con screenshot. Il video si posiziona su YouTube per keyword come "
        "'best ad blocker 2026'. Genera download per mesi.", body_style))

    elements.append(PageBreak())

    # =============================================
    # PAGE 9: RISCHI
    # =============================================
    elements.append(Paragraph("8. Rischi e Mitigazione", h1_style))

    add_table([
        ['Rischio', 'Prob.', 'Impatto', 'Mitigazione'],
        ['Google rifiuta estensione\nper override API', 'Media', 'Alto', 'Softare stealth.js prima del submit.\nRimuovere override piu\' aggressive.'],
        ['YouTube cambia sistema\nad ogni mese', 'Alta', 'Medio', 'Aggiornamenti frequenti.\nCommunity segnala bug.'],
        ['Basso tasso conversione\nfree -> Pro', 'Alta', 'Medio', 'A/B test pricing e feature.\nMigliorare valore Pro.'],
        ['Competitor copiano\nstealth mode', 'Bassa', 'Basso', 'First mover advantage.\nBrand reputation.'],
        ['Google banna tutti\ngli ad blocker', 'Molto bassa', 'Critico', 'Supportare Firefox, Edge, Safari.\nDiversificare.'],
    ], col_widths=[4*cm, 2*cm, 2*cm, 9*cm])

    # =============================================
    # PAGE 10: NEXT STEPS
    # =============================================
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("9. Prossimi Passi Immediati", h1_style))

    add_table([
        ['#', 'Azione', 'Tempo', 'Priorita\''],
        ['1', 'Decidere nome definitivo (Veil?)', '—', 'CRITICO'],
        ['2', 'Comprare dominio (.app o .com)', '10 min', 'CRITICO'],
        ['3', 'Pulire codice (file morti, permessi extra, stealth soft)', '2 ore', 'CRITICO'],
        ['4', 'Creare privacy policy', '1 ora', 'CRITICO'],
        ['5', 'Pubblicare su Chrome Web Store', '2 ore', 'ALTO'],
        ['6', 'Creare sito landing page', '2-3 giorni', 'ALTO'],
        ['7', 'Implementare sistema Free/Pro (Stripe)', '3-5 giorni', 'ALTO'],
        ['8', 'Lanciare su Product Hunt + Reddit', '1 giorno', 'ALTO'],
        ['9', 'Scrivere 3 articoli blog SEO', '3 giorni', 'MEDIO'],
        ['10', 'Supportare Firefox/Edge', '2 giorni', 'MEDIO'],
    ], col_widths=[1*cm, 8*cm, 3*cm, 5*cm])

    elements.append(Spacer(1, 2*cm))
    hr()
    elements.append(Paragraph(
        "Veil — Browse Unveiled. | Documento confidenziale | Aprile 2026",
        ParagraphStyle('Footer', fontSize=9, textColor=GRAY, alignment=TA_CENTER)))

    # BUILD
    doc.build(elements)
    print(f"PDF generato: {PDF_PATH}")
    print(f"Dimensione: {os.path.getsize(PDF_PATH) / 1024:.0f} KB")

if __name__ == "__main__":
    build_pdf()
