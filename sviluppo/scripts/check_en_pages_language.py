"""Check che le 16 pagine EN "baked" nella root di site/ siano davvero in inglese.

Gate pre-deploy. Il 2026-08-22 /community, /press, /how-it-works e /unique-tech erano
marcate lang="en" ma contenevano testo italiano. Il gate esistente
`prose_i18n.py check-all` confronta struttura e contenuto delle pagine i18n,
ma NON verifica che il testo sia effettivamente nella lingua indicata.
Questo script colma quel gap per le pagine EN nella root di site/."""
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

SITE = Path(__file__).resolve().parents[2] / "site"

PAGES = [
    "how-it-works",
    "unique-tech",
    "community",
    "press",
    "best-ad-blocker-2026",
    "accessibility",
    "adblock-detector",
    "block-video-ads",
    "bypass-anti-adblock",
    "lightweight-ad-blocker",
    "manifest-v3-ad-blocker",
    "private-ad-blocker",
    "undetectable-ad-blocker",
    "vs/ublock-origin",
    "vs/adblock-plus",
    "vs/adguard",
]

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
    for slug in PAGES:
        path = SITE / f"{slug}.html"
        if not path.exists():
            print(f"  ✗ {slug}.html manca (EN vive nella root)")
            problems += 1
            continue
        html = path.read_text(encoding="utf-8")
        nodes = italian_nodes(html)
        if nodes:
            problems += len(nodes)
            print(f"  ✗ {slug}.html: {len(nodes)} nodi in italiano")
            for n in nodes[:5]:
                print(f"      {n}")
    if problems > 0:
        print(f"[check-en-lang] {problems} problemi — le pagine EN non sono in inglese")
        return 1
    print(f"[check-en-lang] {len(PAGES)} pagine EN: ✓ inglese")
    return 0


if __name__ == "__main__":
    sys.exit(main())
