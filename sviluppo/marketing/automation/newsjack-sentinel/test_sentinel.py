"""
Unit tests for newsjack sentinel — keyword match + dedupe logic.

Run: pytest test_sentinel.py -v
"""

import json
import tempfile
from pathlib import Path

import pytest


def test_keyword_match():
    """Test keyword matching (case-insensitive)."""
    from sentinel import matches_keywords

    keywords = ["ad blocker", "manifest v3", "server-side ad"]
    text1 = "Breaking: Ad Blocker Extension Removed from Store"
    text2 = "Check out this cool privacy tool"
    text3 = "Manifest V3 Rollout Accelerates"

    assert "ad blocker" in matches_keywords(text1, keywords)
    assert len(matches_keywords(text2, keywords)) == 0
    assert "manifest v3" in matches_keywords(text3, keywords)


def test_dedupe_logic():
    """Test item deduplication via ID."""
    items = [
        {"title": "Ad Blocker Ban", "link": "http://example.com/1"},
        {"title": "Ad Blocker Ban", "link": "http://example.com/1"},  # Duplicate
        {"title": "Privacy Alert", "link": "http://example.com/2"},
    ]
    seen_ids = set()

    from sentinel import detect_triggers

    keywords = ["ad blocker", "privacy"]
    triggers = detect_triggers(items, keywords, seen_ids)

    # Only 2 unique triggers (the duplicate should be skipped on second call)
    assert len(triggers) == 2
    assert len(seen_ids) == 2


def test_trigger_json_structure():
    """Test trigger alert JSON has expected keys."""
    from sentinel import write_trigger_alert

    trigger = {
        "title": "Test Trigger Title",
        "summary": "Test trigger summary text",
        "url": "https://example.com/test",
        "matched_keywords": ["ad blocker", "manifest v3"],
        "suggested_angle": "Reaction: Test Trigger Title",
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock TRIGGERS_DIR
        triggers_dir = Path(tmpdir)
        triggers_dir.mkdir(exist_ok=True)

        # Monkey patch for test
        import sentinel

        sentinel.TRIGGERS_DIR = triggers_dir

        write_trigger_alert(trigger)

        # Check file was created
        files = list(triggers_dir.glob("trigger_*.json"))
        assert len(files) == 1

        # Check file contents
        with open(files[0]) as f:
            data = json.load(f)
            assert data["title"] == "Test Trigger Title"
            assert "remotion_props" in data
            assert data["remotion_props"]["headline"] == "Test Trigger Title"


def test_seen_store_roundtrip():
    """Test seen store save/load."""
    from sentinel import load_seen_store, save_seen_store

    config = {"seen_store_path": "seen.json"}

    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock Path
        import sentinel

        old_init = Path.__new__

        def patched_new(cls, *args, **kwargs):
            if len(args) > 0 and "seen.json" in str(args[0]):
                return Path(tmpdir) / "seen.json"
            return old_init(cls, *args, **kwargs)

        Path.__new__ = staticmethod(patched_new)
        try:
            seen_ids = {"item1", "item2", "item3"}
            save_seen_store(config, seen_ids)

            loaded = load_seen_store(config)
            assert loaded == seen_ids
        finally:
            Path.__new__ = staticmethod(old_init)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
