#!/usr/bin/env python3
"""
Genera una lista di lavoro per ogni lingua (e una per la root), con le
occorrenze esatte da correggere. Ogni agente riceve solo il proprio file.

Output: sviluppo/scripts/audit/out/work/<scope>.md
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
OUT = Path(__file__).parent / "out" / "work"
OUT.mkdir(parents=True, exist_ok=True)

LANGS = ["it", "en", "de", "fr", "es", "pt", "ru", "ar", "zh", "tr", "pl", "hi", "ja", "ko", "id"]
VERSION = json.loads((ROOT / "app" / "manifest.json").read_text())["version"]
TRIAL = 15

TITLE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)
DESC = re.compile(r"""<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']""", re.I)
CANON = re.compile(r"""rel=["']canonical["']""", re.I)
OG = re.compile(r"""<meta[^>]+property=["']og:(title|description|image)["']""", re.I)

CHECKS = [
    ("TRIAL-30", re.compile(
        r"(?:prov[ai]|trial|test|essai|prueba|avalia[çc][ãa]o|uji\s*coba|пробн\w*|체험|試用|"
        r"deneme|próbny|परीक्षण|تجرب\w*|试用|gratis|gratuit\w*|free|kostenlos|무료|무료로)"
        r"[^.<>]{0,70}\b30\s*(?:giorni|days|Tage|jours|d[ií]as|дней|天|일|gün|dni|hari|दिन|يوم)"
        r"|\b30\s*(?:giorni|days|Tage|jours|d[ií]as|дней|天|일|gün|dni|hari|दिन|يوم)"
        r"[^.<>]{0,50}(?:prov[ai]|trial|gratis|gratuit\w*|free|kostenlos|체험|試用|ücretsiz|"
        r"za darmo|मुफ़्त|مجان\w*|免费|Pro)", re.I | re.S),
     f"trial dichiarato 30gg — il reale e' {TRIAL}gg (occhio: rimborso 30gg e cookie affiliato 30gg sono CORRETTI, non toccarli)"),
    ("LIFETIME", re.compile(
        r"\b(lifetime|a vita|Lebenslang|de por vida|vitalicio|à vie|навсегда|永久|평생|"
        r"ömür boyu|dożywotni|seumur hidup|आजीवन|مدى الحياة)\b", re.I),
     "piano Lifetime rimosso il 2026-07-16 (ATTENZIONE: «prezzo Founder bloccato a vita» e' una promessa ANCORA VALIDA sul piano annuale, non rimuoverla)"),
    ("PREZZO-VECCHIO", re.compile(r"(?:€|EUR\s*)\s?(2[.,]69|2[.,]47|5[.,]99|29[.,]59|59[.,]99|67[.,]90|99)\b"),
     "prezzo superato — listino valido: 2,99 mese · 19,99 annuale Founder · 24,99 annuale · 4,99 Premium mese · 29,99 Premium Founder · 49,99 Premium annuale"),
    ("VERSIONE", re.compile(r"\bv?3\.(?:1|2|3|4)\.\d+\b|\b3\.5\.(?:[0-9]|[12][0-9]|3[0-7])\b"),
     f"versione stantia — la reale e' {VERSION} (le voci di changelog storico vanno lasciate)"),
    ("SAFARI", re.compile(r"Safari", re.I),
     "Safari non e' ancora disponibile (constants.json: browsers_coming_soon). Va rimosso dagli elenchi di browser supportati o marcato «in arrivo»"),
    ("SEPARATORE", re.compile(r"<title[^>]*>[^<]*\s,\s[^<]*</title>", re.I),
     "separatore corrotto nel <title>: la virgola va ripristinata a « · »"),
]


def scope_of(rel):
    first = rel.split("/")[0]
    if first in LANGS and len(first) == 2:
        return first
    return "root"


def main():
    buckets = defaultdict(lambda: defaultdict(list))
    seo = defaultdict(list)

    for p in sorted(SITE.rglob("*.html")):
        rel = p.relative_to(SITE).as_posix()
        sc = scope_of(rel)
        text = p.read_text(encoding="utf-8", errors="replace")
        body = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.S | re.I)
        body = re.sub(r"<style\b[^>]*>.*?</style>", " ", body, flags=re.S | re.I)

        for cid, rx, _ in CHECKS:
            for m in rx.finditer(body):
                line = body[: m.start()].count("\n") + 1
                ctx = re.sub(r"\s+", " ", body[max(0, m.start() - 70): m.end() + 70]).strip()
                buckets[sc][cid].append((rel, line, ctx))

        head = text[: text.lower().find("</head>") + 7] if "</head>" in text.lower() else text[:12000]
        problems = []
        if not DESC.search(head):
            problems.append("manca <meta name=description>")
        if not CANON.search(head):
            problems.append("manca <link rel=canonical>")
        ogs = {m.group(1).lower() for m in OG.finditer(head)}
        miss_og = [k for k in ("title", "description", "image") if k not in ogs]
        if miss_og:
            problems.append("og mancanti: " + ", ".join(miss_og))
        if problems:
            seo[sc].append((rel, problems))

    scopes = sorted(set(list(buckets.keys()) + list(seo.keys())))
    for sc in scopes:
        lines = [f"# Lista di lavoro — ambito `{sc}`", ""]
        files = sorted(SITE.glob(f"{sc}/*.html")) if sc != "root" else sorted(SITE.glob("*.html"))
        lines.append(f"Riferimento: `sviluppo/scripts/audit/SPEC-contenuti.md`")
        lines.append(f"Versione reale: **{VERSION}** · trial reale: **{TRIAL} giorni** · regole: **144**")
        lines.append("")

        tot = 0
        for cid, _, desc in CHECKS:
            items = buckets[sc].get(cid, [])
            if not items:
                continue
            tot += len(items)
            lines.append(f"## {cid} — {len(items)} occorrenze")
            lines.append(f"_{desc}_")
            lines.append("")
            for rel, line, ctx in items[:120]:
                lines.append(f"- `{rel}:{line}` — …{ctx[:150]}…")
            if len(items) > 120:
                lines.append(f"- … e altre {len(items)-120} occorrenze (cercale con grep)")
            lines.append("")

        if seo[sc]:
            lines.append(f"## SEO — {len(seo[sc])} pagine con metadati incompleti")
            lines.append("")
            for rel, probs in seo[sc][:120]:
                lines.append(f"- `{rel}` — {'; '.join(probs)}")
            lines.append("")

        lines.insert(2, f"**{tot} occorrenze di contenuto + {len(seo[sc])} pagine con SEO incompleto**")
        (OUT / f"{sc}.md").write_text("\n".join(lines), encoding="utf-8")
        print(f"  {sc:<6} contenuto={tot:<5} seo={len(seo[sc]):<4} -> out/work/{sc}.md")

    print(f"\n{len(scopes)} liste generate in {OUT}")


if __name__ == "__main__":
    main()
