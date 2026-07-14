#!/usr/bin/env python3
"""
AdOff — Validatore indipendente di site/ per l'agente SEO.

Gira PRIMA di proporre una modifica e PRIMA del deploy: cattura gli errori che
l'agente auto-dichiara "validi" ma non sono (es. il bug ricorrente del JSON-LD
cinese con virgolette ASCII non-escapate che invalidava lo schema).

Controlli:
  1. JSON-LD: ogni <script type="application/ld+json"> deve essere JSON valido.
     Errore = BLOCCANTE (exit 2).
  2. FAQPage: se c'è un FAQPage in JSON-LD, conta le Q&A (sanity > 0).
  3. Congruenza numeri: cerca valori STANTII noti (prezzi/trial/regole/lingue
     vecchi) che violano la regola pre-deploy. Default = warning; --strict = blocca.

Uso:
  python3 validate_site.py                 # valida tutto site/
  python3 validate_site.py --strict        # anche i numeri stantii bloccano
  python3 validate_site.py --files a.html b.html   # solo alcuni file
Exit: 0 ok · 2 JSON-LD invalido · 3 numeri stantii in --strict
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, "site")

LDJSON_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.S | re.I,
)

# Valori STANTII noti = bug di congruenza (visti nel run 2026-06-07).
# I prezzi sono "currency-anchored" (devono avere un indicatore valuta entro ±18
# char) per non segnalare i falsi positivi nei path SVG (es. "-2.69-" nel logo).
_CUR = r"(?:EUR|€|&#8364;|\$|£|¥|₹|zł|₺|руб|грн|يورو|円|원|欧元|元|유로)"
PRICE_PATTERNS = [
    (r"2[.,]69", "prezzo mensile vecchio 2,69 (ora 2,99)"),
    (r"29[.,]59", "prezzo annuale vecchio 29,59 (ora 19,99/24,99)"),
    (r"67[.,]90", "prezzo lifetime vecchio 67,90 (ora 99)"),
]
WORD_PATTERNS = [
    (r"\b15[\s\-]?(giorni|days|jours|tage|días|dias|gün|dni|日|일|दिन|أيام|hari)\b", "trial vecchio 15gg (ora 30)"),
    (r"\b107\s*(regole|rules|reglas|regras|règles|regeln|правил|kural|reguł|قواعد|규칙)\b", "conteggio regole vecchio 107 (ora 138)"),
    (r"\b6\s*(lingue|languages|idiomas|langues|sprachen|языков|diller|언어)\b", "conteggio lingue vecchio 6 (ora 15)"),
]


def list_html(files):
    if files:
        return [f if os.path.isabs(f) else os.path.join(SITE, f) for f in files]
    out = []
    for dirpath, _, names in os.walk(SITE):
        for n in names:
            if n.endswith(".html"):
                out.append(os.path.join(dirpath, n))
    return sorted(out)


def validate_ldjson(path, text):
    """Ritorna (errori[], faq_qcount)."""
    errors, faq_q = [], 0
    for i, block in enumerate(LDJSON_RE.findall(text)):
        raw = block.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            snippet = raw[max(0, e.pos - 30):e.pos + 30].replace("\n", " ")
            errors.append(f"JSON-LD #{i+1} invalido @pos {e.pos}: {e.msg} … «{snippet}»")
            continue
        for node in (data if isinstance(data, list) else [data]):
            if isinstance(node, dict) and node.get("@type") == "FAQPage":
                faq_q += len(node.get("mainEntity", []) or [])
    return errors, faq_q


def find_stale(text):
    hits = []
    # Prezzi: solo se c'è un indicatore valuta entro ±18 char (no falsi positivi SVG).
    for pat, desc in PRICE_PATTERNS:
        for m in re.finditer(pat, text):
            window = text[max(0, m.start() - 18):m.end() + 18]
            if re.search(_CUR, window):
                hits.append(desc)
                break
    for pat, desc in WORD_PATTERNS:
        if re.search(pat, text, re.I):
            hits.append(desc)
    return hits


LANGS = ["it", "en", "de", "fr", "es", "pt", "ru", "ar", "zh", "tr", "id", "pl", "hi", "ja", "ko"]
TITLE_MAX = 65
DESC_MAX = 165


def _existing_paths():
    s = set()
    for dp, _, names in os.walk(SITE):
        for n in names:
            s.add(os.path.relpath(os.path.join(dp, n), SITE))
    return s


def _resolve_internal(href, cur_rel):
    """Mappa un href interno a un path-file atteso (clean URL → file). None se esterno."""
    h = href.split("#")[0].split("?")[0].strip()
    if not h or h.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "data:")):
        return None
    if h.startswith("//"):
        return None
    if h.startswith("/"):
        p = h[1:]
    else:  # relativo alla dir corrente
        p = os.path.normpath(os.path.join(os.path.dirname(cur_rel), h))
    if p == "" or p.endswith("/"):
        return (p + "index.html").lstrip("/")
    if "." in os.path.basename(p):   # ha già estensione (file reale)
        return p
    return p + ".html"               # clean URL → file.html


def seo_lint(files):
    existing = _existing_paths()
    titles = {}
    issues = {"no_canonical": [], "title_len": [], "no_desc": [], "desc_len": [],
              "dup_title": [], "img_no_alt": [], "hreflang_incomplete": [], "broken_link": []}
    href_re = re.compile(r'href=["\']([^"\']+)["\']')
    for path in files:
        rel = os.path.relpath(path, SITE)
        try:
            t = open(path, encoding="utf-8").read()
        except Exception:
            continue
        if "<html" not in t.lower():
            continue
        # pagine noindex (account/admin/success/uninstall/mgmt): private/funzionali, NON
        # indicizzabili → esenti da canonical/meta-description (non sono residui SEO).
        is_noindex = bool(re.search(r'name=["\']robots["\'][^>]*noindex', t, re.I))
        # canonical
        if not is_noindex and not re.search(r'<link[^>]+rel=["\']canonical["\']', t, re.I):
            issues["no_canonical"].append(rel)
        # title
        m = re.search(r"<title[^>]*>(.*?)</title>", t, re.I | re.S)
        if m:
            title = re.sub(r"\s+", " ", m.group(1)).strip()
            if len(title) > TITLE_MAX:
                issues["title_len"].append(f"{rel} ({len(title)})")
            # Conta i title duplicati SOLO tra pagine self-canonical: una pagina con
            # canonical→altra URL (orfani /en/ consolidati, leftover /it/ legali) NON è una
            # cannibalizzazione reale (Google consolida sul canonical).
            cm = re.search(r'rel=["\']canonical["\'][^>]*href=["\']([^"\']*)["\']', t, re.I)
            own = re.sub(r'(/index)?\.html$', '', rel.replace(os.sep, "/"))
            own = '' if own == 'index' else own
            self_canon = True
            if cm:
                cpath = re.sub(r'^https?://[^/]+', '', cm.group(1)).strip('/')
                self_canon = (cpath == own)
            if self_canon:
                titles.setdefault(title, []).append(rel)
        # meta description
        md = re.search(r'<meta[^>]+name=["\']description["\'][^>]*content=["\']([^"\']*)["\']', t, re.I)
        if not md:
            if not is_noindex:
                issues["no_desc"].append(rel)
        elif len(md.group(1)) > DESC_MAX:
            issues["desc_len"].append(f"{rel} ({len(md.group(1))})")
        # img alt
        imgs = re.findall(r"<img\b[^>]*>", t, re.I)
        if any("alt=" not in im.lower() for im in imgs):
            issues["img_no_alt"].append(rel)
        # hreflang: se presente ma incompleto — flagga SOLO le lingue la cui pagina
        # sorella ESISTE davvero (evita falsi positivi su pagine bi-lingua come
        # about/chi-sono che esistono solo in EN+IT).
        hl = set(re.findall(r'hreflang=["\']([a-zA-Z-]+)["\']', t))
        if hl:
            # path-relativo lang-stripped (NON basename): altrimenti blog/index.html e
            # vs/<x>.html collidono con la homepage index.html / pagine root omonime.
            parts = rel.replace(os.sep, "/").split("/")
            pagepath = "/".join(parts[1:]) if parts[0] in LANGS else "/".join(parts)
            expected = {l for l in LANGS if f"{l}/{pagepath}" in existing}
            if pagepath in existing:          # versione root presente → serve il SUO root-lang
                try:
                    rt = open(os.path.join(SITE, pagepath), encoding="utf-8").read(4096)
                    rm = re.search(r'<html lang="([a-zA-Z-]+)"', rt)
                    if rm:
                        expected.add(rm.group(1).split("-")[0])
                except Exception:
                    expected |= {"it", "en"}
            missing = [l for l in sorted(expected) if l not in hl]
            if missing:
                issues["hreflang_incomplete"].append(f"{rel} (manca: {','.join(missing)})")
        # link interni rotti
        for href in href_re.findall(t):
            tgt = _resolve_internal(href, rel)
            if tgt and tgt not in existing:
                issues["broken_link"].append(f"{rel} → {href}")
    for title, pages in titles.items():
        if len(pages) > 1:
            issues["dup_title"].append(f'"{title[:50]}…" su {len(pages)} pagine')
    return issues


def print_seo_lint(issues):
    labels = {
        "no_canonical": "Senza <link canonical>",
        "title_len": f"Title > {TITLE_MAX} char",
        "no_desc": "Senza meta description",
        "desc_len": f"Meta description > {DESC_MAX} char",
        "dup_title": "Title DUPLICATI tra pagine",
        "img_no_alt": "Pagine con <img> senza alt",
        "hreflang_incomplete": "hreflang incompleto (15 lingue + x-default)",
        "broken_link": "Link interni rotti",
    }
    total = sum(len(v) for v in issues.values())
    print(f"\n=== SEO lint === ({total} segnalazioni)")
    for k, lab in labels.items():
        v = issues[k]
        if v:
            print(f"\n▸ {lab}: {len(v)}")
            for ex in v[:8]:
                print(f"    {ex}")
            if len(v) > 8:
                print(f"    … +{len(v) - 8} altri")
    if total == 0:
        print("✅ Nessun problema SEO rilevato.")
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--seo", action="store_true", help="esegue il lint SEO completo (hreflang/canonical/title/alt/link)")
    ap.add_argument("--files", nargs="*")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    files = list_html(args.files)
    ld_errors, stale_hits = {}, {}
    total_faq = 0
    for path in files:
        try:
            text = open(path, encoding="utf-8").read()
        except Exception as e:
            ld_errors[path] = [f"lettura fallita: {e}"]
            continue
        errs, faq = validate_ldjson(path, text)
        total_faq += faq
        if errs:
            ld_errors[path] = errs
        stale = find_stale(text)
        if stale:
            stale_hits[path] = stale

    rel = lambda p: os.path.relpath(p, SITE)
    if not args.quiet:
        print(f"[validate_site] {len(files)} file HTML · FAQ Q&A totali: {total_faq}")
    if ld_errors:
        print(f"\n❌ JSON-LD INVALIDO in {len(ld_errors)} file:")
        for p, errs in ld_errors.items():
            for e in errs:
                print(f"  - {rel(p)}: {e}")
    if stale_hits:
        print(f"\n⚠️  NUMERI STANTII in {len(stale_hits)} file:")
        for p, hits in stale_hits.items():
            print(f"  - {rel(p)}: {', '.join(hits)}")

    if args.seo:
        print_seo_lint(seo_lint(files))

    if ld_errors:
        sys.exit(2)
    if stale_hits and args.strict:
        sys.exit(3)
    if not args.quiet and not ld_errors and not stale_hits:
        print("✅ Tutto valido (JSON-LD ok, nessun numero stantio).")
    sys.exit(0)


if __name__ == "__main__":
    main()
