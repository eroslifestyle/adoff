#!/usr/bin/env python3
"""Allinea il ?v= di ogni asset condiviso di site/ all'hash del suo contenuto.

Perche' serve: _headers marca /*.js e /*.css come `immutable, max-age=1y`, ma i
nomi file non cambiano mai. L'unico cache-buster e' la query ?v=, che veniva
bumpata a mano — e quindi solo su una parte delle pagine. Il 2026-08-22 su 556
pagine 228 chiedevano ancora /adoff-nav.js?v=260613b: URL cachato da CF e dai
browser PRIMA della rimozione di Premium/Pricing, quindi quelle pagine
servivano il menu vecchio con voci di pagine gia' eliminate.

Con l'hash del contenuto il token cambia da solo a ogni modifica dell'asset, e
resta identico su tutte le pagine. Idempotente: rilanciarlo senza modifiche non
tocca nulla.
"""
import hashlib
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / "site"
# sw.js: header no-store e registrazione by-URL, non va versionato
EXCLUDE = {"sw.js"}
ASSET_RE = re.compile(
    r'((?:src|href)=")((?!https?:|//)[A-Za-z0-9_./-]+\.(?:js|css))(\?v=[A-Za-z0-9._-]+)?(")'
)


def content_hash(asset_path: Path) -> str:
    return hashlib.sha256(asset_path.read_bytes()).hexdigest()[:8]


def main() -> int:
    hashes: dict[str, str] = {}
    changed_files = 0
    changed_refs = 0

    for html in sorted(SITE.rglob("*.html")):
        original = html.read_text(encoding="utf-8")

        def replace(match: re.Match) -> str:
            nonlocal changed_refs
            prefix, url, _old_query, suffix = match.groups()
            # url assoluto = relativo a site/, altrimenti relativo alla pagina
            asset = (SITE / url.lstrip("/")) if url.startswith("/") else (html.parent / url)
            try:
                name = asset.resolve().relative_to(SITE.resolve()).as_posix()
            except ValueError:
                return match.group(0)  # fuori da site/
            if name in EXCLUDE:
                return match.group(0)
            if name not in hashes:
                if not asset.is_file():
                    return match.group(0)  # asset mancante
                hashes[name] = content_hash(asset)
            new = f"{prefix}{url}?v={hashes[name]}{suffix}"
            if new != match.group(0):
                changed_refs += 1
            return new

        updated = ASSET_RE.sub(replace, original)
        if updated != original:
            html.write_text(updated, encoding="utf-8")
            changed_files += 1

    for name, digest in sorted(hashes.items()):
        print(f"  {name} -> ?v={digest}")
    print(f"  {changed_refs} riferimenti allineati in {changed_files} pagine")
    return 0


if __name__ == "__main__":
    sys.exit(main())
