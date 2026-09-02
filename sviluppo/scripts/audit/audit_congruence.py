#!/usr/bin/env python3
"""
FASE 4 — congruenza fra quello che il sito dichiara e la realta' del prodotto.

Verita' di riferimento (verificata, non assunta):
  versione   -> app/manifest.json                       = 3.5.38
  regole     -> grep -c '"id"' app/rules/adblock-rules.json = 144
  AdOff e' gratis al 100% dal 2026-08 (vedi CLAUDE.md "Modello di accesso"):
  NESSUN trial/prezzo/piano Lifetime deve comparire piu' sul sito — ogni
  occorrenza di durata-trial, prezzo o "lifetime" e' ora un problema di per se',
  non solo un disallineamento numerico.
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

C = json.loads((SITE / "data" / "constants.json").read_text())
VERSION = json.loads((ROOT / "app" / "manifest.json").read_text())["version"]
RULES = (ROOT / "app" / "rules" / "adblock-rules.json").read_text().count('"id"')
# AdOff e' gratis per tutti: nessun prezzo e' piu' ammesso in copy pubblica.
ALLOWED_PRICES = set()

CHECKS = [
    # (id, regex, descrizione, filtro che decide se e' un problema)
    ("VER", re.compile(r"\bv?(\d+\.\d+\.\d+)\b"), "versione dichiarata",
     lambda m: m.group(1) != VERSION and m.group(1).startswith("3.")),
    # AdOff non ha piu' un "trial" (accesso temporaneo prima di pagare): ha un
    # periodo di grazia gratis (30gg) seguito da un account gratuito. Menzioni
    # legittime di "30 giorni"/"365 giorni" in quel contesto NON sono un
    # problema — quindi non flaggiamo piu' durate nude, solo il concetto di
    # "trial"/"prova" (che implica un pagamento a seguire) e il linguaggio di
    # conversione a pagamento, ovunque compaiano.
    ("TRIALWORD", re.compile(
        r"\b(?:trial|prova\s+gratuit\w*|period[oa]\s+di\s+prova|test(?:versi|phase)|essai\s+gratuit|"
        r"prueba\s+gratuit\w*|avalia[çc][ãa]o\s+gratuit\w*|uji\s*coba|"
        r"пробн\w*\s+период|체험판|試用期間|deneme\s+s[üu]resi|okres\s*próbny|"
        r"परीक्षण\s+अवधि|فترة\s+تجريبية|试用期)\b", re.I),
     "linguaggio 'trial' (AdOff non ha piu' un trial-poi-paghi, solo periodo di grazia gratis)", lambda m: True),
    ("PAIDLANG", re.compile(
        r"\b(?:upgrade\s+to\s+pro|sblocca\s+pro|passa\s+a\s+pro|abbonamento|subscription|"
        r"canone|checkout|poi\s+paghi|then\s+pay|piano\s+premium|premium\s+plan)\b", re.I),
     "linguaggio da piano a pagamento (AdOff e' gratis, nessun upgrade a pagamento esiste)", lambda m: True),
    ("RULES", re.compile(r"\b(\d{2,4})\+?\s*(?:regole|rules|Regeln|r[eè]gles|reglas|regras|правил|规则|규칙|ルール|kural|regu[łl]|aturan|नियम|قاعدة|قواعد)\b", re.I),
     "numero regole", lambda m: m.group(1) != str(RULES)),
    ("LIFETIME", re.compile(r"\b(lifetime|a vita|Lebenslang|de por vida|vitalicio)\b", re.I),
     "piano Lifetime (rimosso 2026-07-16)", lambda m: True),
    ("PRICE", re.compile(r"(?:€|EUR\s*)\s?(\d{1,3}[.,]\d{2})"), "prezzo",
     lambda m: m.group(1) not in ALLOWED_PRICES),
]

SKIP_DIRS = {"graphify-out"}
# pagine interne non pubbliche: si contano a parte
INTERNAL = ("admin-console.html", "mgmt-9f4a/", "panel.html", "account.html", "account/")


def main():
    print("=" * 84)
    print("FASE 4 — CONGRUENZA CONTENUTI")
    print("=" * 84)
    print(f"verita': versione={VERSION}  regole={RULES}  "
          f"lingue={C['languages']}  browser={C['supported_browsers']}")
    print("AdOff e' gratis al 100% — nessun prezzo/trial ammesso in copy pubblica")

    hits = defaultdict(list)
    files = sorted(p for p in SITE.rglob("*.html")
                   if p.relative_to(SITE).parts[0] not in SKIP_DIRS)
    for p in files:
        rel = p.relative_to(SITE).as_posix()
        text = p.read_text(encoding="utf-8", errors="replace")
        # via gli script inline (versioni di librerie), i path SVG (`d="M12 0C5.37..."`
        # contengono sequenze tipo 3.2.7 che non sono numeri di versione) e gli <style>
        body = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.S | re.I)
        body = re.sub(r"<style\b[^>]*>.*?</style>", " ", body, flags=re.S | re.I)
        body = re.sub(r"<(?:svg|path)\b[^>]*>", " ", body, flags=re.S | re.I)
        body = re.sub(r"\sd\s*=\s*\"[^\"]*\"", " ", body, flags=re.S | re.I)
        for cid, rx, desc, bad in CHECKS:
            for m in rx.finditer(body):
                if not bad(m):
                    continue
                line = body[: m.start()].count("\n") + 1
                ctx = re.sub(r"\s+", " ", body[max(0, m.start() - 60): m.end() + 60]).strip()
                hits[cid].append((rel, line, m.group(0), ctx))

    for cid, rx, desc, _ in CHECKS:
        h = hits[cid]
        pub = [x for x in h if not any(x[0].startswith(i) or i in x[0] for i in INTERNAL)]
        print(f"\n--- {cid}: {desc} — {len(h)} occorrenze ({len(pub)} su pagine pubbliche) ---")
        if not h:
            print("    nessuna")
            continue
        byval = defaultdict(list)
        for rel, line, val, ctx in pub:
            byval[val.strip()].append((rel, line, ctx))
        for val, occ in sorted(byval.items(), key=lambda kv: -len(kv[1]))[:8]:
            print(f"    «{val}» x{len(occ)}   es. {occ[0][0]}:{occ[0][1]}")
            print(f"        ...{occ[0][2][:120]}...")

    # controlli puntuali sul JSON i18n
    print("\n--- i18n: stesse incongruenze dentro i dizionari ---")
    for lang in ("it", "en", "de"):
        d = json.loads((SITE / "i18n" / f"{lang}.json").read_text())
        bad_ver = {k: v for k, v in d.items()
                   if isinstance(v, str) and re.search(r"\b3\.\d+\.\d+\b", v)
                   and VERSION not in v}
        life = {k: v for k, v in d.items()
                if isinstance(v, str) and re.search(r"lifetime|a vita", v, re.I)}
        t30 = {k: v for k, v in d.items()
               if isinstance(v, str) and re.search(r"\b30\s*(giorni|days|Tage)\b", v, re.I)}
        print(f"  {lang}.json  versione-stantia={len(bad_ver)}  lifetime={len(life)}  trial-30gg={len(t30)}")
        for k, v in list(bad_ver.items())[:2]:
            print(f"       {k} -> {v[:80]}")
        for k, v in list(life.items())[:2]:
            print(f"       LIFETIME {k} -> {v[:80]}")

    (OUT / "congruence.json").write_text(json.dumps(
        {k: [list(x) for x in v] for k, v in hits.items()}, indent=1, ensure_ascii=False))
    print(f"\nDettaglio -> {OUT / 'congruence.json'}")


if __name__ == "__main__":
    main()
