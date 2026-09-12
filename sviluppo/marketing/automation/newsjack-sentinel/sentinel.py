#!/usr/bin/env python3
"""
AdOff News-Jacking Sentinel — read-only monitoring for trigger events.

Polls public RSS/JSON feeds (no auth, no posting) for keywords matching
ad blocker news. Deduplicates via local JSON store and writes alerts for
new triggers to enable <48h reaction workflow.

Usage: python sentinel.py
  or as cron: 0 */4 * * * cd /path/to/sentinel && python sentinel.py
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen
from xml.etree import ElementTree as ET

# === CONFIGURATION ===
CONFIG_FILE = Path(__file__).parent / "feeds.json"
TRIGGERS_DIR = Path(__file__).parent / "triggers"
LOGGER_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

# === SETUP ===
logging.basicConfig(level=logging.INFO, format=LOGGER_FORMAT)
logger = logging.getLogger(__name__)

TRIGGERS_DIR.mkdir(exist_ok=True)


def load_config() -> dict[str, Any]:
    """Load feeds.json configuration."""
    try:
        with open(CONFIG_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"Config not found: {CONFIG_FILE}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in config: {e}")
        raise


def load_seen_store(config: dict[str, Any]) -> set[str]:
    """Load previously seen item IDs from JSON store."""
    store_path = Path(__file__).parent / config["seen_store_path"]
    if not store_path.exists():
        return set()
    try:
        with open(store_path) as f:
            data = json.load(f)
            return set(data.get("seen_ids", []))
    except (json.JSONDecodeError, IOError):
        return set()


def save_seen_store(config: dict[str, Any], seen_ids: set[str]) -> None:
    """Save seen item IDs to JSON store."""
    store_path = Path(__file__).parent / config["seen_store_path"]
    with open(store_path, "w") as f:
        json.dump({"seen_ids": sorted(seen_ids), "updated": datetime.now().isoformat()}, f)


def fetch_rss(url: str, timeout: int) -> list[dict[str, str]]:
    """Fetch and parse RSS feed, return list of {title, summary, link} items."""
    items: list[dict[str, str]] = []
    try:
        with urlopen(url, timeout=timeout) as resp:
            root = ET.fromstring(resp.read())
            # Handle both RSS and Atom namespaces
            for item in root.findall(".//item") + root.findall(".//entry"):
                title_el = item.find("title")
                summary_el = item.find("summary") or item.find("description")
                link_el = item.find("link")

                title = (title_el.text or "").strip() if title_el is not None else ""
                summary = (summary_el.text or "").strip() if summary_el is not None else ""
                link = link_el.text if link_el is not None else ""
                if link_el is not None and link_el.get("href"):
                    link = link_el.get("href", "")

                if title:
                    items.append({"title": title, "summary": summary, "link": link})
    except (URLError, ET.ParseError) as e:
        logger.warning(f"RSS parse error from {url}: {e}")
    return items


def fetch_json(url: str, timeout: int, json_path: str) -> list[dict[str, str]]:
    """Fetch JSON and extract items, return list of {title, summary, link} items."""
    items: list[dict[str, str]] = []
    try:
        with urlopen(url, timeout=timeout) as resp:
            data = json.loads(resp.read())
            # Navigate to json_path (dot-notation: 'hits' -> data['hits'])
            for key in json_path.split("."):
                data = data.get(key, []) if isinstance(data, dict) else data
            if not isinstance(data, list):
                data = [data]

            for obj in data:
                if isinstance(obj, dict):
                    title = obj.get("title") or obj.get("story_title") or ""
                    summary = obj.get("text") or obj.get("story_text") or ""
                    link = obj.get("url") or obj.get("story_url") or ""
                    if title:
                        items.append(
                            {"title": title, "summary": summary or title, "link": link}
                        )
    except (URLError, json.JSONDecodeError) as e:
        logger.warning(f"JSON parse error from {url}: {e}")
    return items


def matches_keywords(text: str, keywords: list[str]) -> list[str]:
    """Return list of keywords that match text (case-insensitive)."""
    text_lower = text.lower()
    return [kw for kw in keywords if kw.lower() in text_lower]


def detect_triggers(
    items: list[dict[str, str]], keywords: list[str], seen_ids: set[str]
) -> list[dict[str, Any]]:
    """
    Detect trigger events: new items matching keywords.

    Returns list of {title, summary, url, source, matched_keywords, suggested_angle}.
    """
    triggers: list[dict[str, Any]] = []
    for item in items:
        item_id = f"{item['title']}|{item['link']}"  # Dedupe key
        if item_id in seen_ids:
            continue

        matched = matches_keywords(f"{item['title']} {item['summary']}", keywords)
        if matched:
            triggers.append(
                {
                    "title": item["title"],
                    "summary": item["summary"][:300],
                    "url": item["link"],
                    "matched_keywords": matched,
                    "suggested_angle": f"Reaction: {item['title'][:80]}",
                }
            )
            seen_ids.add(item_id)

    return triggers


def write_trigger_alert(trigger: dict[str, Any]) -> None:
    """Write alert JSON file for a trigger event."""
    now = datetime.now()
    filename = f"trigger_{now.strftime('%Y%m%d_%H%M%S')}.json"
    filepath = TRIGGERS_DIR / filename

    alert = {
        "timestamp": now.isoformat(),
        "title": trigger["title"],
        "summary": trigger["summary"],
        "url": trigger["url"],
        "matched_keywords": trigger["matched_keywords"],
        "suggested_angle": trigger["suggested_angle"],
        "status": "new",
        "remotion_props": {
            "headline": trigger["title"],
            "explanation": trigger["summary"],
            "cta_link": "https://adoff.app",
            "cta_text": "adoff.app — un click, e torna il silenzio.",
        },
    }

    with open(filepath, "w") as f:
        json.dump(alert, f, indent=2)

    logger.info(f"Trigger alert written: {filename}")


def run_sentinel() -> None:
    """Main sentinel loop: fetch feeds, detect triggers, write alerts."""
    config = load_config()
    seen_ids = load_seen_store(config)
    timeout = config.get("timeout_seconds", 10)
    keywords = config.get("keywords", [])
    all_items: list[dict[str, str]] = []

    logger.info("Starting sentinel scan...")

    for feed in config.get("feeds", []):
        name = feed["name"]
        url = feed["url"]
        feed_type = feed.get("type", "rss")

        logger.info(f"Fetching {name} ({feed_type})...")

        if feed_type == "rss":
            items = fetch_rss(url, timeout)
        elif feed_type == "json":
            json_path = feed.get("json_path", "")
            items = fetch_json(url, timeout, json_path)
        else:
            logger.warning(f"Unknown feed type: {feed_type}")
            continue

        all_items.extend(items)
        logger.info(f"  → {len(items)} items fetched")
        time.sleep(0.5)  # Rate limit between feeds

    triggers = detect_triggers(all_items, keywords, seen_ids)
    save_seen_store(config, seen_ids)

    if triggers:
        logger.info(f"Found {len(triggers)} new trigger(s)")
        for trigger in triggers:
            write_trigger_alert(trigger)
    else:
        logger.info("No new triggers detected")


if __name__ == "__main__":
    try:
        run_sentinel()
    except KeyboardInterrupt:
        logger.info("Sentinel interrupted")
    except Exception as e:
        logger.error(f"Sentinel error: {e}", exc_info=True)
        raise
