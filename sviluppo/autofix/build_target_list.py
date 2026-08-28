#!/usr/bin/env python3
"""Build target list per il crawler notturno Auto-Fix."""
import json, hashlib, subprocess
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

def query_d1(sql):
    """Esegue query sul database D1 del worker via wrangler CLI."""
    import subprocess
    cmd = ["wrangler", "d1", "execute", "adoff-db", "--remote", "--command", sql]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout.strip())

def enrich_from_survey():
    """Estrae domini dalla tabella survey/uninstall (non ancora usata)."""
    # TODO: quando disponibile, query su tabella survey
    # SELECT problem_domain AS domain, COUNT(*) AS reports, MAX(uninstall_ts) AS last_seen
    # FROM adleak_reports GROUP BY problem_domain ORDER BY reports DESC
    return []

def enrich_from_adleak_and_nav():
    """Estrae domini da adleak_reports e nav_stats per prioritizzare i controlli."""
    domains = []
    try:
        # Query 1: domini segnalati in disinstallazione
        adleak_sql = """
            SELECT problem_domain AS domain, COUNT(*) AS reports, MAX(uninstall_ts) AS last_seen
            FROM adleak_reports
            GROUP BY problem_domain
            ORDER BY reports DESC
        """
        adleak_result = query_d1(adleak_sql)
        for row in adleak_result:
            domains.append({
                "domain": row["domain"],
                "category": "unknown",
                "site_type": "article",
                "country": "GLOBAL",
                "source": "adleak_report",
                "reports": row["reports"],
                "last_seen": row["last_seen"]
            })

        # Query 2: domini con ads leaked dalla telemetria navigazione
        nav_sql = """
            SELECT hostname AS domain, SUM(ads_leaked) AS reports, MAX(created_at) AS last_seen
            FROM nav_stats
            WHERE ads_leaked > 0
            GROUP BY hostname
            ORDER BY reports DESC
        """
        nav_result = query_d1(nav_sql)
        for row in nav_result:
            domains.append({
                "domain": row["domain"],
                "category": "unknown",
                "site_type": "article",
                "country": "GLOBAL",
                "source": "nav_stats",
                "reports": row["reports"],
                "last_seen": row["last_seen"]
            })
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
        pass  # Se query fallisce, ritorna lista vuota
    return domains

def build(rotation_slice=0, slice_size=20):
    survey_domains = enrich_from_survey()
    adleak_nav_domains = enrich_from_adleak_and_nav()
    allowed = [t for t in DEFAULT_TARGETS if t["category"] in ALLOWED_CATEGORIES]
    for d in survey_domains:
        norm = normalize_domain(d.get("domain", ""))
        if norm and not any(t["domain"] == norm for t in allowed):
            allowed.append({
                "domain": norm, "category": d.get("category", "unknown"),
                "site_type": "article", "country": d.get("country", "GLOBAL"), "source": "survey"
            })
    for d in adleak_nav_domains:
        norm = normalize_domain(d.get("domain", ""))
        if norm and not any(t["domain"] == norm for t in allowed):
            allowed.append({
                "domain": norm, "category": d.get("category", "unknown"),
                "site_type": "article", "country": d.get("country", "GLOBAL"),
                "source": d.get("source", "adleak_nav")
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
