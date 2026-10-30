#!/usr/bin/env python3
"""
AdOff — Closed-loop SEO: registro interventi + misura degli esiti.

Trasforma l'agente da open-loop ("propongo e dimentico") a closed-loop
("misuro se la modifica della settimana scorsa ha funzionato e imparo").

Due modi:
  record  — appende un intervento al ledger (.state/interventions.jsonl) con la
            baseline GSC per-pagina delle pagine toccate (al momento dell'apply).
  measure — confronta gli interventi passati (≥ MIN_AGE_DAYS) con lo snapshot GSC
            attuale e scrive .state/outcomes.md: cosa è migliorato / peggiorato.
            Questo file viene dato in pasto all'agente e mostrato su Telegram.

Uso:
  python3 outcomes.py record --date 20260607 --summary "..." --files "it/x.html, en/x.html"
  python3 outcomes.py measure
Mappa file→URL coerente con GSC: site/it/x.html → https://adoff.app/it/x ;
site/index.html → https://adoff.app/ ; site/it/index.html → https://adoff.app/it/
"""
import argparse
import json
import os
import time

STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".state")
LEDGER = os.path.join(STATE, "interventions.jsonl")
SNAPSHOT = os.path.join(STATE, "gsc_snapshot.json")
OUT_MD = os.path.join(STATE, "outcomes.md")
BASE = "https://adoff.app"
MIN_AGE_DAYS = 6          # misura solo interventi maturati ≥6gg
MAX_AGE_DAYS = 60         # oltre, non più rilevante
DAY = 86400
# --- Soglie anti-rumore: su un sito a bassissimo traffico ogni delta di pos/CTR su
# poche impressioni è RUMORE, non segnale. Senza queste soglie il closed-loop "impara"
# dal caso (es. pos 30→29.6 su 1 impression). Una pagina conta come win/loss SOLO se ha
# abbastanza impressioni E il movimento di posizione supera il rumore di fondo. ---
MIN_IMPR = 30             # impressioni minime (max tra baseline e current) per misurare
MIN_POS_DELTA = 2.0       # movimento minimo di posizione per dichiarare win/loss (sotto = stabile)


def file_to_url(f):
    f = f.strip().lstrip("/")
    if f.startswith("site/"):
        f = f[len("site/"):]
    if not f.endswith(".html"):
        return None
    path = f[:-len(".html")]
    if path == "index":
        return BASE + "/"
    if path.endswith("/index"):
        return BASE + "/" + path[:-len("index")]   # dir/ con slash
    return BASE + "/" + path


def page_map(snapshot):
    return {r["key"]: r for r in (snapshot.get("topPage") or [])}


def live_page_map(days=28, limit=1000):
    """Mappa per-URL PRECISA da GSC (oltre il top-N dello snapshot). Fallback {} se
    le credenziali GSC mancano o la query fallisce → il chiamante usa lo snapshot."""
    try:
        import sys as _sys
        _sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from datetime import date, timedelta
        import gsc_query as G
        token = G.get_access_token()
        end = date.today() - timedelta(days=2)
        start = end - timedelta(days=days)
        rows = G.fmt_rows(G.query(token, str(start), str(end), ["page"], limit), ["page"])
        return {r["page"]: {"clicks": r["clicks"], "impressions": r["impressions"],
                            "ctr": r["ctr"], "position": r["position"]} for r in rows}
    except SystemExit:
        return {}
    except Exception:
        return {}


def load_snapshot():
    try:
        return json.load(open(SNAPSHOT)).get("snapshot") or {}
    except Exception:
        return {}


def cmd_record(args):
    snap = load_snapshot()
    pm = live_page_map() or page_map(snap)   # precisa per-URL; fallback snapshot
    files = [x.strip() for x in (args.files or "").replace("\n", ",").split(",") if x.strip()]
    urls = sorted({u for u in (file_to_url(f) for f in files) if u})
    baseline = {u: pm[u] for u in urls if u in pm}  # solo pagine con dati GSC
    entry = {
        "date": args.date,
        "ts": int(time.time()),
        "summary": (args.summary or "")[:240],
        "files": files[:60],
        "urls": urls,
        "baselineTotals": snap.get("totals", {}),
        "baseline": baseline,        # url -> {clicks,impressions,ctr,position}
        "measured": False,
    }
    os.makedirs(STATE, exist_ok=True)
    with open(LEDGER, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(f"[outcomes] registrato intervento {args.date}: {len(files)} file, "
          f"{len(baseline)}/{len(urls)} pagine con baseline GSC")


def _delta(now, prev, lower_better=False):
    d = round(now - prev, 1)
    if d == 0:
        return "=", False
    better = (d < 0) if lower_better else (d > 0)
    arrow = "▼" if d < 0 else "▲"
    return f"{arrow}{abs(d)}", better


def _global_drift(snap):
    """Drift di posizione dell'intero sito (settimana vs precedente, da GSC wow). Serve a
    NON attribuire all'intervento un movimento che è in realtà del sito intero. Ritorna
    (drift_pos, testo) dove drift_pos>0 = il sito in media è peggiorato (pos più alta)."""
    wow = (snap.get("wow") or {}).get("position") or {}
    nowp, prevp = wow.get("now"), wow.get("prev")
    if nowp is None or prevp is None:
        return 0.0, ""
    d = round(nowp - prevp, 1)
    if d == 0:
        return 0.0, "drift sito: stabile"
    verso = "peggiorato" if d > 0 else "migliorato"
    return d, f"drift sito (pos media {prevp}→{nowp}, {verso} di {abs(d)})"


def cmd_measure(args):
    if not os.path.isfile(LEDGER):
        open(OUT_MD, "w").write("# Esiti SEO\n\n_Nessun intervento passato da misurare._\n")
        print("[outcomes] ledger vuoto")
        return
    snap = load_snapshot()
    pm = live_page_map() or page_map(snap)   # precisa per-URL; fallback snapshot
    now = int(time.time())
    drift_pos, drift_txt = _global_drift(snap)

    lines = ["# Esiti interventi SEO precedenti", ""]
    lines.append(f"_Soglie anti-rumore: una pagina conta come migliorata/peggiorata solo con "
                 f"≥{MIN_IMPR} impressioni e movimento posizione ≥{MIN_POS_DELTA} (al netto del drift sito). "
                 f"Sotto soglia = campione insufficiente, non un risultato._")
    if drift_txt:
        lines.append(f"_Contesto: {drift_txt} — i movimenti per-pagina vanno letti al netto di questo._")
    lines.append("")

    measured_any = False
    low_sample_total = 0
    entries = [json.loads(l) for l in open(LEDGER, encoding="utf-8") if l.strip()]
    for e in entries:
        age_days = (now - e.get("ts", now)) / DAY
        if age_days < MIN_AGE_DAYS or age_days > MAX_AGE_DAYS:
            continue
        if not e.get("baseline"):
            continue
        wins, losses, flat, low = [], [], [], []
        for url, base in e["baseline"].items():
            cur = pm.get(url)
            if not cur:
                continue
            short = url.replace(BASE, "") or "/"
            max_impr = max(base.get("impressions", 0), cur.get("impressions", 0))
            # Gate 1: campione insufficiente → non è né win né loss, è rumore.
            if max_impr < MIN_IMPR:
                low.append(f"  - {short}: solo {max_impr} impr (sotto soglia {MIN_IMPR}, non misurabile)")
                continue
            measured_any = True
            raw_delta = round(cur["position"] - base["position"], 1)        # >0 = peggiorato
            net_delta = round(raw_delta - drift_pos, 1)                     # al netto del drift sito
            ctr_txt, _ = _delta(cur["ctr"], base["ctr"])
            row = (f"  - {short}: pos {base['position']}→{cur['position']} "
                   f"(netto {'+' if net_delta > 0 else ''}{net_delta} vs sito), "
                   f"CTR {base['ctr']}%→{cur['ctr']}% ({ctr_txt}), clic {base['clicks']}→{cur['clicks']}")
            # Gate 2: movimento netto sotto la soglia di rumore → stabile.
            if abs(net_delta) < MIN_POS_DELTA:
                flat.append(row)
            elif net_delta < 0:        # posizione scesa (migliore) più del drift
                wins.append(row)
            else:
                losses.append(row)
        low_sample_total += len(low)
        if wins or losses or flat:
            lines.append(f"## {e['date']} — {e.get('summary','')} ({int(age_days)}gg fa)")
            if wins:
                lines.append("✅ Migliorate (oltre il drift del sito):")
                lines += wins
            if losses:
                lines.append("🔴 Peggiorate (rivedere):")
                lines += losses
            if flat:
                lines.append("➖ Stabili (movimento dentro il rumore):")
                lines += flat
            lines.append("")
        elif low:
            lines.append(f"## {e['date']} — {e.get('summary','')} ({int(age_days)}gg fa)")
            lines.append("⏳ Tutte le pagine toccate sono ancora sotto soglia di traffico:")
            lines += low
            lines.append("")

    if not measured_any:
        lines.append(f"_Nessuna pagina toccata ha ancora ≥{MIN_IMPR} impressioni: impossibile "
                     f"misurare l'esito senza imparare dal rumore. {low_sample_total} pagine in attesa di traffico._")
    open(OUT_MD, "w", encoding="utf-8").write("\n".join(lines))
    print(f"[outcomes] misura scritta in {OUT_MD} "
          f"({'dati significativi' if measured_any else 'nessun dato significativo'}, "
          f"{low_sample_total} sotto soglia)")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("record")
    r.add_argument("--date", required=True)
    r.add_argument("--summary", default="")
    r.add_argument("--files", default="")
    sub.add_parser("measure")
    args = ap.parse_args()
    if args.cmd == "record":
        cmd_record(args)
    else:
        cmd_measure(args)


if __name__ == "__main__":
    main()
