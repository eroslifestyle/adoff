import asyncio
import json
import re
import sys
sys.path.insert(0, '/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/reviews')

import subprocess, json
from pathlib import Path

# Use bundled playwright
PLAYWRIGHT_PATH = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/reviews/node_modules")
import importlib.util
spec = importlib.util.spec_from_file_location(
    "playwright",
    PLAYWRIGHT_PATH / "playwright" / "index.js"
)
# Actually use python API via subprocess node
EXT_PATH = "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/build-chrome"
TARGET_URL = "https://www.siracusanews.it/"

AD_SELECTORS = [
    ".ad", "[class*='ad-']", "[class*='_ad']", "[class*='Ad ']",
    "iframe[src*='ads']", "iframe[src*='doubleclick']", "iframe[src*='googlesyndication']",
    "div[id*='gpt']", "div[id*='gads']", "[id*='google_ads']",
    "[class*='banner']", "[class*='pubblicita']", "[class*='sponsor']",
    "[data-ad]", "[data-ad-slot]", "[data-google-query-id']",
    "ins.adsbygoogle", ".adsbygoogle", "[id*='div-gpt-ad']",
]

AD_NETWORK_PATTERNS = [
    "doubleclick", "googlesyndication", "googleadservices", "adservice.google",
    "google.com/pagead", "adservice", "adsense",
    "taboola", "outbrain", "criteo", "amazon-adsystem",
    "advertising", "adnxs", "rubiconproject", "pubmatic", "openx",
    "ads.yahoo", "moatads", "scorecardresearch", "quantserve",
    "facebook.com/tr", "bat.bing", "ads.linkedin",
    "imasdk", "video-ads", "adserver", "adnium",
    "adition", "adform", "bidswitch", "casalemedia",
    "sharethrough", "spotxchange", "smartadserver",
    "popads", "propellerads", "mgid", "revcontent",
    "zilla", "serving-sys", "2mdn", "googleadservices",
]

def classify_url(url):
    url_lower = url.lower()
    for pattern in AD_NETWORK_PATTERNS:
        if pattern in url_lower:
            return ("AD_NETWORK", pattern)
    return ("CLEAN", None)

async def main():
    results = {
        "url": TARGET_URL,
        "page_loaded": False,
        "console_errors": [],
        "console_warnings": [],
        "ad_elements_found": [],
        "network_requests_ad": [],
        "network_requests_clean": [],
        "badge_count": None,
        "screenshot_path": "/tmp/siracusanews.png",
    }

    playwright_path = str(PLAYWRIGHT_PATH)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                f"--disable-extensions-except={EXT_PATH}",
                f"--load-extension={EXT_PATH}",
            ]
        )

        context = browser.contexts[0]
        page = await context.new_page()

        console_errors = []
        console_warnings = []
        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)
            elif msg.type == "warning":
                console_warnings.append(msg.text)
        page.on("console", on_console)

        all_requests = []
        def on_request(request):
            all_requests.append(request.url)
        page.on("request", on_request)

        all_responses = {}
        def on_response(response):
            all_responses[response.url] = response.status
        page.on("response", on_response)

        try:
            response = await page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)
            results["page_loaded"] = True
            results["http_status"] = response.status if response else None
        except Exception as e:
            results["page_load_error"] = str(e)
            await browser.close()
            print(json.dumps(results, indent=2, default=str))
            return

        await asyncio.sleep(5)

        ad_elements = []
        for selector in AD_SELECTORS:
            try:
                els = await page.query_selector_all(selector)
                for el in els:
                    bbox = await el.bounding_box()
                    if bbox and bbox["width"] > 50 and bbox["height"] > 20:
                        tag = await el.evaluate("el => el.tagName")
                        cls = await el.evaluate("el => el.className")
                        text = await el.evaluate("el => el.innerText?.substring(0, 100)")
                        src = await el.evaluate("el => el.src || el.getAttribute('src') || el.getAttribute('data-src') || ''")
                        href = await el.evaluate("el => el.href || el.getAttribute('href') || ''")
                        style = await el.evaluate("el => window.getComputedStyle(el).display + ';' + window.getComputedStyle(el).visibility + ';' + window.getComputedStyle(el).opacity")
                        ad_elements.append({
                            "selector": selector,
                            "tag": tag,
                            "class": str(cls),
                            "text": text,
                            "src": src[:300],
                            "href": href[:200],
                            "bbox": bbox,
                            "style": style,
                        })
            except Exception:
                pass

        seen = set()
        unique_ads = []
        for ad in ad_elements:
            key = (round(ad["bbox"]["x"]), round(ad["bbox"]["y"]), round(ad["bbox"]["width"]), round(ad["bbox"]["height"]))
            if key not in seen:
                seen.add(key)
                unique_ads.append(ad)

        results["ad_elements_found"] = unique_ads
        results["console_errors"] = console_errors
        results["console_warnings"] = console_warnings

        for req_url in all_requests:
            classification, matched_pattern = classify_url(req_url)
            entry = {"url": req_url[:400], "pattern": matched_pattern}
            if classification == "AD_NETWORK":
                status = all_responses.get(req_url, "?")
                entry["status"] = status
                entry["blocked"] = status == 0 or status == "blocked"
                results["network_requests_ad"].append(entry)
            else:
                results["network_requests_clean"].append(entry)

        # Try to get badge from extension
        try:
            extensions = context.extensions
            for ext in extensions:
                if "build-chrome" in ext or "Manifest" in ext.name if hasattr(ext, 'name') else False:
                    try:
                        badge = await ext.evaluate("() => { try { return chrome.action.getBadgeText({}) } catch(e) { return null } }")
                        if badge:
                            results["badge_count"] = badge
                    except:
                        pass
        except Exception as e:
            results["badge_note"] = str(e)[:200]

        try:
            await page.screenshot(path="/tmp/siracusanews.png", full_page=True)
        except Exception as e:
            results["screenshot_error"] = str(e)

        await browser.close()

    print(json.dumps(results, indent=2, default=str))

if __name__ == "__main__":
    # Need to import from bundled playwright
    sys.path.insert(0, str(PLAYWRIGHT_PATH / "playwright-core"))
    sys.path.insert(0, str(PLAYWRIGHT_PATH / "playwright-core" / "driver" / "python"))
    
    # Actually run as node script instead
    print("ERROR: must run via node")
