/**
 * Upload rules feed to Cloudflare KV
 * Usage: node upload-rules-kv.js
 */
const fs = require('fs');
const zlib = require('zlib');
const https = require('https');

const RULES_FILE = './filter-lists/adoff-rule-feed-compact.json.gz';
const WORKER_URL = 'https://adoff.workers.dev'; // Update with actual worker URL

async function uploadRules() {
  // Read gzipped rules
  const gzipped = fs.readFileSync(RULES_FILE);
  console.log(`Loaded: ${(gzipped.length/1024).toFixed(1)} KB gzipped`);

  // For direct KV upload, we need wrangler or API
  console.log('Options:');
  console.log('1. wrangler kv:bulk put (requires JSON manifest)');
  console.log('2. Upload to R2 bucket, serve from there');
  console.log('3. Embed in worker (for smaller sets)');
  console.log('');
  console.log('Current: using fallback rules in worker (10 core domains)');
  console.log('To update: run this after generating larger ruleset');
}

uploadRules().catch(console.error);
