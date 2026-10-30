#!/usr/bin/env python3
"""
FASE 3c — comportamento REALE dello switcher lingua: da 5 pagine di partenza
clicca la lingua nel dropdown e registra dove finisce e in che lingua e' il
contenuto dopo il cambio.
"""
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)
BASE = "https://adoff.app"

CASES = [
    ("/de/guide", "fr"),
    ("/de/ad-blocker-brave", "fr"),
    ("/it/guide", "de"),
    ("/", "de"),
    ("/premium", "de"),
    ("/vs/ublock-origin", "de"),
]

IT_WORDS = re.compile(r"\b(pubblicit|blocca|gratis|impostazioni|funziona|estensione|guida)\w*", re.I)
DE_WORDS = re.compile(r"\b(Werbung|blockieren|kostenlos|Einstellungen|funktioniert|Erweiterung|Anleitung)\w*", re.I)
FR_WORDS = re.compile(r"\b(publicit|bloquer|gratuit|param[eè]tres|fonctionne|extension|guide)\w*", re.I)


def sniff(txt):
    return {"it": len(IT_WORDS.findall(txt)), "de": len(DE_WORDS.findall(txt)),
            "fr": len(FR_WORDS.findall(txt))}


def main():
    res = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for path, target in CASES:
            ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="en-US")
            pg = ctx.new_page()
            row = {"from": path, "click": target}
            try:
                pg.goto(BASE + path, wait_until="domcontentloaded", timeout=40000)
                pg.wait_for_timeout(2500)
                row["before_url"] = pg.url
                row["before_lang"] = pg.evaluate("document.documentElement.lang")
                body = pg.evaluate("document.body.innerText.slice(0,6000)")
                row["before_sniff"] = sniff(body)
                btn = pg.query_selector("#snLangBtn")
                if not btn:
                    row["error"] = "nessuno switcher lingua nella pagina"
                    res.append(row)
                    ctx.close()
                    continue
                btn.click()
                pg.wait_for_timeout(400)
                item = pg.query_selector(f'#snLangDd button[data-lang="{target}"]')
                if not item:
                    row["error"] = "voce lingua assente nel dropdown"
                    res.append(row)
                    ctx.close()
                    continue
                item.click()
                pg.wait_for_load_state("domcontentloaded", timeout=30000)
                pg.wait_for_timeout(3000)
                row["after_url"] = pg.url
                row["after_lang"] = pg.evaluate("document.documentElement.lang")
                row["after_title"] = pg.title()
                body2 = pg.evaluate("document.body.innerText.slice(0,6000)")
                row["after_sniff"] = sniff(body2)
                row["is_homepage"] = "Ads gone" in body2 or "pubblicità sparita" in body2.lower()
            except Exception as e:
                row["error"] = str(e)[:150]
            res.append(row)
            ctx.close()
        b.close()

    (OUT / "langswitch.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))
    for r in res:
        print("=" * 84)
        print(f"PARTENZA {r['from']}   -> clic lingua «{r['click']}»")
        if r.get("error"):
            print(f"   ERRORE: {r['error']}")
            continue
        print(f"   prima : {r['before_url']}  lang='{r['before_lang']}'  parole {r['before_sniff']}")
        print(f"   dopo  : {r['after_url']}  lang='{r['after_lang']}'  parole {r['after_sniff']}")
        print(f"   title dopo: {r['after_title'][:70]}")
        b_, a_ = r["before_sniff"], r["after_sniff"]
        tgt = r["click"]
        if a_.get(tgt, 0) > max(v for k, v in a_.items() if k != tgt):
            verdict = "OK — contenuto passato alla lingua richiesta"
        elif b_ == a_ and r["before_url"].split("?")[0] == r["after_url"].split("?")[0]:
            verdict = "ROTTO — URL cambiato ma contenuto IDENTICO"
        elif r.get("is_homepage"):
            verdict = "ROTTO — buttato sulla HOMEPAGE, pagina persa"
        else:
            verdict = "SOSPETTO — la lingua richiesta non domina il testo"
        print(f"   VERDETTO: {verdict}")


if __name__ == "__main__":
    main()
