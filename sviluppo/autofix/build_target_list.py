#!/usr/bin/env python3
"""Build target list per il crawler notturno Auto-Fix."""
import json, hashlib
from pathlib import Path
from datetime import datetime, timezone

OUT = Path(__file__).parent / "targets.json"

ALLOWED_CATEGORIES = {"news", "video", "streaming", "blog", "ecommerce", "forum", "social"}

DEFAULT_TARGETS = [
    {"domain": "repubblica.it", "category": "news", "site_type": "article", "country": "IT"},
    {"domain": "ansa.it", "category": "news", "site_type": "article", "country": "IT"},
    {"domain": "bbc.com", "category": "news", "site_type": "article", "country": "EN"},
    {"domain": "youtube.com", "category": "video", "site_type": "video", "country": "GLOBAL"},
    {"domain": "vimeo.com", "category": "video", "site_type": "video", "country": "GLOBAL"},
    {"domain": "twitch.tv", "category": "streaming", "site_type": "player", "country": "GLOBAL"},
    {"domain": "dailymotion.com", "category": "streaming", "site_type": "player", "country": "GLOBAL"},
    {"domain": "medium.com", "category": "blog", "site_type": "article", "country": "GLOBAL"},
    {"domain": "wordpress.com", "category": "blog", "site_type": "article", "country": "GLOBAL"},
    {"domain": "amazon.it", "category": "ecommerce", "site_type": "product", "country": "IT"},
    {"domain": "ebay.it", "category": "ecommerce", "site_type": "product", "country": "IT"},
    {"domain": "aliexpress.com", "category": "ecommerce", "site_type": "product", "country": "GLOBAL"},
    {"domain": "reddit.com", "category": "forum", "site_type": "thread", "country": "GLOBAL"},
    {"domain": "quora.com", "category": "forum", "site_type": "thread", "country": "GLOBAL"},
    {"domain": "facebook.com", "category": "social", "site_type": "feed", "country": "GLOBAL"},
    {"domain": "twitter.com", "category": "social", "site_type": "feed", "country": "GLOBAL"},
]

def normalize_domain(raw):
    raw = raw.strip().lower()
    for prefix in ("https://", "http://", "www."):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
    raw = raw.split("/")[0].split("?")[0]
    parts = raw.split(".")
    if len(parts) < 2 or len(parts[-1]) < 2:
        return None
    return ".".join(parts[-2:])

def enrich_from_survey():
    # Stub: quando il worker espone /admin/autofix/domains, qui lo chiami
    # Per ora ritorna vuoto
    return []

def build(rotation_slice=0, slice_size=20):
    survey_domains = enrich_from_survey()
    allowed = [t for t in DEFAULT_TARGETS if t["category"] in ALLOWED_CATEGORIES]
    for d in survey_domains:
        norm = normalize_domain(d.get("domain", ""))
        if norm and not any(t["domain"] == norm for t in allowed):
            allowed.append({
                "domain": norm, "category": d.get("category", "unknown"),
                "site_type": "article", "country": d.get("country", "GLOBAL"), "source": "survey"
            })
    total = len(allowed)
    start = (rotation_slice * slice_size) % max(total, 1)
    prioritized = allowed[start:start + slice_size]
    if len(prioritized) < slice_size:
        prioritized += allowed[:slice_size - len(prioritized)]
    fingerprint = hashlib.sha256(
        json.dumps(prioritized, sort_keys=True).encode()
    ).hexdigest()[:12]
    return {
        "version": 1,
        "generated": datetime.now(timezone.utc).isoformat(),
        "fingerprint": fingerprint,
        "rotation_slice": rotation_slice, "slice_size": slice_size,
        "total_available": total, "targets": prioritized
    }

if __name__ == "__main__":
    result = build()
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"targets.json: {len(result['targets'])} siti (slice {result['rotation_slice']}, fp={result['fingerprint']})")
