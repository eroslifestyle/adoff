const { chromium } = require('playwright');

const EXT_PATH = "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/build-chrome";
const TARGET_URL = "https://www.siracusanews.it/";

const AD_SELECTORS = [
  ".ad", "[class*='ad-']", "[class*='_ad']", "[class*='Ad ']", "[class*='advert']",
  "iframe[src*='ads']", "iframe[src*='doubleclick']", "iframe[src*='googlesyndication']",
  "div[id*='gpt']", "div[id*='gads']", "[id*='google_ads']",
  "[class*='banner']", "[class*='pubblicita']", "[class*='sponsor']",
  "[data-ad]", "[data-ad-slot]", "[data-google-query-id']",
  "ins.adsbygoogle", ".adsbygoogle", "[id*='div-gpt-ad']",
  "[id*='ad-container']", "[class*='ad-container']", "[id*='adslot']",
  "a[href*='click']", "a[href*='redirect']",
];

const AD_NETWORK_PATTERNS = [
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
  "zilla", "serving-sys", "2mdn",
  "tidint", "trc", "c三元", "serving-sys",
  "adsrv", "adtech", "adnxs", "casalemedia",
  "pubmatic", "rubiconproject", "openx",
  "bidswitch", "spotxchange", "smartadserver",
  "criteo", "taboola", "outbrain", "teads",
  "amazon-adsystem", "aax", "connectad",
];

function classifyUrl(url) {
  const u = url.toLowerCase();
  for (const p of AD_NETWORK_PATTERNS) {
    if (u.includes(p)) return ("AD_NETWORK:" + p);
  }
  return "CLEAN";
}

async function main() {
  const results = {
    url: TARGET_URL,
    page_loaded: false,
    http_status: null,
    console_errors: [],
    ad_elements: [],
    network_requests: [],
    blocked_ad_requests: [],
    not_blocked_ad_requests: [],
    screenshot_path: "/tmp/siracusanews.png",
  };

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });

  const allPages = await context.pages();
  const page = allPages[0] || await context.newPage();

  const consoleErrors = [];
  const allRequests = [];
  const allResponses = {};

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('request', req => {
    allRequests.push(req.url());
  });

  page.on('response', res => {
    allResponses[res.url()] = res.status();
  });

  try {
    const response = await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    results.page_loaded = true;
    results.http_status = response ? response.status() : null;
  } catch (e) {
    results.page_load_error = e.message;
    await context.close();
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Wait for ads to load
  await page.waitForTimeout(5000);

  // Scan for ad elements
  for (const selector of AD_SELECTORS) {
    try {
      const els = await page.$$(selector);
      for (const el of els) {
        const bbox = await el.boundingBox();
        if (!bbox || bbox.width < 50 || bbox.height < 20) continue;
        const tag = await el.evaluate(e => e.tagName);
        const cls = await el.evaluate(e => e.className);
        const text = await el.evaluate(e => e.innerText?.substring(0, 100) || '');
        const src = await el.evaluate(e => e.src || e.getAttribute('src') || e.getAttribute('data-src') || '');
        const href = await el.evaluate(e => e.href || e.getAttribute('href') || '');
        const style = await el.evaluate(e => {
          const s = window.getComputedStyle(e);
          return `${s.display}|${s.visibility}|${s.opacity}|${s.width}|${s.height}`;
        });
        results.ad_elements.push({
          selector, tag, class: String(cls), text, src: src.substring(0, 300),
          href: href.substring(0, 200), bbox, style
        });
      }
    } catch (_) {}
  }

  // Deduplicate by bbox position
  const seen = new Set();
  const uniqueAds = [];
  for (const ad of results.ad_elements) {
    const key = `${Math.round(ad.bbox.x)},${Math.round(ad.bbox.y)},${Math.round(ad.bbox.width)},${Math.round(ad.bbox.height)}`;
    if (!seen.has(key)) { seen.add(key); uniqueAds.push(ad); }
  }
  results.ad_elements = uniqueAds;

  // Classify network requests
  const adRequests = [];
  const cleanRequests = [];
  for (const url of allRequests) {
    const classification = classifyUrl(url);
    const status = allResponses[url] || '?';
    if (classification !== "CLEAN") {
      adRequests.push({ url: url.substring(0, 400), pattern: classification, status });
    } else {
      cleanRequests.push(url.substring(0, 200));
    }
  }

  results.network_requests = adRequests;
  results.clean_request_count = cleanRequests.length;
  results.total_requests = allRequests.length;
  results.console_errors = consoleErrors;

  // Take screenshot
  try {
    await page.screenshot({ path: "/tmp/siracusanews.png", fullPage: true });
  } catch (e) {
    results.screenshot_error = e.message;
  }

  await context.close();

  // Print full JSON
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
