#!/usr/bin/env node
/**
 * Ad Network Auto-Detector
 * Scansiona siti web per identificare nuovi ad-networks non bloccati
 * Usa Playwright per headless browsing + network monitoring
 */

const { chromium } = require('playwright');

const AD_SIGNALS = [
  // Common ad-related strings
  'googlesyndication', 'doubleclick', 'googleadservices',
  'adnxs', 'criteo', 'taboola', 'outbrain', 'moatads',
  'amazon-adsystem', 'adsrvr', 'adform', 'pubmatic',
  'rubiconproject', 'openx', 'smartadserver', 'casale-media',
  'advertising.com', 'yieldmo', 'sharethrough', 'mediavine',
  'e-planning', 'gumgum', 'spotxchange', 'undertone',
  // New networks
  'ad.doubleclick', 'ads.yahoo', 'adtech', 'advertising',
  'adservice', 'pagead', 'afs.google', 'partner-google',
  // Video ads
  'ima3', 'imasdk', 'video-ads', 'vast', 'vm5',
];

const BLOCKED_DOMAINS = new Set([
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adnxs.com', 'criteo.com', 'taboola.com', 'outbrain.com',
  'moatads.com', 'amazon-adsystem.com', 'adsrvr.org',
]);

const TARGET_SITES = [
  'https://www.example.com',
  'https://news.ycombinator.com',
  'https://reddit.com',
  'https://wikipedia.org',
  'https://amazon.com',
  'https://ebay.com',
];

async function detectAdNetworks(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const foundDomains = new Set();
  const blockedRequests = [];
  
  // Monitor all network requests
  page.on('request', request => {
    const url = request.url();
    const domain = new URL(url).hostname;
    
    // Check if it's an ad-related domain
    const isAdDomain = AD_SIGNALS.some(s => domain.includes(s));
    
    if (isAdDomain) {
      foundDomains.add(domain);
    }
  });
  
  // Also check page content for ad iframes
  page.on('framenavigated', frame => {
    try {
      const url = frame.url();
      if (url && url.startsWith('http')) {
        const domain = new URL(url).hostname;
        const isAdDomain = AD_SIGNALS.some(s => domain.includes(s));
        if (isAdDomain) {
          foundDomains.add(domain);
        }
      }
    } catch (_) {}
  });
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    // Wait a bit for lazy-loaded ads
    await page.waitForTimeout(3000);
  } catch (_) {}
  
  await browser.close();
  
  return {
    url,
    domains: [...foundDomains],
    unblocked: foundDomains.difference ? 
      [...foundDomains].filter(d => !BLOCKED_DOMAINS.has(d)) : [],
  };
}

async function main() {
  console.log('=== Ad Network Auto-Detector ===\n');
  
  const results = [];
  
  for (const site of TARGET_SITES) {
    console.log(`Scanning: ${site}`);
    try {
      const result = await detectAdNetworks(site);
      results.push(result);
      console.log(`  Found: ${result.domains.length} ad domains`);
      if (result.unblocked.length > 0) {
        console.log(`  UNBLOCKED: ${result.unblocked.join(', ')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Generate rules
  console.log('\n=== New Rules to Add ===\n');
  const newDomains = new Set();
  
  for (const r of results) {
    for (const d of r.unblocked) {
      newDomains.add(d);
    }
  }
  
  const rules = [...newDomains].map((d, i) => ({
    id: 90000 + i,
    action: { type: 'block' },
    condition: {
      urlFilter: `||${d.replace(/\./g, '\\.')}`,
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame']
    }
  }));
  
  console.log(JSON.stringify(rules, null, 2));
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('new-ad-rules.json', JSON.stringify(rules, null, 2));
  console.log(`\nSaved ${rules.length} rules to new-ad-rules.json`);
}

main().catch(console.error);
