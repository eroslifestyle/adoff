#!/usr/bin/env python3
"""
Test harness for AdOff Gemini workflows (w20-w23).
Validates prompt + brand-guard against test fixtures.
Uses n8n webhook endpoints directly.
"""

import json
import os
import sys
import time
import requests
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
import re

# ============================================================================
# CONFIG
# ============================================================================

N8N_BASE_URL = os.environ.get("N8N_BASE_URL", "http://localhost:5678")
N8N_API_URL = os.environ.get("N8N_API_URL", "http://100.71.178.53:5678")
WEBHOOK_TIMEOUT = int(os.environ.get("WEBHOOK_TIMEOUT", "30"))
POLL_TIMEOUT = int(os.environ.get("POLL_TIMEOUT", "60"))

WEBHOOK_PATHS = {
    "w20-gemini-copy-caption": "gemini-copywriter-caption",
    "w21-gemini-email-ad-landing": "gemini-long-copy",
    "w22-gemini-strategist-calendar": "gemini-strategy",
    "w23-gemini-seo-research": "gemini-seo",
}

# Brand blacklist (from CLAUDE.md)
FORBIDDEN_BRANDS = {
    "youtube", "google", "facebook", "instagram", "tiktok",
    "twitter", "x", "amazon", "reddit", "twitch", "github", "linkedin"
}
FORBIDDEN_PATTERNS = [
    r"149\s*(KB|K B|kilobyte|kilobytes|kb)",
]

@dataclass
class TestResult:
    test_id: str
    workflow: str
    passed: bool
    reason: str
    tokens_used: Tuple[int, int]  # (in, out)
    execution_time: float
    cost_usd: float
    details: Dict[str, Any]

# ============================================================================
# HELPERS
# ============================================================================

def load_fixtures(path: str = None) -> List[Dict]:
    """Load test fixtures from JSON."""
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "test_fixtures.json")

    with open(path, 'r') as f:
        data = json.load(f)
    return data.get("fixtures", [])

def check_brand_leak(text: str) -> Tuple[bool, str]:
    """
    Check if text contains forbidden brands or patterns.
    Returns (is_clean, leak_reason).
    """
    if not text:
        return True, ""

    text_lower = str(text).lower()

    # Check brand blacklist (word boundary, case-insensitive)
    for brand in FORBIDDEN_BRANDS:
        pattern = r"\b" + re.escape(brand) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
            return False, f"brand_leak:{brand}"

    # Check forbidden patterns
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return False, f"forbidden_pattern:{pattern}"

    return True, ""

def is_valid_json(text: str) -> bool:
    """Try to parse JSON, or find JSON in text."""
    try:
        json.loads(text)
        return True
    except:
        # Try to extract JSON from markdown/text
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                json.loads(match.group())
                return True
            except:
                pass
    return False

def estimate_tokens(text: str) -> int:
    """Rough estimate: ~4 chars per token."""
    return max(1, len(str(text)) // 4)

def estimate_cost(tokens_in: int, tokens_out: int, model: str = "gemini-2.5-flash") -> float:
    """
    Rough cost estimate (Gemini pricing as of 2026-05).
    Flash: $0.075/1M in, $0.30/1M out
    Pro: $3/1M in, $12/1M out
    """
    if "pro" in model.lower():
        in_cost = (tokens_in / 1_000_000) * 3.0
        out_cost = (tokens_out / 1_000_000) * 12.0
    else:
        in_cost = (tokens_in / 1_000_000) * 0.075
        out_cost = (tokens_out / 1_000_000) * 0.30

    return in_cost + out_cost

# ============================================================================
# TEST EXECUTION
# ============================================================================

class GeminiWorkflowTester:
    def __init__(self, base_url: str = N8N_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.timeout = WEBHOOK_TIMEOUT
        self.results: List[TestResult] = []

    def run_fixture(self, fixture: Dict) -> TestResult:
        """Execute a single test fixture via webhook."""
        test_id = fixture.get("id", "unknown")
        workflow = fixture.get("workflow", "unknown")
        start_time = time.time()

        try:
            # Build payload based on workflow type
            payload = self._build_payload(fixture)

            # Call webhook
            webhook_path = WEBHOOK_PATHS.get(workflow)
            if not webhook_path:
                return TestResult(
                    test_id=test_id, workflow=workflow, passed=False,
                    reason="unknown_workflow", tokens_used=(0, 0),
                    execution_time=time.time() - start_time, cost_usd=0,
                    details={"error": f"Unknown workflow: {workflow}"}
                )

            url = f"{self.base_url}/webhook/{webhook_path}"
            print(f"[{test_id}] ...", end="", flush=True)

            response = self.session.post(url, json=payload, timeout=WEBHOOK_TIMEOUT)
            response.raise_for_status()

            # Parse response
            resp_json = response.json()
            execution_time = time.time() - start_time

            # Validate response
            is_valid, validation_reason = self._validate_response(fixture, resp_json)

            tokens_in = resp_json.get("tokens_in", estimate_tokens(json.dumps(payload)))
            tokens_out = resp_json.get("tokens_out", 0)
            cost = estimate_cost(tokens_in, tokens_out, resp_json.get("model", "gemini-2.5-flash"))

            result = TestResult(
                test_id=test_id,
                workflow=workflow,
                passed=is_valid,
                reason=validation_reason,
                tokens_used=(tokens_in, tokens_out),
                execution_time=execution_time,
                cost_usd=cost,
                details=resp_json
            )

            status = "PASS" if is_valid else "FAIL"
            print(f" {status}")

            return result

        except Exception as e:
            execution_time = time.time() - start_time
            print(f" FAIL (exception: {str(e)[:60]})")
            return TestResult(
                test_id=test_id,
                workflow=workflow,
                passed=False,
                reason="exception",
                tokens_used=(0, 0),
                execution_time=execution_time,
                cost_usd=0,
                details={"error": str(e)}
            )

    def _build_payload(self, fixture: Dict) -> Dict:
        """Build webhook payload from fixture."""
        workflow = fixture.get("workflow")
        payload = {}

        if workflow == "w20-gemini-copy-caption":
            payload = {
                "concept": fixture.get("concept", ""),
                "langs": fixture.get("langs", ["it", "en"]),
                "platforms": fixture.get("platforms", ["instagram"]),
                "tone": fixture.get("tone", "energica, brillante, diretta"),
            }

        elif workflow == "w21-gemini-email-ad-landing":
            payload = {
                "concept": fixture.get("concept", ""),
                "asset_types": fixture.get("asset_types", ["email_drip"]),
                "langs": fixture.get("langs", ["it", "en"]),
                "tone": fixture.get("tone", "energica, brillante, diretta"),
                "use_pro": fixture.get("use_pro", False),
                "variants": fixture.get("variants", 1),
            }
            if "email_context" in fixture:
                payload["email_context"] = fixture["email_context"]
            if "ad_platform" in fixture:
                payload["ad_platform"] = fixture["ad_platform"]
            if "landing_section" in fixture:
                payload["landing_section"] = fixture["landing_section"]

            # Simulate cost runaway test
            if fixture.get("extra_langs_payload"):
                payload["langs"] = [f"lang{i}" for i in range(fixture["extra_langs_payload"])]

        elif workflow == "w22-gemini-strategist-calendar":
            payload = {
                "goal": fixture.get("goal", ""),
                "timeframe": fixture.get("timeframe", "next 30 days"),
                "target_audience": fixture.get("target_audience", ""),
                "budget_note": fixture.get("budget_note", ""),
                "lang": fixture.get("lang", "it"),
            }
            if "channels_hint" in fixture:
                payload["channels_hint"] = fixture["channels_hint"]

        elif workflow == "w23-gemini-seo-research":
            payload = {
                "seeds": fixture.get("seeds", ["ad blocker"]),
                "langs": fixture.get("langs", ["it", "en"]),
                "market": fixture.get("market", "EU"),
            }

        return payload

    def _validate_response(self, fixture: Dict, response: Dict) -> Tuple[bool, str]:
        """Validate response against fixture expectations."""
        expected = fixture.get("expected", {})

        # Check if response is OK (workflow succeeded or correctly rejected)
        expected_ok = expected.get("ok", True)
        response_ok = response.get("ok", True)

        # If we expect it to FAIL, check that it failed correctly
        if not expected_ok:
            if response_ok:
                return False, f"expected_fail_but_ok"
            expected_reason = expected.get("reason", "")
            response_reason = response.get("reason", "")
            if expected_reason and expected_reason not in response_reason:
                return False, f"wrong_fail_reason:{response_reason} (expected {expected_reason})"
            return True, f"correctly_rejected:{expected_reason}"

        # If we expect it to SUCCEED, validate structure
        if not response_ok:
            reason = response.get("reason", "unknown")
            return False, f"response_not_ok:{reason}"

        # Check response body contains expected fields
        response_body = response.get("parsed", response.get("body", {}))
        if isinstance(response_body, str):
            response_body = {}

        # Check for brand leaks in the entire response
        response_str = json.dumps(response)
        is_clean, leak_reason = check_brand_leak(response_str)
        if not is_clean:
            return False, f"brand_leak_found:{leak_reason}"

        # Type-specific checks
        workflow = fixture.get("workflow")

        if workflow == "w20-gemini-copy-caption":
            if expected.get("has_caption"):
                if "caption" not in response_body:
                    return False, "missing_caption"
                caption = str(response_body.get("caption", ""))
                if len(caption) < expected.get("caption_min", 30):
                    return False, "caption_too_short"
                if len(caption) > expected.get("caption_max", 2000):
                    return False, "caption_too_long"

            if expected.get("has_hashtags"):
                if "hashtags" not in response_body:
                    return False, "missing_hashtags"
                hashtags = response_body.get("hashtags", [])
                if not isinstance(hashtags, list) or len(hashtags) < 1:
                    return False, "invalid_hashtags"

        elif workflow == "w21-gemini-email-ad-landing":
            if expected.get("has_subject"):
                if "subject" not in response_body:
                    return False, "missing_subject"
            if expected.get("has_body"):
                if "body_markdown" not in response_body:
                    return False, "missing_body"
            if expected.get("has_headlines"):
                if "headlines" not in response_body:
                    return False, "missing_headlines"
            if expected.get("has_descriptions"):
                if "descriptions" not in response_body:
                    return False, "missing_descriptions"

        elif workflow == "w22-gemini-strategist-calendar":
            if expected.get("has_executive_summary"):
                if "executive_summary" not in response_body:
                    return False, "missing_executive_summary"
            if expected.get("has_calendar"):
                calendar = response_body.get("calendar", [])
                if not isinstance(calendar, list):
                    return False, "invalid_calendar"
                min_days = expected.get("calendar_min_days", 28)
                if len(calendar) < min_days:
                    return False, f"calendar_too_short:{len(calendar)}<{min_days}"

        elif workflow == "w23-gemini-seo-research":
            if expected.get("has_main_keyword"):
                if "main_keyword" not in response_body:
                    return False, "missing_main_keyword"
            if expected.get("has_long_tail"):
                long_tail = response_body.get("long_tail_variants", [])
                min_count = expected.get("long_tail_min", 8)
                if len(long_tail) < min_count:
                    return False, f"long_tail_too_short:{len(long_tail)}<{min_count}"
            if expected.get("has_topic_cluster"):
                if "topic_cluster" not in response_body:
                    return False, "missing_topic_cluster"
            if expected.get("has_content_brief"):
                if "content_brief" not in response_body:
                    return False, "missing_content_brief"

        return True, "ok"

    def run_all(self, fixtures: List[Dict] = None) -> List[TestResult]:
        """Run all fixtures."""
        if fixtures is None:
            fixtures = load_fixtures()

        print(f"\n{'='*80}")
        print(f"AdOff Gemini Workflows Test Harness")
        print(f"{'='*80}")
        print(f"n8n: {self.base_url}")
        print(f"Fixtures: {len(fixtures)}")
        print(f"{'='*80}\n")

        for i, fixture in enumerate(fixtures, 1):
            print(f"[{i:2d}/{len(fixtures)}]", end=" ")
            result = self.run_fixture(fixture)
            self.results.append(result)
            time.sleep(0.5)  # Rate limit

        return self.results

    def print_summary(self):
        """Print test summary."""
        if not self.results:
            print("No results to summarize.")
            return

        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed

        # Count by expected outcome
        correctly_rejected = sum(
            1 for r in self.results
            if not r.passed and "correctly_rejected" in r.reason
        )

        total_tokens_in = sum(r.tokens_used[0] for r in self.results)
        total_tokens_out = sum(r.tokens_used[1] for r in self.results)
        total_cost = sum(r.cost_usd for r in self.results)
        total_time = sum(r.execution_time for r in self.results)

        print(f"\n{'='*80}")
        print(f"TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total:              {total} tests")
        print(f"Passed:             {passed} ({100*passed//total}%)")
        print(f"Failed:             {failed}")
        print(f"  - Correctly rejected (brand/injection): {correctly_rejected}")
        print(f"  - Actual failures: {failed - correctly_rejected}")
        print(f"\nTokens used:        {total_tokens_in:,} in, {total_tokens_out:,} out")
        print(f"Cost (estimated):   ${total_cost:.4f}")
        print(f"Execution time:     {total_time:.1f}s ({total_time/total:.2f}s/test avg)")
        print(f"{'='*80}\n")

        # Detailed results
        print("DETAILED RESULTS:\n")
        for result in self.results:
            status = "✓" if result.passed else "✗"
            print(f"{status} {result.test_id:30s} | {result.workflow:15s} | {result.reason:30s} | ${result.cost_usd:.4f}")

        print(f"\n{'='*80}\n")

        # Check for injection attempts
        injection_tests = [r for r in self.results if "adversarial" in r.test_id]
        if injection_tests:
            print(f"PROMPT INJECTION DEFENSE ({len(injection_tests)} tests):\n")
            for result in injection_tests:
                blocked = not result.passed and "correctly_rejected" in result.reason
                status = "BLOCKED" if blocked else "VULNERABLE"
                print(f"  [{status}] {result.test_id}: {result.reason}")
            print()

        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "correctly_rejected": correctly_rejected,
            "total_cost_usd": total_cost,
            "total_time_s": total_time,
            "tokens_in": total_tokens_in,
            "tokens_out": total_tokens_out,
        }

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    tester = GeminiWorkflowTester(base_url=N8N_BASE_URL)

    # Try to load fixtures
    try:
        fixtures = load_fixtures()
    except FileNotFoundError:
        print("Error: test_fixtures.json not found!")
        sys.exit(1)

    # Run all tests
    results = tester.run_all(fixtures)
    summary = tester.print_summary()

    # Exit code based on results
    if summary["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)
