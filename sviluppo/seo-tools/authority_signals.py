#!/usr/bin/env python3
"""
AdOff — Segnali di AUTORITÀ / presenza off-page (il vero collo di bottiglia).

INSIGHT (sessione 2026-06-14): la sonda AEO dà 0/4 con retrieval_hit:false ovunque
non perché manchi il contenuto (llms.txt è completo), ma perché manca l'AUTORITÀ:
adoff.app non è ancora citato da fonti terze. La ricerca GEO mostra che i brand sono
~6.5× più citati dalle AI via fonti terze (Reddit, Wikipedia, review site, roundup)
che dal proprio dominio. L'agente settimanale ottimizza on-page; questo modulo copre
l'asse off-page che mancava del tutto.

Lo scope-lock dell'agente consente solo scritture in site/ → le azioni di autorità
NON sono automatizzabili (richiedono account, post, submission manuali). Questo modulo
quindi DIAGNOSTICA e PROPONE: misura la presenza off-site attuale del brand e produce
una checklist priorizzata di azioni di autorità da fare a mano (riportata su Telegram).

Output: .state/authority_report.{json,md}.
Uso: source ~/.secrets/adoff-stores.env && python3 authority_signals.py
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, ".state")
OUT_JSON = os.path.join(STATE, "authority_report.json")
OUT_MD = os.path.join(STATE, "authority_report.md")
DOMAIN = "adoff.app"
BRAND = "adoff"


# --- auto re-exec sotto il venv se ddgs non è importabile (cron usa python3 nudo) ---
def _ensure_venv():
    try:
        import ddgs  # noqa
        return
    except Exception:
        venv_py = os.path.join(HERE, ".venv", "bin", "python")
        if os.path.exists(venv_py) and not os.environ.get("AUTH_VENV_REEXEC"):
            os.environ["AUTH_VENV_REEXEC"] = "1"
            os.execv(venv_py, [venv_py] + sys.argv)


# Riusa il retrieval web di aeo_probe (ddgs + fallback SearXNG): un solo punto di verità.
def _search(query, n=10):
    try:
        sys.path.insert(0, HERE)
        from aeo_probe import _web_search
        return _web_search(query, n)
    except Exception:
        return []


# Checklist curata di sorgenti di autorità ad alto valore per un ad-blocker browser.
# priority: 1 = massimo impatto/sforzo minimo. type: dove vive la citazione.
# probe: query con cui verifichiamo se adoff è GIÀ presente lì (best-effort, no API).
AUTHORITY_TARGETS = [
    {"name": "AlternativeTo", "priority": 1, "type": "review/listing",
     "probe": f"{BRAND} site:alternativeto.net",
     "action": "Crea la scheda AdOff e collegala come alternativa a uBlock/AdGuard/ABP (alto intento, citata dalle AI)."},
    {"name": "Product Hunt", "priority": 1, "type": "launch/listing",
     "probe": f"{BRAND} site:producthunt.com",
     "action": "Lancio/maker page: backlink dofollow + presenza nei roundup che le AI leggono."},
    {"name": "Reddit (r/chrome, r/privacy, r/firefox, r/adblock)", "priority": 1, "type": "community",
     "probe": f"{BRAND} ad blocker site:reddit.com",
     "action": "Partecipazione autentica nei thread 'best ad blocker' (Reddit = ~1.8% di tutte le citazioni ChatGPT)."},
    {"name": "GitHub awesome-lists / topic", "priority": 2, "type": "list/backlink",
     "probe": f"{BRAND} ad blocker site:github.com",
     "action": "PR per inserire AdOff nelle awesome-list ad-block/privacy (già abbiamo repo open-core eroslifestyle/adoff)."},
    {"name": "G2 / Capterra / SaaSHub", "priority": 2, "type": "review",
     "probe": f"{BRAND} site:saashub.com OR site:g2.com OR site:capterra.com",
     "action": "Profilo prodotto + prime recensioni reali (review site = forte segnale trust per AEO)."},
    {"name": "Wikipedia / Wikidata", "priority": 3, "type": "entity",
     "probe": f"{BRAND} ad blocker wikipedia",
     "action": "Voce/entità (serve copertura stampa indipendente prima — Wikipedia = 7.8% citazioni ChatGPT)."},
    {"name": "Roundup 'best ad blocker' (tom's hardware, pcmag, safetydetectives…)", "priority": 2, "type": "press/roundup",
     "probe": f"best ad blocker 2026 {BRAND}",
     "action": "Outreach alle testate che già rankano per 'best ad blocker' per inclusione nei loro elenchi."},
    {"name": "Slant / Stackshare", "priority": 3, "type": "list",
     "probe": f"{BRAND} site:slant.co",
     "action": "Aggiunta come opzione nelle domande 'best ad blocker' (long-tail evergreen)."},
]


def _mentions(query, n=12):
    """Risultati su DOMINI TERZI (non adoff.app) che menzionano il brand = autorità off-site."""
    res = _search(query, n)
    third = []
    for r in res:
        href = (r.get("href") or "").lower()
        blob = (r.get("title", "") + " " + r.get("body", "")).lower()
        if DOMAIN in href:
            continue                      # il nostro dominio non conta come autorità di terzi
        if BRAND in blob or BRAND in href:
            third.append({"url": r.get("href", ""), "title": r.get("title", "")[:120]})
    return third


def probe_target(t):
    """Best-effort: adoff sembra già presente sulla piattaforma? (assenza ≠ certezza)."""
    res = _search(t["probe"], 6)
    present = any(BRAND in ((r.get("href", "") + r.get("title", "") + r.get("body", "")).lower())
                 for r in res)
    return present


def main():
    os.makedirs(STATE, exist_ok=True)
    # 1) Menzioni off-site del brand (discoverability dell'entità)
    queries = [f"{BRAND} ad blocker", f'"{DOMAIN}"', f"{BRAND} estensione blocco pubblicità"]
    seen, mentions = set(), []
    for q in queries:
        for m in _mentions(q):
            if m["url"] and m["url"] not in seen:
                seen.add(m["url"]); mentions.append(m)
        time.sleep(0.4)

    # 2) Stato della checklist autorità (presente/da fare)
    targets = []
    for t in sorted(AUTHORITY_TARGETS, key=lambda x: x["priority"]):
        present = probe_target(t)
        targets.append({**t, "present": present})
        time.sleep(0.4)

    todo = [t for t in targets if not t["present"]]
    done = [t for t in targets if t["present"]]
    report = {"ts": int(time.time()), "brand": BRAND,
              "offsiteMentions": len(mentions), "mentions": mentions[:15],
              "targets": targets, "todoCount": len(todo)}
    json.dump(report, open(OUT_JSON, "w"), ensure_ascii=False, indent=2)

    lines = [f"# Autorità off-page — {BRAND}", ""]
    lines.append(f"Menzioni su domini terzi trovate: **{len(mentions)}** "
                 f"(più alto = più citabile dalle AI; oggi il sito è ottimizzato ma poco citato altrove).")
    if mentions:
        lines.append("")
        lines.append("## Menzioni off-site rilevate")
        for m in mentions[:10]:
            lines.append(f"- {m['title']} — {m['url']}")
    lines.append("")
    lines.append("## Azioni autorità PRIORITARIE (manuali — fuori scope-lock site/)")
    if not todo:
        lines.append("_Tutte le sorgenti prioritarie risultano già coperte (verifica comunque a mano)._")
    for t in todo:
        lines.append(f"- **[P{t['priority']}] {t['name']}** ({t['type']}): {t['action']}")
    if done:
        lines.append("")
        lines.append("## Già presenti (rafforzare)")
        for t in done:
            lines.append(f"- {t['name']}")
    open(OUT_MD, "w", encoding="utf-8").write("\n".join(lines))
    print(f"[authority_signals] {len(mentions)} menzioni off-site, "
          f"{len(todo)}/{len(targets)} azioni autorità da fare → {OUT_MD}")


if __name__ == "__main__":
    _ensure_venv()
    main()
