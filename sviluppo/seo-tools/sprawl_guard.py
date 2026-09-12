#!/usr/bin/env python3
"""
AdOff — Freno al content-sprawl (anti thin-page proliferation).

PROBLEMA (sessione 2026-06-14): l'agente crea ~1 landing nuova × 15 lingue ogni
settimana. Con già ~18 landing SEO e 1 solo click totale, scalare contenuto senza
autorità rischia la policy 'scaled content abuse' e trascina giù i quality signal
site-wide (helpful-content system è site-level). La crescita non è "più pagine", è
"le pagine esistenti che prendono trazione".

Questo modulo misura quante landing esistenti hanno DAVVERO trazione su GSC e dà un
verdetto: CREATE_OK (puoi creare 1 nuova pagina) o CONSOLIDATE (prima fai rendere le
esistenti). Il prompt dell'agente legge questo file e rispetta il verdetto.

Output: .state/sprawl_guard.{json,md}.
Uso: python3 sprawl_guard.py   (legge .state/gsc_snapshot.json + GSC live)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, ".state")
ROOT = os.path.dirname(os.path.dirname(HERE))
SITE = os.path.join(ROOT, "site")
OUT_JSON = os.path.join(STATE, "sprawl_guard.json")
OUT_MD = os.path.join(STATE, "sprawl_guard.md")

MIN_IMPR_TRACTION = 10   # impressioni (28g, somma tutte le lingue) per dire "ha trazione"
STALE_LIMIT = 5          # se ≥ tante landing sono ferme a ~0, blocca le nuove pagine
STALE_RATIO = 0.7        # …oppure se oltre il 70% delle landing è fermo

# Pagine root NON-landing (funzionali/legali/marketing): escluse dal conteggio sprawl.
FUNCTIONAL = {
    "index", "install", "support", "privacy", "terms", "withdrawal", "about", "chi-sono",
    "account", "admin", "affiliati", "success", "uninstall", "salesletter", "license-guide",
    "community", "press", "accessibility", "guide",
}


def landing_slugs():
    """Landing SEO = file .html nella root di site/ che non sono pagine funzionali."""
    out = []
    for n in sorted(os.listdir(SITE)):
        if n.endswith(".html"):
            slug = n[:-5]
            if slug not in FUNCTIONAL:
                out.append(slug)
    return out


def gsc_impressions_by_slug(slugs):
    """Impressioni 28g per slug, sommate su tutte le varianti lingua (/slug e /<lang>/slug)."""
    sys.path.insert(0, HERE)
    try:
        import outcomes as O
        snap = O.load_snapshot()
        pm = O.live_page_map() or O.page_map(snap)
    except Exception:
        pm = {}
    totals = {s: 0 for s in slugs}
    for url, row in pm.items():
        path = url.replace("https://adoff.app", "").replace("http://adoff.app", "").strip("/")
        # togli prefisso lingua a 2 lettere se presente: it/slug → slug
        parts = path.split("/")
        if len(parts) >= 2 and len(parts[0]) == 2:
            tail = "/".join(parts[1:])
        else:
            tail = path
        if tail in totals:
            totals[tail] += int(row.get("impressions", 0) or 0)
    return totals


def main():
    os.makedirs(STATE, exist_ok=True)
    slugs = landing_slugs()
    impr = gsc_impressions_by_slug(slugs)
    have_data = any(v > 0 for v in impr.values())

    with_traction = sorted([s for s in slugs if impr.get(s, 0) >= MIN_IMPR_TRACTION],
                           key=lambda s: -impr[s])
    stale = sorted([s for s in slugs if impr.get(s, 0) < MIN_IMPR_TRACTION])
    n = len(slugs)
    ratio_stale = (len(stale) / n) if n else 0

    # Verdetto. Se GSC non ha ancora dati per-URL (creds assenti), NON bloccare a caso:
    # default prudente = CONSOLIDATE solo se abbiamo dati e mostrano stallo.
    if not have_data:
        verdict = "CREATE_OK"
        reason = "Nessun dato GSC per-URL disponibile: il guard non blocca (default permissivo)."
    elif len(stale) >= STALE_LIMIT or ratio_stale >= STALE_RATIO:
        verdict = "CONSOLIDATE"
        reason = (f"{len(stale)}/{n} landing sotto {MIN_IMPR_TRACTION} impr (28g): "
                  f"prima far rendere le esistenti, non crearne altre.")
    else:
        verdict = "CREATE_OK"
        reason = f"Solo {len(stale)}/{n} landing ferme: c'è spazio per 1 nuova pagina mirata."

    report = {"verdict": verdict, "reason": reason, "landingCount": n,
              "withTraction": [{"slug": s, "impr": impr[s]} for s in with_traction],
              "stale": stale, "haveData": have_data}
    json.dump(report, open(OUT_JSON, "w"), ensure_ascii=False, indent=2)

    lines = ["# Freno content-sprawl", ""]
    lines.append(f"**VERDETTO: {verdict}** — {reason}")
    lines.append("")
    lines.append(f"- Landing SEO totali: {n}")
    lines.append(f"- Con trazione (≥{MIN_IMPR_TRACTION} impr): {len(with_traction)}")
    lines.append(f"- Ferme (~0 impr): {len(stale)}")
    if with_traction:
        lines.append("")
        lines.append("## Landing che rendono (rafforzare, NON disfare)")
        for s in with_traction[:10]:
            lines.append(f"- {s} ({impr[s]} impr)")
    if verdict == "CONSOLIDATE" and stale:
        lines.append("")
        lines.append("## Da CONSOLIDARE prima di crearne altre")
        lines.append("_Rafforza contenuto/interlink/keyword di queste invece di aggiungere pagine:_")
        for s in stale[:12]:
            lines.append(f"- {s}")
    open(OUT_MD, "w", encoding="utf-8").write("\n".join(lines))
    print(f"[sprawl_guard] {verdict}: {len(with_traction)}/{n} landing con trazione, "
          f"{len(stale)} ferme → {OUT_MD}")


if __name__ == "__main__":
    main()
