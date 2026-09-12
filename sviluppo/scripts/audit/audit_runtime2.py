#!/usr/bin/env python3
"""
FASE 3b / FASE 6 — secondo giro: pagine fallite al primo tentativo + verifica
di rendering (CSS applicato, nav legacy, tema light/dark) con screenshot.
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "out"
SHOTS = OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
BASE = "https://adoff.app"

TARGETS = [
    ("how-it-works JA", "/ja/how-it-works"),
    ("account", "/account"),
    ("vs uBlock (nav legacy)", "/vs/ublock-origin"),
    ("guide DE (CSS rotto)", "/de/guide"),
    ("guide IT (CSS rotto)", "/it/guide"),
    ("home IT", "/"),
    ("blog index", "/blog/"),
    ("support", "/support"),
]

PROBE = """() => {
  const q = s => document.querySelector(s);
  const nav = q('#site-nav');
  const legacy = q('.nav__links');
  const cs = e => e ? getComputedStyle(e) : null;
  const navCs = cs(nav);
  return {
    htmlLang: document.documentElement.lang,
    theme: document.documentElement.getAttribute('data-theme'),
    title: document.title,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    bodyFont: getComputedStyle(document.body).fontFamily.slice(0,50),
    navExists: !!nav,
    navDisplay: navCs ? navCs.display : null,
    navPosition: navCs ? navCs.position : null,
    navHeight: nav ? nav.getBoundingClientRect().height : 0,
    navNewLinks: nav ? nav.querySelectorAll('.sn-links a').length : 0,
    navLegacyLinks: legacy ? legacy.querySelectorAll('a').length : 0,
    navLegacyTexts: legacy ? [...legacy.querySelectorAll('a')].map(a=>a.textContent.trim()).slice(0,8) : [],
    brokenImgs: [...document.images].filter(i=>i.complete && i.naturalWidth===0)
                 .map(i=>i.getAttribute('src')).slice(0,8),
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    themeToggle: !!q('.theme-toggle'),
  };
}"""


def main():
    res = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, path in TARGETS:
            ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="en-US")
            pg = ctx.new_page()
            errs = []
            pg.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" else None)
            ok, status = False, None
            for attempt in range(3):
                try:
                    r = pg.goto(BASE + path, wait_until="domcontentloaded", timeout=40000)
                    status = r.status if r else None
                    ok = True
                    break
                except Exception as e:
                    last = str(e)[:120]
            if not ok:
                res.append({"label": label, "path": path, "fatal": last})
                ctx.close()
                continue
            pg.wait_for_timeout(3500)
            d = pg.evaluate(PROBE)
            shot = SHOTS / (label.replace(" ", "_").replace("/", "_") + ".png")
            try:
                pg.screenshot(path=str(shot), full_page=False)
            except Exception:
                shot = None
            res.append({"label": label, "path": path, "http": status,
                        "errors": [e for e in errs if "google-analytics" not in e][:5],
                        "shot": str(shot) if shot else None, **d})
            ctx.close()
        b.close()

    (OUT / "runtime2.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))
    for r in res:
        print("=" * 88)
        print(f"{r['label']}  {BASE}{r['path']}  HTTP {r.get('http')}")
        if r.get("fatal"):
            print("  FATAL (3 tentativi):", r["fatal"])
            continue
        print(f"  lang='{r['htmlLang']}' theme={r['theme']} title={r['title'][:60]}")
        print(f"  body bg={r['bodyBg']} color={r['bodyColor']} font={r['bodyFont']}")
        print(f"  nav: exists={r['navExists']} display={r['navDisplay']} pos={r['navPosition']} "
              f"h={r['navHeight']:.0f}px  linkNuovi={r['navNewLinks']} linkLegacy={r['navLegacyLinks']}")
        if r["navLegacyTexts"]:
            print(f"       voci legacy: {r['navLegacyTexts']}")
        print(f"  theme-toggle presente: {r['themeToggle']}")
        print(f"  overflow orizz.: scrollW={r['scrollW']} innerW={r['innerW']}"
              + ("  <-- OVERFLOW" if r["scrollW"] > r["innerW"] + 2 else ""))
        if r["brokenImgs"]:
            print(f"  IMMAGINI ROTTE: {r['brokenImgs']}")
        if r["errors"]:
            print(f"  errori console: {r['errors']}")
        print(f"  screenshot: {r['shot']}")


if __name__ == "__main__":
    main()
