#!/usr/bin/env python3
"""
Fase 0 — A/B test dei tre provider di scraping su nicchia reale ("productivity").
Misura completezza campi (saves, shares, engagement), latenza, costo.
Genera report comparativo per decisione finale provider.

Run: python3 fase-0-provider-comparison.py
Output: fase-0-results.json + report markdown
"""

import os
import json
import time
import requests
from typing import Any, Dict, List
from dataclasses import dataclass
from datetime import datetime

# Load API keys
TIKHUB_KEY = os.getenv("TIKHUB_API_KEY", "")
ENSEMBLEDATA_TOKEN = os.getenv("ENSEMBLEDATA_API_TOKEN", "")
SCRAPECREATORS_KEY = os.getenv("SCRAPECREATORS_API_KEY", "")

# Test parameters
TEST_NICHE = "productivity"
HASHTAGS = ["productivity", "productivity-tips", "productivity-hacks"]
TARGET_POSTS_PER_PLATFORM = 100  # 100 IG + 100 TikTok per provider
PLATFORMS = ["instagram", "tiktok"]

@dataclass
class PostMetrics:
    """Extracted metrics from a social post."""
    post_id: str
    platform: str
    caption: str
    likes: int | None = None
    saves: int | None = None
    shares: int | None = None
    comments: int | None = None
    views: int | None = None
    completion_rate: float | None = None  # TikTok specific
    watch_time: int | None = None  # IG Reels
    engagement_rate: float | None = None  # calculated

    def to_dict(self) -> dict:
        return {
            "post_id": self.post_id,
            "platform": self.platform,
            "caption_length": len(self.caption) if self.caption else 0,
            "likes": self.likes,
            "saves": self.saves,
            "shares": self.shares,
            "comments": self.comments,
            "views": self.views,
            "completion_rate": self.completion_rate,
            "watch_time": self.watch_time,
            "engagement_rate": self.engagement_rate,
        }

class ProviderTester:
    """Base class for provider testing."""

    def __init__(self, name: str):
        self.name = name
        self.posts: List[PostMetrics] = []
        self.errors: List[str] = []
        self.latencies: List[float] = []
        self.cost_estimate: float = 0.0

    def test(self) -> Dict[str, Any]:
        """Run tests and return results."""
        raise NotImplementedError

    def completeness_score(self) -> Dict[str, float]:
        """Calculate % of non-None values per field."""
        if not self.posts:
            return {}

        fields = ["saves", "shares", "views", "comments", "completion_rate"]
        scores = {}
        for field in fields:
            count = sum(1 for p in self.posts if getattr(p, field, None) is not None)
            scores[field] = (count / len(self.posts)) * 100
        return scores

    def report(self) -> Dict[str, Any]:
        """Generate report for this provider."""
        return {
            "provider": self.name,
            "posts_collected": len(self.posts),
            "errors": len(self.errors),
            "error_messages": self.errors[:5],  # First 5 errors
            "avg_latency_ms": sum(self.latencies) / len(self.latencies) * 1000 if self.latencies else 0,
            "estimated_cost": self.cost_estimate,
            "completeness": self.completeness_score(),
        }


class TikHubTester(ProviderTester):
    """Test TikHub provider."""

    def __init__(self):
        super().__init__("TikHub")
        self.api_key = TIKHUB_KEY
        self.base_url = "https://api.tikhub.io"

    def test(self) -> Dict[str, Any]:
        """Query TikHub for posts on productivity niche."""
        print(f"[{self.name}] Starting test...")

        for platform in PLATFORMS:
            for hashtag in HASHTAGS:
                endpoint = f"{self.base_url}/v1/posts/search"
                params = {
                    "platform": platform,
                    "keywords": hashtag,
                    "count": 50,
                    "sort": "engagement",
                }
                headers = {
                    "X-API-Key": self.api_key,
                    "Content-Type": "application/json",
                }

                try:
                    start = time.time()
                    resp = requests.get(endpoint, params=params, headers=headers, timeout=10)
                    latency = time.time() - start
                    self.latencies.append(latency)

                    if resp.status_code != 200:
                        self.errors.append(f"[{platform}/{hashtag}] HTTP {resp.status_code}: {resp.text[:100]}")
                        continue

                    data = resp.json()
                    posts = data.get("data", [])

                    for post in posts:
                        metrics = PostMetrics(
                            post_id=post.get("id", "unknown"),
                            platform=platform,
                            caption=post.get("caption", ""),
                            likes=post.get("likes"),
                            saves=post.get("bookmarks") or post.get("saves"),
                            shares=post.get("shares"),
                            comments=post.get("comments"),
                            views=post.get("views") or post.get("play_count"),
                            completion_rate=post.get("completion_rate"),
                        )
                        self.posts.append(metrics)

                    print(f"  [{self.name}] {platform}/{hashtag}: {len(posts)} posts (latency: {latency:.2f}s)")

                    # Rough cost estimate: TikHub charges $0.001/post
                    self.cost_estimate += len(posts) * 0.001

                except Exception as e:
                    self.errors.append(f"[{platform}/{hashtag}] Exception: {str(e)[:100]}")

        return self.report()


class EnsembleDataTester(ProviderTester):
    """Test EnsembleData provider."""

    def __init__(self):
        super().__init__("EnsembleData")
        self.token = ENSEMBLEDATA_TOKEN
        self.base_url = "https://api.ensembledata.com"

    def test(self) -> Dict[str, Any]:
        """Query EnsembleData for posts on productivity niche."""
        print(f"[{self.name}] Starting test...")

        for platform in PLATFORMS:
            for hashtag in HASHTAGS:
                endpoint = f"{self.base_url}/v1/social/posts"
                params = {
                    "platform": platform,
                    "hashtag": hashtag,
                    "limit": 50,
                    "sort_by": "engagement_rate",
                }
                headers = {
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                }

                try:
                    start = time.time()
                    resp = requests.get(endpoint, params=params, headers=headers, timeout=10)
                    latency = time.time() - start
                    self.latencies.append(latency)

                    if resp.status_code != 200:
                        self.errors.append(f"[{platform}/{hashtag}] HTTP {resp.status_code}: {resp.text[:100]}")
                        continue

                    data = resp.json()
                    posts = data.get("posts", data.get("data", []))

                    for post in posts:
                        metrics = PostMetrics(
                            post_id=post.get("post_id", post.get("id", "unknown")),
                            platform=platform,
                            caption=post.get("caption", post.get("text", "")),
                            likes=post.get("likes_count") or post.get("like_count"),
                            saves=post.get("save_count") or post.get("saves"),
                            shares=post.get("share_count") or post.get("shares"),
                            comments=post.get("comment_count") or post.get("comments"),
                            views=post.get("view_count") or post.get("views"),
                            completion_rate=post.get("completion_rate"),
                        )
                        self.posts.append(metrics)

                    print(f"  [{self.name}] {platform}/{hashtag}: {len(posts)} posts (latency: {latency:.2f}s)")

                    # EnsembleData free trial: ~1000 calls; estimate cost at $0.005/post
                    self.cost_estimate += len(posts) * 0.005

                except Exception as e:
                    self.errors.append(f"[{platform}/{hashtag}] Exception: {str(e)[:100]}")

        return self.report()


class ScrapecreatorsTester(ProviderTester):
    """Test ScrapeCreators provider."""

    def __init__(self):
        super().__init__("ScrapeCreators")
        self.api_key = SCRAPECREATORS_KEY
        self.base_url = "https://api.scrapecreators.com"

    def test(self) -> Dict[str, Any]:
        """Query ScrapeCreators for posts on productivity niche."""
        print(f"[{self.name}] Starting test...")

        for platform in PLATFORMS:
            for hashtag in HASHTAGS:
                endpoint = f"{self.base_url}/v1/search"
                params = {
                    "platform": platform,
                    "query": hashtag,
                    "limit": 50,
                }
                headers = {
                    "X-API-Key": self.api_key,
                    "Content-Type": "application/json",
                }

                try:
                    start = time.time()
                    resp = requests.get(endpoint, params=params, headers=headers, timeout=10)
                    latency = time.time() - start
                    self.latencies.append(latency)

                    if resp.status_code != 200:
                        self.errors.append(f"[{platform}/{hashtag}] HTTP {resp.status_code}: {resp.text[:100]}")
                        continue

                    data = resp.json()
                    posts = data.get("results", data.get("data", []))

                    for post in posts:
                        metrics = PostMetrics(
                            post_id=post.get("id", "unknown"),
                            platform=platform,
                            caption=post.get("caption", post.get("text", "")),
                            likes=post.get("likes"),
                            saves=post.get("saves") or post.get("bookmarks"),
                            shares=post.get("shares"),
                            comments=post.get("comments"),
                            views=post.get("views"),
                            completion_rate=post.get("completion_rate"),
                        )
                        self.posts.append(metrics)

                    print(f"  [{self.name}] {platform}/{hashtag}: {len(posts)} posts (latency: {latency:.2f}s)")

                    # ScrapeCreators: 100 free calls; estimate $0.01/call after
                    self.cost_estimate += len(posts) * 0.01

                except Exception as e:
                    self.errors.append(f"[{platform}/{hashtag}] Exception: {str(e)[:100]}")

        return self.report()


def main():
    """Run Fase 0 provider comparison."""
    print("=" * 70)
    print("FASE 0 — Provider A/B Test (Productivity Niche)")
    print("=" * 70)
    print(f"Test niche: {TEST_NICHE}")
    print(f"Platforms: {', '.join(PLATFORMS)}")
    print(f"Target: ~{TARGET_POSTS_PER_PLATFORM} posts per platform per provider\n")

    # Load env from secrets file if needed
    try:
        with open("/home/mrxxx/.claude/secrets/social-apis.env", "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()
    except Exception as e:
        print(f"Warning: could not load secrets: {e}\n")

    # Run tests
    testers = [
        TikHubTester(),
        EnsembleDataTester(),
        ScrapecreatorsTester(),
    ]

    results = {}
    for tester in testers:
        try:
            report = tester.test()
            results[tester.name] = report
        except Exception as e:
            print(f"[ERROR] {tester.name} test failed: {e}")
            results[tester.name] = {
                "provider": tester.name,
                "error": str(e),
                "posts_collected": 0,
            }

    # Save results
    output_file = "/home/mrxxx/adoff/sviluppo/viral-ce/fase-0-results.json"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "test_config": {
                "niche": TEST_NICHE,
                "hashtags": HASHTAGS,
                "platforms": PLATFORMS,
                "target_posts_per_platform": TARGET_POSTS_PER_PLATFORM,
            },
            "results": results,
        }, f, indent=2)

    # Print summary
    print("\n" + "=" * 70)
    print("RESULTS SUMMARY")
    print("=" * 70)
    for name, report in results.items():
        print(f"\n{name}:")
        print(f"  Posts collected: {report.get('posts_collected', 0)}")
        print(f"  Errors: {report.get('errors', 0)}")
        print(f"  Avg latency: {report.get('avg_latency_ms', 0):.1f}ms")
        print(f"  Est. cost: ${report.get('estimated_cost', 0):.2f}")
        completeness = report.get("completeness", {})
        print(f"  Completeness:")
        for field, pct in completeness.items():
            print(f"    - {field}: {pct:.1f}%")

    print(f"\n✓ Results saved to: {output_file}")
    print("=" * 70)


if __name__ == "__main__":
    main()
