#!/usr/bin/env python3
"""
Daily AdOff Telegram channel post (@adoffapp) — autonomous.

- Generates ONE English marketing post via the local LLM (Ollama brand-max on leobox).
- Rotates through themes: new features, capabilities, strengths, competitor comparisons.
- Numbers come ONLY from site/data/constants.json (local models hallucinate figures).
- Publishes directly to the channel via the Telegram Bot API.

Run by cron at 20:00 Europe/Rome. Language on the channel is ALWAYS English.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
HERE = Path(__file__).resolve()
PROJECT_ROOT = HERE.parents[3]            # .../ChromePlugin
CONSTANTS = PROJECT_ROOT / "site" / "data" / "constants.json"
STATE_FILE = HERE.parent / ".telegram_daily_state.json"
LOG_FILE = PROJECT_ROOT / "sviluppo" / "logs" / "telegram-daily.log"
TG_ENV = Path.home() / ".claude" / "channels" / "telegram" / ".env"

CHANNEL = "@adoffapp"
SITE = "https://adoff.app"
INSTALL = "https://adoff.app/install"
LOGO_URL = "https://adoff.app/assets/adoff-logo.png"  # fallback se la card fallisce
CARD_PATH = "/tmp/adoff_daily_card.png"
LOCAL_MODEL = "brand-max"
# Reach leobox Ollama directly (Tailscale) so cron doesn't depend on a local tunnel.
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "100.71.178.53:11434")
MAX_HISTORY = 14                          # remember last N themes to avoid repeats

# ─── Themes (rotated sequentially) ──────────────────────────────────────────────
THEMES = [
    {"key": "stealth", "brief": "AdOff's signature strength: it stays INVISIBLE to anti-adblock systems. Sites that nag other blockers ('please disable your ad blocker') just work. Stealth anti-detection layer."},
    {"key": "video-ads", "brief": "AdOff neutralizes VIDEO ads: pre-roll and mid-roll on video/streaming platforms are skipped instantly, the player keeps working. No 'ad will end in 5s'."},
    {"key": "privacy", "brief": "Privacy-first: AdOff collects ZERO user data, no tracking, no telemetry, no account needed. Your browsing stays yours."},
    {"key": "universal", "brief": "Universal blocking across EVERY website with {network_rules}+ network rules over {blocking_layers} layers (network, cosmetic, video, stealth). One extension, no allow-lists to babysit."},
    {"key": "lightweight", "brief": "Lightweight and modern: built on Manifest V3, minimal CPU/RAM footprint, no slowdown. Fast browsing, clean pages."},
    {"key": "multi-browser", "brief": "Works on {supported_browsers} browsers: Chrome, Firefox, Edge, Opera, Brave (Safari coming soon). Same protection everywhere."},
    {"key": "trial-value", "brief": "Free core blocking forever. Pro unlocks the stealth + video layer with a {trial_days}-day free trial, then {monthly} EUR/month. Founder annual plan available."},
    {"key": "vs-ublock", "brief": "Friendly comparison vs uBlock Origin: uBlock is great and powerful, but AdOff is built for people who want it to JUST WORK out of the box, plus an invisible stealth layer that defeats anti-adblock walls. Do NOT state any uBlock prices or invented stats — only AdOff's verified strengths and this honest positioning."},
    {"key": "vs-abp", "brief": "Friendly comparison vs AdBlock Plus: unlike 'acceptable ads' programs, AdOff blocks ads with no paid whitelist, and adds stealth anti-detection + video ad neutralization. Do NOT invent competitor prices/stats — only AdOff's verified strengths and honest positioning."},
    {"key": "vs-adguard", "brief": "Friendly comparison vs AdGuard: AdGuard is solid; AdOff focuses on being invisible to anti-adblock and effortless, privacy-first, free core. Do NOT invent competitor prices/stats — only AdOff's verified strengths and honest positioning."},
    {"key": "feature-pause", "brief": "Handy feature: per-site pause / whitelist with one click when you want to support a creator, and it re-enables itself. You stay in control."},
    {"key": "feature-counter", "brief": "Handy feature: a live counter shows how many real ads AdOff blocked — satisfying proof it's working, while trackers are stopped quietly in the background."},
]


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def load_facts():
    with open(CONSTANTS, encoding="utf-8") as f:
        c = json.load(f)
    p = c.get("pricing", {})
    return {
        "network_rules": c.get("network_rules", 138),
        "blocking_layers": c.get("blocking_layers", 4),
        "languages": c.get("languages", 15),
        "supported_browsers": c.get("supported_browsers", 5),
        "trial_days": c.get("trial_days", 30),
        "monthly": p.get("monthly", 2.99),
        "annual_founder": p.get("annual_founder", 19.99),
    }


def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"index": 0, "history": []}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def pick_theme(state):
    n = len(THEMES)
    start = state.get("index", 0) % n
    history = state.get("history", [])
    for off in range(n):
        t = THEMES[(start + off) % n]
        if t["key"] not in history[-len(THEMES) // 2:]:
            return (start + off) % n, t
    return start, THEMES[start]


def build_prompt(theme, facts, card_headline=None):
    brief = theme["brief"].format(**facts)
    system = (
        "You are AdOff's social media copywriter. AdOff is a browser ad blocker extension. "
        "Write ONLY in English. Produce exactly ONE punchy, ULTRA-DYNAMIC Telegram channel post (50-90 words). "
        "FORMAT for maximum impact using Telegram HTML tags ONLY: "
        "<b>bold</b> for the headline and key benefits, <i>italic</i> for emphasis. "
        "Structure: (1) a bold headline line that hooks, with a strong emoji; "
        "(2) a blank line; (3) 2-4 short punchy lines, most STARTING with a relevant emoji like a bullet, "
        "putting the key phrase in <b>bold</b>; (4) a blank line; "
        "(5) a final bold call-to-action line, then the link " + SITE + " on its very last line. "
        "Use plenty of tasteful emoji (one per line is great). Vary rhythm, keep energy high. "
        "Use at most 2 hashtags. Use ONLY <b> and <i> tags (no other HTML, no markdown like ** or #, no headings). "
        "Never say you are an AI. "
        "CRITICAL: do NOT invent numbers, prices, percentages or competitor facts. "
        "Use ONLY the facts given below. If a number is not given, do not state one."
    )
    facts_block = (
        f"VERIFIED FACTS (use only these): "
        f"{facts['network_rules']} network blocking rules; "
        f"{facts['blocking_layers']} protection layers; "
        f"works on {facts['supported_browsers']} browsers (Chrome, Firefox, Edge, Opera, Brave; Safari soon); "
        f"{facts['languages']} languages; "
        f"{facts['trial_days']}-day free Pro trial; Pro {facts['monthly']} EUR/month; "
        f"founder annual {facts['annual_founder']} EUR/year; install at {INSTALL}. "
        f"AdOff collects zero user data. Tagline: 'Ads? Off!'."
    )
    user = f"TOPIC FOR TODAY: {brief}\n\n{facts_block}\n\nWrite the post now."
    if card_headline:
        # L'immagine allegata mostra questa headline: il copy deve esserle congruente.
        user += (f"\n\nThe attached image shows the headline: \"{card_headline}\". "
                 f"Open the post with a hook consistent with it (same idea, "
                 f"not necessarily the same words).")
    return system, user


def generate(system, user, retries=2):
    """Call leobox Ollama /api/chat directly (longer timeout than the shared gen_local helper)."""
    host = OLLAMA_HOST.replace("http://", "").rstrip("/")
    url = f"http://{host}/api/chat"
    payload = json.dumps({
        "model": LOCAL_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": 0.6},
    }).encode()
    last = ""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=payload,
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=420) as r:
                out = json.load(r).get("message", {}).get("content", "").strip()
            if len(out) >= 40:
                return out
            last = f"short/empty response ({len(out)} chars)"
        except Exception as e:  # noqa: BLE001 — transient model/network errors are retried
            last = str(e)[:200]
        if attempt < retries:
            log(f"generate attempt {attempt + 1} failed ({last}); retrying")
    raise RuntimeError(f"ollama generate failed after {retries + 1} attempts: {last}")


ALLOWED_TAGS = ("b", "i", "u", "s", "code")


def sanitize(text):
    # Strip code fences / leading labels the model sometimes adds.
    text = re.sub(r"^```[a-z]*\n?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    text = re.sub(r"^(post|output|here'?s.*?:)\s*", "", text, flags=re.IGNORECASE).strip()
    # Drop any model meta footer.
    text = re.sub(r"\n-{3,}\n_model:.*$", "", text, flags=re.DOTALL).strip()
    # Collapse 3+ blank lines.
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    # Ensure the site link is present.
    if SITE not in text:
        text = text.rstrip() + "\n\n" + SITE
    return text


def to_html(text):
    """Produce Telegram-safe HTML: markdown bold fallback, escape everything, restore allowed tags."""
    # Markdown fallback in case the model ignores the HTML instruction.
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"__(.+?)__", r"<b>\1</b>", text)
    # Escape ALL special chars first.
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Restore only the allowed tags.
    for t in ALLOWED_TAGS:
        text = text.replace(f"&lt;{t}&gt;", f"<{t}>").replace(f"&lt;/{t}&gt;", f"</{t}>")
    return text


def looks_english(text):
    # Reject obvious non-English (Cyrillic/CJK/Arabic) to honor the channel rule.
    return not re.search(r"[Ѐ-ӿ一-鿿؀-ۿ぀-ヿ가-힯]", text)


def telegram_token():
    if "TELEGRAM_BOT_TOKEN" in os.environ:
        return os.environ["TELEGRAM_BOT_TOKEN"]
    for line in TG_ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("TELEGRAM_BOT_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("TELEGRAM_BOT_TOKEN not found")


def _multipart(fields, file_field, file_path):
    """Encode multipart/form-data (stdlib-only) per upload foto locali."""
    boundary = "----AdOffDailyBoundary7361"
    body = b""
    for k, v in fields.items():
        body += (f"--{boundary}\r\nContent-Disposition: form-data; "
                 f"name=\"{k}\"\r\n\r\n{v}\r\n").encode()
    fname = Path(file_path).name
    body += (f"--{boundary}\r\nContent-Disposition: form-data; "
             f"name=\"{file_field}\"; filename=\"{fname}\"\r\n"
             f"Content-Type: image/png\r\n\r\n").encode()
    body += Path(file_path).read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def post_to_channel(token, text, image_path=None):
    """Post foto + caption. image_path locale (card del giorno) o LOGO_URL fallback."""
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    fields = {"chat_id": CHANNEL, "caption": text, "parse_mode": "HTML"}
    if image_path:
        body, ctype = _multipart(fields, "photo", image_path)
        req = urllib.request.Request(url, data=body,
                                     headers={"Content-Type": ctype})
    else:
        fields["photo"] = LOGO_URL
        req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode())
    with urllib.request.urlopen(req, timeout=90) as r:
        out = json.load(r)
    if not out.get("ok"):
        raise RuntimeError(f"Telegram error: {out.get('description')}")
    return out["result"]["message_id"]


def main():
    dry = "--dry-run" in sys.argv
    facts = load_facts()
    state = load_state()
    idx, theme = pick_theme(state)
    log(f"theme={theme['key']} (index {idx})")

    # Card del giorno (immagine a tema, varia ogni giorno). Fallback: logo URL.
    card_path, card_headline = None, None
    try:
        from daily_card import build_card
        card_path, card_headline = build_card(theme["key"], facts, CARD_PATH)
        log(f"card generated: {card_path} — headline: {card_headline}")
    except Exception as e:  # noqa: BLE001 — la card non deve mai bloccare il post
        log(f"card generation failed ({e}); falling back to logo URL")

    system, user = build_prompt(theme, facts, card_headline)
    raw = sanitize(generate(system, user))

    if not looks_english(raw):
        raise RuntimeError(f"generated text not English, aborting: {raw[:120]}")
    if len(raw) < 40 or len(raw) > 1500:
        raise RuntimeError(f"generated text length {len(raw)} out of bounds")

    text = to_html(raw)
    if len(text) > 1024:  # Telegram photo caption hard limit
        raise RuntimeError(f"caption too long for photo post ({len(text)} chars)")
    log(f"generated ({len(text)} chars):\n{text}")

    if dry:
        log("DRY RUN — not posting")
        return

    token = telegram_token()
    mid = post_to_channel(token, text, card_path)
    log(f"POSTED message_id={mid}")

    state["index"] = (idx + 1) % len(THEMES)
    state["history"] = (state.get("history", []) + [theme["key"]])[-MAX_HISTORY:]
    save_state(state)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001 — cron job: log and exit non-zero
        log(f"ERROR: {e}")
        sys.exit(1)
