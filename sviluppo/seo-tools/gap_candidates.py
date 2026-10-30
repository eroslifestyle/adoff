#!/usr/bin/env python3
"""
AdOff — Programmatic SEO: dai GAP keyword propone NUOVE pagine landing da creare.

L'agente settimanale finora RITOCCA pagine esistenti; questo modulo individua i
temi cercati dagli utenti per cui NON esiste ancora una pagina dedicata, così
l'agente può CREARE nuovo contenuto (il lever di crescita organica più grande).

Logica: raggruppa le keyword GAP (da keyword_report.json) per TEMA, propone uno
slug per tema, scarta i temi già coperti da una pagina esistente in site/, ordina
per numero di keyword del tema. Output: .state/page_candidates.{json,md}.

Uso: python3 gap_candidates.py   (legge .state/keyword_report.json)
"""
import json
import os
import re

STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".state")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, "site")
KW = os.path.join(STATE, "keyword_report.json")
OUT_JSON = os.path.join(STATE, "page_candidates.json")
OUT_MD = os.path.join(STATE, "page_candidates.md")

# Tema → (regex sui termini gap, slug pagina proposto, titolo guida).
# Solo temi coerenti col prodotto (ad blocker stealth/privacy/video/browser).
THEMES = [
    (r"\bbrave\b", "ad-blocker-brave", "Ad blocker per Brave"),
    (r"\bandroid\b|\bmobile\b|\bphone\b|\btelefono\b|\bcellulare\b", "android-ad-blocker", "Ad blocker per Android / mobile"),
    (r"\bedge\b", "ad-blocker-edge", "Ad blocker per Edge"),
    (r"\bopera\b", "ad-blocker-opera", "Ad blocker per Opera"),
    (r"\bfirefox\b", "ad-blocker-firefox", "Ad blocker per Firefox"),
    (r"\bsafari\b|\biphone\b|\bios\b", "ad-blocker-safari", "Ad blocker per Safari / iPhone"),
    (r"\bfree\b|\bgratis\b|\bgratuito\b|\bgratuit\b|\bkostenlos\b|\bبدون\b|\bمجاني\b|\bбесплат", "free-ad-blocker", "Ad blocker gratis"),
    (r"\bchrome\b", "ad-blocker-chrome", "Ad blocker per Chrome"),
    (r"\btwitch\b|\blive\b|\bstreaming\b", "ad-blocker-streaming", "Ad blocker per live streaming"),
    (r"\bpopup\b|\bpop-up\b|\bpop up\b", "popup-blocker", "Blocco popup"),
    (r"\btracker\b|\btracking\b|\bprivacy\b|\bspy\b", "tracker-blocker", "Blocco tracker / anti-tracking"),
    (r"\bgame\b|\bgaming\b|\btwitch\b", "ad-blocker-gaming", "Ad blocker per gaming"),
]


def existing_slugs():
    s = set()
    for n in os.listdir(SITE):
        if n.endswith(".html"):
            s.add(n[:-5].lower())
    return s


def main():
    try:
        kw = json.load(open(KW))
    except Exception:
        print("[gap_candidates] keyword_report.json assente — lancia prima keyword_research.py")
        return
    gaps = [g.lower() for g in kw.get("gaps", [])]
    have = existing_slugs()

    cands = []
    used_gaps = set()
    for pat, slug, title in THEMES:
        if slug in have:
            continue
        matched = [g for g in gaps if re.search(pat, g)]
        if len(matched) < 2:          # serve un minimo di domanda reale
            continue
        used_gaps.update(matched)
        cands.append({
            "slug": slug,
            "title": title,
            "keywords_matched": len(matched),
            "sample_keywords": matched[:8],
        })
    cands.sort(key=lambda c: -c["keywords_matched"])

    report = {"candidates": cands, "totalGapsCovered": len(used_gaps),
              "existingPages": sorted(have)}
    json.dump(report, open(OUT_JSON, "w"), ensure_ascii=False, indent=2)

    lines = ["# Candidati NUOVE pagine (programmatic SEO)", ""]
    if not cands:
        lines.append("_Nessun tema GAP non coperto con domanda sufficiente questa settimana._")
    for c in cands:
        lines.append(f"## {c['slug']} — {c['title']}  ({c['keywords_matched']} keyword)")
        lines.append("  keyword: " + ", ".join(c["sample_keywords"]))
        lines.append("")
    open(OUT_MD, "w", encoding="utf-8").write("\n".join(lines))
    print(f"[gap_candidates] {len(cands)} candidati nuove pagine → {OUT_MD}")


if __name__ == "__main__":
    main()
