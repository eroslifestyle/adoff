#!/usr/bin/env python3
"""
FASE 5 — SEO / infrastruttura: sitemap, canonical, hreflang, title/description.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from resolve import build_index, resolve, SOFT404

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

TITLE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)
# ATTENZIONE: l'ordine degli attributi nei <meta>/<link> non e' garantito — molte
# pagine del sito hanno `content=` PRIMA di `name=`. Le prime versioni di questo
# script assumevano un ordine fisso e producevano falsi positivi in massa
# (43 pagine "senza description" che la description ce l'avevano).
# Il valore di content puo' contenere l'altro tipo di apice (una description
# coreana inizia con un apostrofo): serve il backreference al carattere di
# quoting, altrimenti [^"'] tronca il valore e la meta risulta "assente".
DESC = re.compile(
    r"""<meta(?=[^>]*\bname=["']description["'])[^>]*\bcontent=(["'])(.*?)\1[^>]*>"""
    r"""|<meta(?=[^>]*\bcontent=)[^>]*\bname=["']description["'][^>]*>""", re.I | re.S)
CANON = re.compile(r"""<link(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']""", re.I)
CANON2 = re.compile(r"""<link(?=[^>]*\bhref=)[^>]*\brel=["']canonical["'][^>]*>""", re.I)
HREFLANG = re.compile(
    r"""<link[^>]+(?:rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']"""
    r"""|href=["']([^"']+)["'][^>]*hreflang=["']([^"']+)["'][^>]*rel=["']alternate["'])""", re.I)
OG = re.compile(r"""<meta(?=[^>]*\bproperty=["']og:(?:title|description|image)["'])[^>]*\bproperty=["']og:(title|description|image)["'][^>]*>""", re.I)


def url_to_path(u):
    u = u.strip()
    for pre in ("https://adoff.app", "http://adoff.app", "https://www.adoff.app"):
        if u.startswith(pre):
            u = u[len(pre):]
            break
    return (u.split("#")[0].split("?")[0]) or "/"


def main():
    files_idx = build_index(SITE)
    pages = sorted(p for p in SITE.rglob("*.html")
                   if p.relative_to(SITE).parts[0] != "graphify-out")

    titles, descs = defaultdict(list), defaultdict(list)
    no_title, no_desc, no_canon = [], [], []
    canon_broken, canon_mismatch = [], []
    hreflang_broken, hreflang_no_self, hreflang_no_xdefault = [], [], []
    og_missing = []

    for p in pages:
        rel = p.relative_to(SITE).as_posix()
        t = p.read_text(encoding="utf-8", errors="replace")
        head = t[: t.lower().find("</head>") + 7] if "</head>" in t.lower() else t[:12000]

        m = TITLE.search(head)
        title = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
        (titles[title].append(rel) if title else no_title.append(rel))

        m = DESC.search(head)
        d = (m.group(2) or "").strip() if m else ""
        (descs[d].append(rel) if d else no_desc.append(rel))

        m = CANON.search(head) or CANON2.search(head)
        if not m:
            no_canon.append(rel)
        else:
            cp = url_to_path(m.group(1))
            st, tgt, _ = resolve(cp, files_idx)
            if st == SOFT404:
                canon_broken.append((rel, m.group(1)))
            else:
                # il canonical deve puntare a SE STESSO
                own = "/" + rel[:-5] if rel.endswith(".html") else "/" + rel
                own = own.replace("/index", "/") if own.endswith("/index") else own
                if tgt and tgt.lstrip("/") != rel:
                    canon_mismatch.append((rel, m.group(1), tgt))

        hls = []
        for mm in HREFLANG.finditer(head):
            lang = mm.group(1) or mm.group(4)
            href = mm.group(2) or mm.group(3)
            hls.append((lang, href))
        for lang, href in hls:
            st, _, _ = resolve(url_to_path(href), files_idx)
            if st == SOFT404:
                hreflang_broken.append((rel, lang, href))
        if hls and not any(l == "x-default" for l, _ in hls):
            hreflang_no_xdefault.append(rel)

        ogs = {k.lower() for k in OG.findall(head)}
        miss = [k for k in ("title", "description", "image") if k not in ogs]
        if miss:
            og_missing.append((rel, miss))

    print("=" * 84)
    print("FASE 5 — SEO / INFRASTRUTTURA")
    print("=" * 84)
    print(f"pagine analizzate: {len(pages)}")

    print(f"\n--- TITLE ---")
    print(f"  senza <title>            : {len(no_title)}  {no_title[:5]}")
    dup = {k: v for k, v in titles.items() if len(v) > 1}
    print(f"  title DUPLICATI          : {len(dup)} gruppi, {sum(len(v) for v in dup.values())} pagine")
    for t, v in sorted(dup.items(), key=lambda kv: -len(kv[1]))[:6]:
        print(f"     x{len(v):<3} «{t[:64]}»  es. {v[0]}, {v[1]}")

    print(f"\n--- META DESCRIPTION ---")
    print(f"  senza description        : {len(no_desc)}  {no_desc[:5]}")
    dupd = {k: v for k, v in descs.items() if len(v) > 1}
    print(f"  description DUPLICATE    : {len(dupd)} gruppi, {sum(len(v) for v in dupd.values())} pagine")
    for t, v in sorted(dupd.items(), key=lambda kv: -len(kv[1]))[:4]:
        print(f"     x{len(v):<3} «{t[:60]}»  es. {v[0]}")

    print(f"\n--- CANONICAL ---")
    print(f"  senza canonical          : {len(no_canon)}")
    for r in no_canon[:8]:
        print(f"     {r}")
    print(f"  canonical -> pagina INESISTENTE (soft-404): {len(canon_broken)}")
    for r, h in canon_broken[:8]:
        print(f"     {r}  ->  {h}")
    print(f"  canonical che punta ALTROVE (non a se stesso): {len(canon_mismatch)}")
    for r, h, t in canon_mismatch[:8]:
        print(f"     {r}  ->  {h}   (risolve a {t})")

    print(f"\n--- HREFLANG ---")
    print(f"  hreflang -> pagina INESISTENTE: {len(hreflang_broken)}")
    agg = defaultdict(list)
    for r, l, h in hreflang_broken:
        agg[h].append(r)
    for h, rs in sorted(agg.items(), key=lambda kv: -len(kv[1]))[:10]:
        print(f"     x{len(rs):<3} {h}   es. {rs[0]}")
    print(f"  pagine con hreflang ma senza x-default: {len(hreflang_no_xdefault)}")

    print(f"\n--- OPEN GRAPH ---")
    print(f"  pagine con og:* incompleti: {len(og_missing)}")
    cnt = defaultdict(int)
    for _, miss in og_missing:
        for k in miss:
            cnt[k] += 1
    print(f"     mancanti per tipo: {dict(cnt)}")

    # ── sitemap ─────────────────────────────────────────────────────────────
    sm = SITE / "sitemap.xml"
    print(f"\n--- SITEMAP ---")
    if not sm.is_file():
        print("  sitemap.xml ASSENTE")
    else:
        urls = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", sm.read_text(encoding="utf-8"))
        print(f"  URL nel sitemap: {len(urls)}")
        dead = []
        for u in urls:
            st, _, _ = resolve(url_to_path(u), files_idx)
            if st == SOFT404:
                dead.append(u)
        print(f"  URL MORTI nel sitemap: {len(dead)}")
        for u in dead[:12]:
            print(f"     {u}")
        # pagine pubbliche non presenti nel sitemap
        in_sm = {url_to_path(u).rstrip("/") for u in urls}
        missing = []
        for p in pages:
            rel = p.relative_to(SITE).as_posix()
            # stesse esclusioni di gen_sitemap.py: pannelli interni, pagine
            # tecniche, 404 e salesletter (landing volutamente fuori dal sitemap)
            if any(rel.startswith(x) for x in
                   ("mgmt-9f4a/", "admin-console", "account", "panel", "success", "uninstall")):
                continue
            base = rel.rsplit("/", 1)[-1]
            if base in ("404.html", "salesletter.html"):
                continue
            own = "/" + (rel[:-5] if rel.endswith(".html") else rel)
            own = own[:-6] if own.endswith("/index") else own
            if own.rstrip("/") not in in_sm:
                missing.append(own)
        print(f"  pagine pubbliche ASSENTI dal sitemap: {len(missing)}")
        for u in missing[:15]:
            print(f"     {u}")

    json.dump({
        "no_title": no_title, "dup_titles": {k: v for k, v in dup.items()},
        "no_desc": no_desc, "no_canon": no_canon,
        "canon_broken": canon_broken, "canon_mismatch": canon_mismatch,
        "hreflang_broken": hreflang_broken, "og_missing": og_missing,
    }, open(OUT / "seo.json", "w"), indent=1, ensure_ascii=False)
    print(f"\nDettaglio -> {OUT / 'seo.json'}")


if __name__ == "__main__":
    main()
