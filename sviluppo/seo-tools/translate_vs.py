#!/usr/bin/env python3
"""Translate a vs/ comparison HTML page EN -> target language via coder-next-ablit.

Reuses the proven LLM machinery of translate_cluster.py (call_llm batch protocol,
clean_output). Translates only text nodes + a whitelist of visible attributes —
never asks the model to emit HTML, so markup can't break. Writes site/<lang>/vs/
<slug>.html (it -> site/it/vs/) and injects the it/en/x-default hreflang block
into both the source EN page and the new translated page.

Usage: python3 translate_vs.py --slug cyberghost --lang it
"""
import argparse
import sys
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Comment, Doctype

PARSER = "html.parser"  # faithful round-trip (lxml drops doctype/restructures)

import translate_cluster as tc

ROOT = Path("/mnt/nvme2/projects/Progetti/ChromePlugin")
SITE = ROOT / "site"
KEY_FILE = Path.home() / ".claude/secrets/local-llm.env"

# target langs for vs/ (site supports it+en+these); add any missing to tc.LANG_NAMES
LANG_NAMES = {"it": "Italian", **tc.LANG_NAMES}
for _l, _n in LANG_NAMES.items():
    tc.LANG_NAMES.setdefault(_l, _n)

SKIP_PARENTS = {"script", "style", "code", "pre", "noscript", "svg"}
ATTR_TAGS = {
    "title": None,                 # <title> handled as text
    "meta": ("content",),          # only for name/property in META_KEYS
    "img": ("alt",),
    "input": ("placeholder", "aria-label"),
    "a": ("aria-label", "title"),
    "button": ("aria-label", "title"),
}
META_KEYS = {"description", "og:title", "og:description",
             "twitter:title", "twitter:description", "og:image:alt"}


def load_key():
    for line in KEY_FILE.read_text().splitlines():
        if line.startswith("LITELLM_API_KEY"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("LITELLM_API_KEY not found in " + str(KEY_FILE))


def is_translatable(s):
    t = s.strip()
    if not t:
        return False
    # skip pure punctuation / numbers / symbols
    return any(c.isalpha() for c in t)


def collect_units(soup):
    """Return (kind, ref, original) tuples. kind in {'text','attr'}."""
    units = []
    # text nodes
    for node in soup.find_all(string=True):
        if isinstance(node, (Comment, Doctype)):
            continue
        parent = node.parent
        if not parent or parent.name in SKIP_PARENTS or parent.name == "[document]":
            continue
        if is_translatable(str(node)):
            units.append(("text", node, str(node)))
    # <title>
    if soup.title and soup.title.string and is_translatable(soup.title.string):
        pass  # already captured as text node above
    # attributes
    for tag in soup.find_all(True):
        name = tag.name
        if name == "meta":
            key = tag.get("name") or tag.get("property")
            if key in META_KEYS and tag.get("content") and is_translatable(tag["content"]):
                units.append(("attr", (tag, "content"), tag["content"]))
            continue
        attrs = ATTR_TAGS.get(name)
        if not attrs:
            continue
        for a in attrs:
            v = tag.get(a)
            if v and is_translatable(v):
                units.append(("attr", (tag, a), v))
    return units


def translate_strings(strings, lang, model, api_key):
    """Batch-translate with the proven <<<N>>> protocol; per-unit fallback."""
    if not strings:
        return []
    out = [None] * len(strings)
    # chunk to keep each request modest
    CHUNK = 25
    for start in range(0, len(strings), CHUNK):
        chunk = strings[start:start + CHUNK]
        blocks = tc.build_blocks(chunk)
        try:
            resp = tc.call_llm(blocks, lang, model, api_key, batch=True)
            parsed = tc.parse_blocks(resp, len(chunk))
        except Exception:
            parsed = None
        if parsed is None:
            # fallback: one call per string
            for i, s in enumerate(chunk):
                try:
                    parsed_i = tc.call_llm(s, lang, model, api_key)
                except Exception as e:
                    print(f"  [warn] unit failed, keeping EN: {e}", file=sys.stderr)
                    parsed_i = s
                out[start + i] = parsed_i
        else:
            for i, s in enumerate(parsed):
                out[start + i] = s
        print(f"  translated {min(start + CHUNK, len(strings))}/{len(strings)}",
              file=sys.stderr)
    return out


def hreflang_links(soup, slug):
    """Return 3 <link> tags (it/en/x-default) for this slug."""
    pairs = [("it", f"https://adoff.app/it/vs/{slug}"),
             ("en", f"https://adoff.app/vs/{slug}"),
             ("x-default", f"https://adoff.app/vs/{slug}")]
    tags = []
    for hl, href in pairs:
        t = soup.new_tag("link", rel="alternate", href=href)
        t["hreflang"] = hl
        tags.append(t)
    return tags


def ensure_hreflang(soup, slug):
    """Insert hreflang block right after the canonical link if absent."""
    if soup.find("link", rel="alternate", hreflang="it"):
        return False
    canon = soup.find("link", rel="canonical")
    if not canon:
        return False
    for t in reversed(hreflang_links(soup, slug)):
        canon.insert_after(t)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--lang", default="it")
    ap.add_argument("--model", default=tc.DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    lang = args.lang
    if lang not in LANG_NAMES:
        raise SystemExit(f"unsupported lang {lang}; known: {sorted(LANG_NAMES)}")

    src = SITE / "vs" / f"{args.slug}.html"
    if not src.exists():
        raise SystemExit(f"source EN page not found: {src}")
    dst_dir = SITE / lang / "vs"
    dst = dst_dir / f"{args.slug}.html"

    api_key = load_key()
    src_html = src.read_text(encoding="utf-8")

    # build translated page from a parse of the EN source. The EN page already
    # carries the full per-language hreflang block (committed by the i18n pass);
    # we inherit it verbatim and never rewrite the EN source.
    soup = BeautifulSoup(src_html, PARSER)
    units = collect_units(soup)
    originals = [u[2] for u in units]
    print(f"[{args.slug}->{lang}] {len(units)} units", file=sys.stderr)
    if args.dry_run:
        for u in units[:15]:
            print("  UNIT:", repr(u[2][:80]), file=sys.stderr)
        return

    translated = translate_strings(originals, lang, args.model, api_key)
    for (kind, ref, _orig), new in zip(units, translated):
        if new is None:
            continue
        if kind == "text":
            ref.replace_with(NavigableString(new))
        else:
            tag, attr = ref
            tag[attr] = new

    # set lang + canonical on translated page (hreflang alternates inherited)
    html_tag = soup.find("html")
    if html_tag:
        html_tag["lang"] = lang
    canon = soup.find("link", rel="canonical")
    if canon:
        canon["href"] = f"https://adoff.app/{lang}/vs/{args.slug}"

    dst_dir.mkdir(parents=True, exist_ok=True)
    dst.write_text(str(soup), encoding="utf-8")
    print(f"WROTE {dst} ({len(str(soup).splitlines())} lines)")


if __name__ == "__main__":
    main()
