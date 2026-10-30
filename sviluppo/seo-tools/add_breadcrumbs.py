#!/usr/bin/env python3
"""Add JSON-LD BreadcrumbList to site/ content pages lacking one.

Idempotent: pages already containing "BreadcrumbList" are skipped.
Re-runnable for new pages: edit ROOT_PAGES / rerun with --scan to process
every root/vs page not yet tagged.

Usage: python3 add_breadcrumbs.py [--scan]
"""
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / "site"

ROOT_PAGES = [
    "adblock-detector.html", "bypass-anti-adblock.html", "ad-blocker-chrome.html",
    "ad-blocker-brave.html", "free-ad-blocker.html", "lightweight-ad-blocker.html",
    "private-ad-blocker.html", "undetectable-ad-blocker.html",
    "manifest-v3-ad-blocker.html", "ublock-origin-alternative.html",
    "block-video-ads.html", "how-it-works.html", "guide.html", "install.html",
    "community.html", "press.html",
]

SUFFIX_RE = re.compile(r"\s*[|·–-]\s*AdOff\s*$")


def page_name(path: Path) -> str:
    m = re.search(r"<title>(.*?)</title>", path.read_text(encoding="utf-8"), re.S)
    if not m or not m.group(1).strip():
        return None
    title = re.sub(r"\s+", " ", m.group(1)).strip()
    cleaned = SUFFIX_RE.sub("", title).strip()
    return cleaned or title


def canonical_url(html: str, rel_path: str) -> str:
    m = re.search(r'<link rel="canonical"[^>]*href="([^"]+)"', html)
    if m:
        return m.group(1)
    stem = rel_path[:-5] if rel_path.endswith(".html") else rel_path
    return f"https://adoff.app/{stem}"


def breadcrumb_block(path: Path) -> str | None:
    html = path.read_text(encoding="utf-8")
    name = page_name(path)
    if not name:
        return None
    items = [
        {"@type": "ListItem", "position": 1, "name": "AdOff", "item": "https://adoff.app/"}
    ]
    rel = str(path.relative_to(SITE))
    url = canonical_url(html, rel)
    if rel.startswith("vs/"):
        items.append({"@type": "ListItem", "position": 2, "name": "Comparisons", "item": "https://adoff.app/vs/"})
    items.append({"@type": "ListItem", "position": len(items) + 1, "name": name, "item": url})
    data = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}
    lines = ",\n".join("      " + json.dumps(it, ensure_ascii=False) for it in items)
    body = (
        '  <script type="application/ld+json">\n'
        "  {\n"
        '    "@context": "https://schema.org",\n'
        '    "@type": "BreadcrumbList",\n'
        '    "itemListElement": [\n'
        f"{lines}\n"
        "    ]\n"
        "  }\n"
        "  </script>\n"
    )
    assert json.loads(body.split(">", 1)[1].rsplit("<", 1)[0]) == data
    return body.rstrip("\n")


def process(path: Path, results: dict):
    html = path.read_text(encoding="utf-8")
    if "BreadcrumbList" in html:
        results["skipped"].append(str(path.relative_to(SITE)))
        return
    block = breadcrumb_block(path)
    if block is None:
        results["no_title"].append(str(path.relative_to(SITE)))
        return
    head_end = html.find("</head>")
    updated = html[:head_end] + block + "\n" + html[head_end:]
    # validate every ld+json block in the updated page
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', updated, re.S):
        json.loads(m.group(1))
    path.write_text(updated, encoding="utf-8")
    results["modified"].append(str(path.relative_to(SITE)))


def main():
    if "--scan" in sys.argv:
        targets = sorted(SITE.glob("*.html")) + [p for p in sorted(SITE.glob("vs/*.html")) if p.name != "index.html"]
    else:
        targets = [SITE / p for p in ROOT_PAGES]
        targets += [p for p in sorted(SITE.glob("vs/*.html")) if p.name != "index.html"]
    results = {"modified": [], "skipped": [], "no_title": []}
    for p in targets:
        if p.exists():
            process(p, results)
    print(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
