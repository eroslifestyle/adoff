#!/usr/bin/env python3
"""
AdOff — Keyword research SEO settimanale (fonte gratuita: Google Autocomplete).

Espande seed keyword multilingua con i suggerimenti reali di Google (le ricerche
"del momento"), li confronta con le query GSC su cui il sito già appare e produce:
  - keyword "gap"        : cercate dagli utenti ma su cui NON appari → nuovo contenuto
  - keyword "da spingere": già presenti in GSC in posizione 5-20
  - keyword "trend"      : suggerimenti freschi per cluster tematico

Output: .state/keyword_report.json + .state/keyword_report.md (usati dall'agente SEO).
Uso: python3 keyword_research.py   (legge .state/gsc_snapshot.json se presente)
"""
import json
import os
import time
import urllib.parse
import urllib.request

STATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".state")
SNAPSHOT = os.path.join(STATE_DIR, "gsc_snapshot.json")
OUT_JSON = os.path.join(STATE_DIR, "keyword_report.json")
OUT_MD = os.path.join(STATE_DIR, "keyword_report.md")
UA = "Mozilla/5.0 (compatible; adoff-seo/1.0)"
MAX_PER_LANG = 60  # cap keyword raccolte per lingua

# Seed per lingua — termini di categoria (no brand di terze parti nel set base)
SEEDS = {
    "en": ["ad blocker", "best ad blocker", "block ads", "adblock", "stop ads",
           "ad blocker chrome", "video ad blocker", "invisible ad blocker", "anti adblock"],
    "it": ["blocca pubblicità", "ad blocker", "bloccare pubblicità", "miglior ad blocker",
           "togliere pubblicità", "bloccare pubblicità chrome"],
    "es": ["bloqueador de anuncios", "bloquear publicidad", "mejor bloqueador de anuncios"],
    "pt": ["bloqueador de anúncios", "bloquear anúncios"],
    "fr": ["bloqueur de pub", "bloquer les pubs", "meilleur bloqueur de pub"],
    "de": ["werbeblocker", "werbung blockieren", "bester werbeblocker"],
    "ru": ["блокировка рекламы", "блокировщик рекламы"],
    "tr": ["reklam engelleyici", "en iyi reklam engelleyici"],
    "pl": ["blokowanie reklam", "blokada reklam"],
    "ja": ["広告ブロック", "広告ブロッカー"],
}


def autocomplete(query, hl):
    url = ("http://suggestqueries.google.com/complete/search?client=chrome&hl="
           + hl + "&q=" + urllib.parse.quote(query))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode("utf-8", "replace"))
        return [s for s in data[1] if isinstance(s, str)]
    except Exception:
        return []


def collect_for_lang(lang, seeds):
    found = {}
    for seed in seeds:
        for s in autocomplete(seed, lang):
            found[s.lower().strip()] = found.get(s.lower().strip(), 0) + 1
        # espansione di 2° livello: seed + lettera → più long-tail "del momento"
        for suffix in "abcm":
            for s in autocomplete(seed + " " + suffix, lang):
                found[s.lower().strip()] = found.get(s.lower().strip(), 0) + 1
            time.sleep(0.05)
        if len(found) >= MAX_PER_LANG:
            break
    return sorted(found.keys(), key=lambda k: -found[k])[:MAX_PER_LANG]


def load_gsc_queries():
    try:
        snap = json.load(open(SNAPSHOT)).get("snapshot") or {}
        q = {r["key"].lower(): r for r in snap.get("topQuery", [])}
        opp = {r["key"].lower(): r for r in snap.get("opportunities", [])}
        return q, opp
    except Exception:
        return {}, {}


def main():
    os.makedirs(STATE_DIR, exist_ok=True)
    gsc_q, gsc_opp = load_gsc_queries()
    gsc_keys = set(gsc_q.keys())

    by_lang, all_kw = {}, set()
    for lang, seeds in SEEDS.items():
        kws = collect_for_lang(lang, seeds)
        by_lang[lang] = kws
        all_kw.update(kws)

    # Gap: keyword reali cercate ma assenti dalle query GSC (no overlap parziale grezzo)
    gaps = []
    for kw in all_kw:
        if kw in gsc_keys:
            continue
        # escludi se una query GSC contiene già la keyword (copertura parziale)
        if any(kw in gk or gk in kw for gk in gsc_keys):
            continue
        gaps.append(kw)
    gaps = sorted(gaps)[:80]

    push = sorted(gsc_opp.values(), key=lambda r: -r["impressions"])

    report = {
        "generatedAt": int(time.time()),
        "languages": list(SEEDS.keys()),
        "totalKeywords": len(all_kw),
        "byLang": by_lang,
        "gaps": gaps,                         # nuove keyword da coprire
        "toPush": [{"q": r["key"], "position": r["position"], "impressions": r["impressions"]} for r in push],
        "gscQueryCount": len(gsc_keys),
    }
    json.dump(report, open(OUT_JSON, "w"), ensure_ascii=False, indent=2)

    # Markdown sintetico per il prompt dell'agente
    lines = ["# Keyword research settimanale AdOff", ""]
    lines.append(f"- Keyword candidate raccolte (Google Autocomplete, {len(SEEDS)} lingue): **{len(all_kw)}**")
    lines.append(f"- Query GSC attuali: {len(gsc_keys)}")
    lines.append("")
    lines.append("## Keyword GAP (cercate, ma il sito NON appare) — priorità nuovo contenuto")
    for g in gaps[:40]:
        lines.append(f"- {g}")
    lines.append("")
    lines.append("## Keyword DA SPINGERE (GSC pos 5-20)")
    for r in push[:20]:
        lines.append(f"- {r['key']} (pos {r['position']}, {r['impressions']} impr)")
    open(OUT_MD, "w").write("\n".join(lines))
    print(f"OK keyword research: {len(all_kw)} keyword, {len(gaps)} gap, {len(push)} da spingere → {OUT_MD}")


if __name__ == "__main__":
    main()
