#!/usr/bin/env python3
"""
FASE 3 — errori runtime su un CAMPIONE dichiarato di pagine LIVE (adoff.app).

Campione (12 pagine): home IT, home EN, 3 lingue (de/ja/ar-RTL), 1 vs/, 1 blog/,
install, guide, account, pricing, premium.

Cattura: console error/warning, richieste fallite, CSS realmente applicato,
href reali generati dal nav, lingua effettiva di nav/footer/contenuto.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)
BASE = "https://adoff.app"

SAMPLE = [
    ("home IT", "/"),
    ("home EN", "/en/"),
    ("guide DE", "/de/guide"),
    ("how-it-works JA", "/ja/how-it-works"),
    ("privacy AR (RTL)", "/ar/privacy"),
    ("vs uBlock Origin", "/vs/ublock-origin"),
    ("blog article", "/blog/how-to-block-ads-on-chrome"),
    ("install", "/install"),
    ("guide IT", "/it/guide"),
    ("account", "/account"),
    ("pricing", "/pricing"),
    ("premium", "/premium"),
]

PROBE = """() => {
  const nav = document.getElementById('site-nav');
  const links = nav ? [...nav.querySelectorAll('.sn-links a')].map(a =>
      ({t: a.textContent.trim().slice(0,24), h: a.getAttribute('href')})) : [];
  const foot = document.querySelector('footer');
  const footTxt = foot ? foot.innerText.replace(/\\s+/g,' ').trim().slice(0,240) : null;
  // il CSS globale e' applicato? .sn-logo ha font-weight 800 solo da style iniettato,
  // mentre body background viene da /style.css
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const sheets = [...document.styleSheets].map(s => {
      try { return {href: s.href, rules: s.cssRules ? s.cssRules.length : -1}; }
      catch(e) { return {href: s.href, rules: 'CORS/blocked'}; }
  });
  const cssLinks = [...document.querySelectorAll('link[rel=stylesheet],link[rel=preload][as=style]')]
      .map(l => l.getAttribute('href'));
  return {
    htmlLang: document.documentElement.lang,
    dir: document.documentElement.dir,
    i18nReady: document.documentElement.getAttribute('data-i18n-ready'),
    i18nDebug: document.documentElement.getAttribute('data-i18n-debug'),
    title: document.title,
    navPresent: !!nav, navLinks: links,
    footerText: footTxt,
    bodyBg, cssLinks, sheets,
    bodyVisibility: getComputedStyle(document.body).visibility,
    h1: (document.querySelector('h1')||{}).innerText || null,
  };
}"""


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for label, path in SAMPLE:
            ctx = browser.new_context(viewport={"width": 1280, "height": 900},
                                      locale="en-US")
            page = ctx.new_page()
            errs, warns, failed, pageerrs = [], [], [], []
            page.on("console", lambda m: (errs if m.type == "error" else
                                          warns if m.type == "warning" else []).append(
                f"{m.type}: {m.text[:200]}"))
            page.on("pageerror", lambda e: pageerrs.append(str(e)[:200]))
            page.on("requestfailed", lambda r: failed.append(
                f"{r.failure} {r.url[:120]}"))
            page.on("response", lambda r: failed.append(
                f"HTTP {r.status} {r.url[:120]}") if r.status >= 400 else None)

            url = BASE + path
            try:
                resp = page.goto(url, wait_until="networkidle", timeout=45000)
                status = resp.status if resp else None
            except Exception as e:
                results.append({"label": label, "path": path, "fatal": str(e)[:200]})
                ctx.close()
                continue
            page.wait_for_timeout(2500)
            probe = page.evaluate(PROBE)
            results.append({
                "label": label, "path": path, "http": status,
                "console_errors": errs, "console_warnings": warns[:10],
                "page_errors": pageerrs, "failed_requests": failed,
                **probe,
            })
            ctx.close()
        browser.close()

    (OUT / "runtime.json").write_text(json.dumps(results, indent=1, ensure_ascii=False))

    for r in results:
        print("=" * 92)
        print(f"{r['label']}  ->  {BASE}{r['path']}   HTTP {r.get('http')}")
        if r.get("fatal"):
            print(f"  FATAL: {r['fatal']}")
            continue
        print(f"  <html lang='{r['htmlLang']}' dir='{r['dir']}'>  "
              f"i18n-ready={r['i18nReady']} i18n-debug={r['i18nDebug']}")
        print(f"  title : {r['title'][:80]}")
        print(f"  h1    : {str(r['h1'])[:80]}")
        print(f"  body background-color: {r['bodyBg']}   visibility: {r['bodyVisibility']}")
        print(f"  <link> CSS: {r['cssLinks']}")
        for s in r["sheets"]:
            print(f"     stylesheet {str(s['href'])[:70]:<70} regole={s['rules']}")
        if r["console_errors"]:
            print(f"  CONSOLE ERRORS ({len(r['console_errors'])}):")
            for e in r["console_errors"][:6]:
                print(f"     {e}")
        if r["page_errors"]:
            print(f"  PAGE ERRORS: {r['page_errors'][:3]}")
        bad = [f for f in r["failed_requests"] if "adoff.app" in f]
        if bad:
            print(f"  RICHIESTE FALLITE ({len(bad)}): {bad[:5]}")
        print(f"  nav presente={r['navPresent']}  voci={len(r['navLinks'])}")
        for l in r["navLinks"]:
            print(f"     {l['t']:<22} -> {l['h']}")
        print(f"  footer: {str(r['footerText'])[:200]}")
    print("\nDettaglio -> " + str(OUT / "runtime.json"))


if __name__ == "__main__":
    main()
