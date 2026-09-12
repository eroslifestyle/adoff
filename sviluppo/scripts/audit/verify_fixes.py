#!/usr/bin/env python3
"""
Verifica dei fix in browser reale contro il server locale che replica
Cloudflare Pages (serve_pages.py). Testa i sintomi originali, non i dettagli
implementativi: se questi passano, l'utente vede il sito funzionante.

Uso:  python3 serve_pages.py --root site --port 8899 &
      xvfb-run -a python3 verify_fixes.py
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

import os
BASE = os.environ.get("ADOFF_BASE", "http://127.0.0.1:8899")
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

# parole spia per riconoscere la lingua del nav/footer renderizzato
MARKERS = {
    "de": ["Startseite", "Preise", "Installieren", "Unterstützung", "Anleitung", "Funktionen"],
    "it": ["Prezzi", "Installa", "Supporto", "Guida", "Funzionalità", "Home"],
    "en": ["Pricing", "Install", "Support", "Guide", "Features", "Home"],
    "ja": ["ホーム", "料金", "インストール", "サポート", "ガイド", "機能"],
}


def probe(page):
    return page.evaluate("""() => {
      const nav = document.getElementById('site-nav');
      const foot = document.querySelector('footer');
      return {
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        title: document.title,
        h1: (document.querySelector('h1')||{}).innerText || '',
        bodyFont: getComputedStyle(document.body).fontFamily,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        navText: nav ? nav.innerText.replace(/\\s+/g,' ').trim() : null,
        navHrefs: nav ? [...nav.querySelectorAll('.sn-links a')].map(a=>a.getAttribute('href')) : [],
        footText: foot ? foot.innerText.replace(/\\s+/g,' ').trim().slice(0,300) : null,
        cssApplied: getComputedStyle(document.body).fontFamily.indexOf('Times') === -1,
      };
    }""")


def lang_of(text, langs=("de", "it", "en", "ja")):
    """Quale lingua domina in questo testo, contando le parole spia."""
    if not text:
        return None
    scores = {l: sum(1 for w in MARKERS[l] if w in text) for l in langs}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None


def main():
    results = []
    checks = []

    def check(name, ok, detail):
        checks.append({"name": name, "ok": bool(ok), "detail": str(detail)[:300]})
        print(("  PASS  " if ok else "  FAIL  ") + name)
        print(f"          {str(detail)[:220]}")

    with sync_playwright() as p:
        b = p.chromium.launch()

        # ── 1. utente italiano: il menu porta davvero alle pagine? ───────────
        print("\n[1] Utente ITALIANO — il menu funziona?")
        ctx = b.new_context(locale="it-IT", viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.goto(BASE + "/", wait_until="domcontentloaded"); pg.wait_for_timeout(2500)
        home = probe(pg)
        check("home IT in italiano", lang_of(home["navText"]) == "it",
              f"lang={home['lang']} nav='{(home['navText'] or '')[:90]}'")

        # etichette in italiano dopo la traduzione del nav
        # NB: etichette in ITALIANO, perche' a questo punto il nav e' gia' tradotto
        # ("Premium VPN" in it.json e' reso "VPN Premium").
        for label, in_dropdown in [("Prezzi", False), ("VPN Premium", True),
                                   ("Supporto", False), ("Installa", False)]:
            pg.goto(BASE + "/", wait_until="domcontentloaded"); pg.wait_for_timeout(2200)
            if in_dropdown:
                # la voce vive in un dropdown chiuso: va aperto prima di cliccare
                btn = pg.query_selector("#snPremiumBtn")
                if btn:
                    btn.click()
                    pg.wait_for_timeout(300)
            el = pg.query_selector(f'#site-nav a:has-text("{label}")')
            if not el or not el.is_visible():
                check(f"voce menu '{label}' cliccabile", False,
                      f"trovata={bool(el)} visibile={el.is_visible() if el else None}")
                continue
            href = el.get_attribute("href")
            el.click()
            pg.wait_for_load_state("domcontentloaded"); pg.wait_for_timeout(2500)
            d = probe(pg)
            landed_home = ("torna tuo" in d["h1"].lower()
                           or "web is yours" in d["h1"].lower()
                           or pg.url.rstrip("/").endswith("8899"))
            check(f"'{label}' non rimbalza sulla homepage",
                  not landed_home, f"href={href} url={pg.url} h1='{d['h1'][:60]}'")
        ctx.close()

        # ── 2. pagina tedesca: nav, footer e CSS ────────────────────────────
        print("\n[2] Pagina TEDESCA /de/guide — una sola lingua e CSS applicato?")
        ctx = b.new_context(locale="en-US", viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" else None)
        pg.goto(BASE + "/de/guide", wait_until="domcontentloaded"); pg.wait_for_timeout(3000)
        d = probe(pg)
        check("CSS applicato (non Times New Roman)", d["cssApplied"], f"font={d['bodyFont'][:60]}")
        check("nessun errore MIME sul CSS",
              not any("MIME" in e for e in errs), f"errori={[e for e in errs if 'MIME' in e][:1]}")
        check("nav in tedesco", lang_of(d["navText"]) == "de", f"nav='{(d['navText'] or '')[:110]}'")
        check("footer in tedesco (non italiano)", lang_of(d["footText"]) != "it",
              f"footer='{(d['footText'] or '')[:130]}'")
        results.append({"page": "/de/guide", **d})
        ctx.close()

        # ── 3. premium: il meccanismo di traduzione verso l'italiano funziona? ──
        # Prima del fix, adoff-i18n.js usciva subito per lang==='it' dando per
        # scontato che il markup fosse gia' italiano: falso sulle pagine root
        # canoniche inglesi. Qui si verifica il MECCANISMO, non la completezza
        # del dizionario: si prende una chiave che in it.json E' tradotta e si
        # controlla che il testo renderizzato corrisponda.
        print("\n[3] /premium?lang=it — il motore traduce verso l'italiano?")
        it_dict = json.loads((Path(__file__).resolve().parents[3]
                              / "site" / "i18n" / "it.json").read_text(encoding="utf-8"))
        en_dict = json.loads((Path(__file__).resolve().parents[3]
                              / "site" / "i18n" / "en.json").read_text(encoding="utf-8"))
        probe_keys = [k for k in it_dict
                      if k.startswith("premium.") and k in en_dict
                      and it_dict[k] != en_dict[k] and len(it_dict[k]) > 12][:5]
        ctx = b.new_context(locale="it-IT", viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.goto(BASE + "/premium?lang=it", wait_until="domcontentloaded"); pg.wait_for_timeout(3000)
        applied = []
        for k in probe_keys:
            got = pg.evaluate(
                """(k) => { const e = document.querySelector('[data-i18n="'+k+'"],[data-i18n-html="'+k+'"]');
                            return e ? e.textContent.trim() : null; }""", k)
            if got is not None:
                applied.append((k, got.startswith(it_dict[k][:18].strip())))
        ok_n = sum(1 for _, v in applied if v)
        check("chiavi tradotte applicate alla pagina",
              applied and ok_n == len(applied),
              f"{ok_n}/{len(applied)} applicate · esempio: {applied[:2]}")
        d = probe(pg)
        results.append({"page": "/premium?lang=it", **d})
        ctx.close()

        # ── 4. titoli non sovrascritti dalla homepage ───────────────────────
        print("\n[4] Il <title> di ogni pagina resta il suo?")
        ctx = b.new_context(locale="en-US", viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        titles = {}
        for path in ["/", "/pricing", "/premium", "/install", "/support"]:
            pg.goto(BASE + path, wait_until="domcontentloaded"); pg.wait_for_timeout(2200)
            titles[path] = pg.title()
        uniq = len(set(titles.values()))
        check("titoli distinti fra 5 pagine", uniq >= 4,
              " | ".join(f"{k} → {v[:44]}" for k, v in titles.items()))
        ctx.close()

        # ── 5. la 404 esiste davvero ────────────────────────────────────────
        print("\n[5] Una pagina inesistente dà 404?")
        ctx = b.new_context(locale="it-IT")
        pg = ctx.new_page()
        r = pg.goto(BASE + "/questa-non-esiste-xyz", wait_until="domcontentloaded")
        pg.wait_for_timeout(1500)
        check("status 404 (non 200 con la homepage)", r.status == 404,
              f"status={r.status} title='{pg.title()[:60]}'")
        ctx.close()

        b.close()

    (OUT / "verify.json").write_text(json.dumps(
        {"checks": checks, "pages": results}, indent=1, ensure_ascii=False))
    ok = sum(1 for c in checks if c["ok"])
    print(f"\n{'='*70}\nESITO: {ok}/{len(checks)} controlli superati")
    for c in checks:
        if not c["ok"]:
            print(f"  FALLITO: {c['name']} — {c['detail'][:150]}")
    return 0 if ok == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
