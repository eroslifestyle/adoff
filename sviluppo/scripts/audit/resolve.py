#!/usr/bin/env python3
"""
Risolutore di URL secondo le regole reali di Cloudflare Pages, verificate
empiricamente su adoff.app il 2026-07-29:

  /x.html          -> 308 verso /x
  /x/index.html    -> 308 verso /x/
  /x   (x.html)    -> 200
  /x   (x/index)   -> 308 verso /x/
  /x/  (x/index)   -> 200
  /x/  (x.html)    -> 308 verso /x
  altrimenti       -> SPA fallback: 200 con la HOMEPAGE IT (soft-404)

Il fallback SPA e' impostato a livello di progetto Pages (not_found_handling),
non e' nel repo: per questo un link rotto non da' mai 404 ma restituisce
silenziosamente la home in italiano.
"""
from pathlib import Path

# Il deploy (sviluppo/scripts/deploy-site.sh) esclude queste directory/file
DEPLOY_EXCLUDE = {"graphify-out", "CLAUDE.md", ".state"}

OK = "OK"
REDIRECT = "REDIRECT"
SOFT404 = "SOFT404"      # 200 ma serve la homepage: link di fatto rotto
EXTERNAL = "EXTERNAL"
SKIP = "SKIP"


def build_index(site_root: Path):
    """Insieme dei path relativi realmente deployati."""
    files = set()
    for p in site_root.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(site_root)
        if rel.parts and rel.parts[0] in DEPLOY_EXCLUDE:
            continue
        files.add(rel.as_posix())
    return files


def resolve(path: str, files: set):
    """
    Restituisce (stato, target_finale, catena_redirect).
    `path` e' il path assoluto dell'URL, senza query ne' hash.
    """
    chain = []
    cur = path
    for _ in range(5):  # anti-loop
        if not cur.startswith("/"):
            cur = "/" + cur
        rel = cur.lstrip("/")

        # /x.html -> 308 /x    e    /x/index.html -> 308 /x/
        if rel.endswith("index.html"):
            nxt = "/" + rel[: -len("index.html")]
            chain.append((cur, nxt))
            cur = nxt
            continue
        if rel.endswith(".html"):
            nxt = "/" + rel[: -len(".html")]
            chain.append((cur, nxt))
            cur = nxt
            continue

        if rel == "":
            return (OK if "index.html" in files else SOFT404), "/index.html", chain

        if rel.endswith("/"):
            idx = rel + "index.html"
            if idx in files:
                return OK, "/" + idx, chain
            cand = rel.rstrip("/") + ".html"
            if cand in files:
                nxt = "/" + rel.rstrip("/")
                chain.append((cur, nxt))
                cur = nxt
                continue
            return SOFT404, None, chain

        # path senza slash finale
        if rel in files:                       # asset esatto (css/js/png/zip/json)
            return OK, "/" + rel, chain
        if rel + ".html" in files:
            return OK, "/" + rel + ".html", chain
        if rel + "/index.html" in files:
            nxt = "/" + rel + "/"
            chain.append((cur, nxt))
            cur = nxt
            continue
        return SOFT404, None, chain

    return SOFT404, None, chain


def classify(href: str):
    """Pre-filtro: separa link interni da esterni/non navigabili."""
    h = (href or "").strip()
    if not h:
        return SKIP, None
    low = h.lower()
    if low.startswith(("mailto:", "tel:", "javascript:", "data:", "blob:")):
        return SKIP, None
    if h.startswith("#"):
        return SKIP, None
    if low.startswith(("http://", "https://", "//")):
        from urllib.parse import urlparse
        parsed = urlparse(h if not h.startswith("//") else "https:" + h)
        # confronto sull'HOSTNAME, non substring: https://instagram.com/adoff.app
        # non e' un link interno.
        if (parsed.hostname or "").lower() in ("adoff.app", "www.adoff.app"):
            return "INTERNAL", parsed.path or "/"
        return EXTERNAL, h
    return "INTERNAL", h


def strip_query(path: str):
    for sep in ("?", "#"):
        if sep in path:
            path = path.split(sep, 1)[0]
    return path
