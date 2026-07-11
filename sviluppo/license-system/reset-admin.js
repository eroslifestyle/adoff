#!/usr/bin/env node
/**
 * Reset admin account in KV
 * Legge ADMIN_TOKEN, calcola PBKDF2 hash, scrive admin:account in KV
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Read ADMIN_TOKEN from secrets
const secrets = readFileSync('/home/mrxxx/.secrets/adoff-stores.env', 'utf8');
const tokenMatch = secrets.match(/ADMIN_TOKEN="([^"]+)"/);
if (!tokenMatch) {
  console.error('ADMIN_TOKEN not found in secrets');
  process.exit(1);
}
const ADMIN_TOKEN = tokenMatch[1];
console.log('ADMIN_TOKEN loaded:', ADMIN_TOKEN.substring(0, 8) + '...');

// PBKDF2 parameters (same as worker.js)
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

// Generate random salt
const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
console.log('Salt generated');

// Calculate PBKDF2 hash using Web Crypto API
async function hashPasswordPBKDF2(password, salt, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return 'pbkdf2$' + iterations + '$' + hex;
}

const passwordHash = await hashPasswordPBKDF2(ADMIN_TOKEN, saltHex, PBKDF2_ITERATIONS);
console.log('PBKDF2 hash calculated');

// Build admin object
const adminAccount = {
  username: 'admin',
  passwordHash,
  salt: saltHex,
  email: '',
  createdAt: Date.now(),
};

console.log('\nAdmin account to write:', JSON.stringify(adminAccount, null, 2));

// First delete existing record
console.log('\nDeleting existing admin:account...');
try {
  execSync('wrangler kv key delete "admin:account" --binding ADOFF_LICENSES', { stdio: 'inherit' });
  console.log('Deleted existing record');
} catch (e) {
  console.log('No existing record or deletion failed, continuing');
}

// Write new record
console.log('\nWriting new admin:account...');
const kvValue = JSON.stringify(adminAccount);
execSync('wrangler kv key put "admin:account" \'' + kvValue.replace(/'/g, "'\\''") + '\' --binding ADOFF_LICENSES', { stdio: 'inherit' });
console.log('Admin account written to KV');

// Verify
console.log('\nVerifying...');
try {
  const result = execSync('wrangler kv key get "admin:account" --binding ADOFF_LICENSES', { encoding: 'utf8' });
  const parsed = JSON.parse(result);
  console.log('Admin account verified:');
  console.log('  username:', parsed.username);
  console.log('  passwordHash format:', parsed.passwordHash.substring(0, 20) + '...');
} catch (e) {
  console.log('WARNING: Could not verify (KV might be rate-limited)');
}

console.log('\nReset complete!');
console.log('\nLogin at https://adoff.app/admin with:');
console.log('  Username: admin');
console.log('  Password: (your ADMIN_TOKEN)');
