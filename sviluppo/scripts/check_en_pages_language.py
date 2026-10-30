"""Check che le pagine EN di site/ siano davvero in inglese.

Gate pre-deploy. Il 2026-08-22 /community, /press, /how-it-works e /unique-tech erano
marcate lang="en" ma contenevano testo italiano. Il gate esistente
`prose_i18n.py check-all` confronta struttura e contenuto delle pagine i18n,
ma NON verifica che il testo sia effettivamente nella lingua indicata.
Questo script colma quel gap: scopre automaticamente tutte le pagine EN
(tutti i site/**/*.html fuori dalle sottocartelle lingua e con <html lang="en">)."""
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

SITE = Path(__file__).resolve().parents[2] / "site"

# Lingue con sottocartella dedicata in site/ (fonte: LANGS in i18n_manager.py)
LANGS = ["it", "de", "fr", "es", "pt", "ru", "ar", "zh", "hi", "ja", "ko", "tr", "id", "pl"]

# ponytail: mgmt-9f4a usa il reset-password del worker license-system; en/withdrawal
# contiene l'appendice legale "Versione italiana" del modulo di recesso (obbligatoria)
LEGACY_EXCLUDED = {
    "mgmt-9f4a/index.html",
    "en/withdrawal.html",
}


def discover_en_pages():
    """Torna la lista dei path .html EN: fuori dalle cartelle lingua, lang="en"."""
    pages = []
    for path in sorted(SITE.rglob("*.html")):
        rel = path.relative_to(SITE)
        if rel.parts and rel.parts[0] in LANGS or str(rel) in LEGACY_EXCLUDED:
            continue
        head = path.read_text(encoding="utf-8", errors="replace")[:512]
        if re.search(r'<html[^>]*\blang="en"', head):
            pages.append(path)
    return pages

IT_WORDS = {
    "il", "lo", "la", "gli", "le", "un", "una", "che", "non", "con", "sono",
    "più", "della", "delle", "degli", "anche", "questo", "questa", "ogni",
    "senza", "puoi", "tuo", "tua", "nostra", "viene", "essere", "fare", "del",
    "nel", "alla", "dei", "ciò", "tutto", "serve", "lettura", "aggiornato",
    "quando", "dove", "livello", "livelli", "funziona", "annunci", "pubblicitari",
    "sulla", "nelle", "agli",
}

EN_WORDS = {
    "the", "and", "for", "with", "you", "your", "this", "that", "from", "are",
    "what", "how", "they", "will", "can", "not", "our", "their", "been", "more",
    "each", "without", "than", "when", "where", "level", "ads", "page", "site",
    "is", "of", "to", "in", "on", "it", "as", "by",
}

MIN_LEN = 6


def italian_nodes(html):
    soup = BeautifulSoup(html, "html.parser")
    suspicious = []
    skip_parents = {"script", "style", "noscript"}
    for node in soup.body.find_all(string=True):
        if node.parent.name in skip_parents:
            continue
        text = re.sub(r"\s+", " ", node).strip()
        if len(text) < MIN_LEN:
            continue
        words = re.findall(r"[a-zàèéìòù]+", text.lower())
        it_count = sum(1 for w in words if w in IT_WORDS)
        en_count = sum(1 for w in words if w in EN_WORDS)
        if it_count > en_count and it_count >= 1:
            suspicious.append(text[:80])
    return suspicious


def main() -> int:
    problems = 0
    pages = discover_en_pages()
    for path in pages:
        slug = path.relative_to(SITE)
        html = path.read_text(encoding="utf-8")
        nodes = italian_nodes(html)
        if nodes:
            problems += len(nodes)
            print(f"  ✗ {slug}: {len(nodes)} nodi in italiano")
            for n in nodes[:5]:
                print(f"      {n}")
    if problems > 0:
        print(f"[check-en-lang] {problems} problemi — le pagine EN non sono in inglese")
        return 1
    print(f"[check-en-lang] {len(pages)} pagine EN: ✓ inglese")
    return 0


if __name__ == "__main__":
    sys.exit(main())
