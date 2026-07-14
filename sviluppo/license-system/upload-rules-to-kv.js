#!/usr/bin/env node
/**
 * Upload rules to Cloudflare KV
 * Usage: node upload-rules-to-kv.js
 */
const fs = require('fs');
const zlib = require('zlib');
const https = require('https');

const RULES_FILE = '../filter-lists/rules-feed.json.gz';
const WORKER_URL = 'https://adoff.workers.dev';

// Read gzipped rules
const gzipped = fs.readFileSync(RULES_FILE);
console.log(`Loaded: ${(gzipped.length/1024).toFixed(1)} KB gzipped`);

// Compute ETag
const crypto = require('crypto');
const etag = crypto.createHash('sha256').update(gzipped).digest('hex').slice(0, 16);
console.log(`ETag: ${etag}`);

// For now, rules are served from site CDN (adoff.app/rules-feed.json)
// KV upload would require wrangler CLI or API
console.log('\nRules served from: https://adoff.app/rules-feed.json');
console.log('To upload to KV: wrangler kv:bulk put --binding=ADOFF_LICENSES');
