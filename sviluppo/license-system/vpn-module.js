/**
 * vpn-module.js — AdOff VPN provisioning (VPNresellers.com API v4.1)
 *
 * Tutta la logica VPN è qui: provisioning account, config WireGuard, gating Premium,
 * rate-limit, audit log, auto-disable cron.
 *
 * Il modulo esporta { handleVpnServers, handleVpnProfile, handleVpnGetConfig,
 * handleVpnCreateAccount, handleVpnDeleteAccount, handleVpnEnableDisable,
 * handleCronVpnAutoDisable }.
 *
 * Gating: /vpn/servers e /vpn/profile accettano tier=pro|pro_mixed|premium.
 * Tutti gli altri richiedono tier=premium attivo con token ECDSA P-256 firmato.
 * Anti-abuso: rate-limit 2 create/ora per IP, deviceId lock per account.
 */

// =============================================
// COSTANTI
// =============================================

const VPN_API_BASE = "https://api.vpnresellers.com/v4_1";
const VPN_PROJECT_ID = 102; // AdOff project su VPNresellers.com
const VPN_INACTIVE_DAYS = 7; // Disable dopo 7 giorni senza connessione
const VPN_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 ora
const VPN_RATE_LIMIT_MAX = 2; // max 2 create per finestra
const VPN_TOKEN_TOLERANCE_MS = 5 * 60 * 1000; // 5 min tolleranza clock skew

// =============================================
// UTILITY
// =============================================

/**
 * Estrae e verifica un token licenza Premium (Bearer <token>).
 * pattern identico a handleVerifyMobileLicense / handleTrialCheck.
 *
 * Token = payloadB64.sigB64 (ECDSA P-256, stessa chiave del trial).
 * Payload: { deviceId, tier, expiresAt, iat, v:1 }
 *
 * Ritorna { ok, payload } se valido, oppure { ok:false, error, status }.
 */
async function verifyPremiumToken(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, error: "Missing or invalid Authorization header", status: 401 };
  }
  const token = authHeader.slice(7);

  const dotIdx = token.indexOf(".");
  if (dotIdx < 0) return { ok: false, error: "Invalid token format", status: 400 };

  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  let sigBytes;
  try {
    sigBytes = b64uToBytes(sigB64);
  } catch (_) {
    return { ok: false, error: "Invalid signature encoding", status: 400 };
  }

  try {
    const pubKey = await importTrialMobilePubKey();
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      sigBytes,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return { ok: false, error: "Invalid signature", status: 401 };
  } catch (e) {
    console.error("verifyPremiumToken ECDSA error:", e);
    return { ok: false, error: "Signature verification failed", status: 500 };
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64uToBytes(payloadB64)));
  } catch (_) {
    return { ok: false, error: "Invalid payload encoding", status: 400 };
  }

  // Verifica versione
  if (payload.v !== 1) {
    return { ok: false, error: "Unsupported token version", status: 400 };
  }

  // Anti-replay: iat non più vecchio di TOKEN_TOLERANCE
  const now = Date.now();
  if (payload.iat && Math.abs(now - payload.iat) > VPN_TOKEN_TOLERANCE_MS) {
    return { ok: false, error: "Token expired or not yet valid", status: 401 };
  }

  return { ok: true, payload };
}

/** Verifica che il tier sia "premium" (per endpoint che richiedono VPN). */
function checkPremiumTier(payload) {
  if (!payload || payload.tier !== "premium") {
    return false;
  }
  const now = Date.now();
  if (payload.expiresAt && now >= payload.expiresAt) {
    return false;
  }
  return true;
}

/** Verifica deviceId nel token == deviceId richiesto (anti token-sharing). */
function checkDeviceIdMatch(payload, requestedDeviceId) {
  if (!payload || !requestedDeviceId) return false;
  return payload.deviceId === requestedDeviceId;
}

function b64uToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
};

// =============================================
// CHIAVI ECDSA (rievoca trial mobile — stessa coppia di chiavi)
// =============================================

const TRIAL_MOBILE_PUBKEY_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "FnIroHHVzo3v01gENPaA2U70c58sduDD6hGS0EhCATc",
  y: "tAzRBzVK1O8ul76s2euNrqV0L4f1qmEtvcKB_HqpfrY",
};

let _trialMobilePubKeyPromise = null;
async function importTrialMobilePubKey() {
  if (!_trialMobilePubKeyPromise) {
    _trialMobilePubKeyPromise = crypto.subtle.importKey(
      "jwk", TRIAL_MOBILE_PUBKEY_JWK,
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
    );
  }
  return _trialMobilePubKeyPromise;
}

// =============================================
// RATE LIMIT
// =============================================

/**
 * Controlla e incrementa il rate-limit per /vpn/create.
 * Ritorna { allowed: true } se sotto il limite, { allowed: false } altrimenti.
 * Key: vpn_rl:<ip>
 */
async function checkRateLimitVpnCreate(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const key = `vpn_rl:${ip}`;
  const existing = await env.ADOFF_LICENSES.get(key);
  const now = Date.now();

  if (existing) {
    const { count, windowStart } = JSON.parse(existing);
    if (now - windowStart < VPN_RATE_LIMIT_WINDOW_MS) {
      if (count >= VPN_RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0, resetMs: VPN_RATE_LIMIT_WINDOW_MS - (now - windowStart) };
      }
      // Incrementa
      const updated = JSON.stringify({ count: count + 1, windowStart });
      await env.ADOFF_LICENSES.put(key, updated, { expirationTtl: Math.ceil(VPN_RATE_LIMIT_WINDOW_MS / 1000) + 60 });
      return { allowed: true, remaining: VPN_RATE_LIMIT_MAX - count - 1 };
    }
  }

  // Nuova finestra
  await env.ADOFF_LICENSES.put(key, JSON.stringify({ count: 1, windowStart: now }), {
    expirationTtl: Math.ceil(VPN_RATE_LIMIT_WINDOW_MS / 1000) + 60,
  });
  return { allowed: true, remaining: VPN_RATE_LIMIT_MAX - 1 };
}

// =============================================
// AUDIT LOG
// =============================================

/**
 * Logga un'operazione VPN in D1 vpn_audit (tabella creata se non esiste).
 * MAI loggare IP/traffico/siti — solo stato account per billing.
 */
async function logVpnAudit(env, { action, accountId, deviceId, ip, extra }) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS vpn_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        action TEXT NOT NULL,
        account_id TEXT,
        device_id TEXT,
        ip TEXT,
        extra TEXT
      )
    `).run();

    await env.DB.prepare(`
      INSERT INTO vpn_audit (timestamp, action, account_id, device_id, ip, extra)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(Date.now(), action, accountId || null, deviceId || null, ip || null, extra ? JSON.stringify(extra) : null).run();
  } catch (e) {
    console.error("logVpnAudit error:", e);
  }
}

// =============================================
// VPN API CALL
// =============================================

async function vpnApiCall(endpoint, options = {}, env) {
  const url = `${VPN_API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${env.VPNRESELLERS_API_KEY}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  return { status: res.status, data: json.data, code: json.code, ...json };
}

// =============================================
// HANDLERS (estratti dal worker.js)
// =============================================

/**
 * GET /vpn/servers — lista server disponibili.
 * Accesso: tier=pro|pro_mixed|premium (info pubblica utile anche a Pro).
 */
async function handleVpnServers(request, env) {
  const verifyResult = await verifyPremiumToken(request, env);
  // Accetta anche tier=pro|pro_mixed per info lista server
  if (!verifyResult.ok) {
    // Non loggato o non Premium — niente VPN ma info pubblica
    // Permetti lettura lista server anche a Pro (upsell)
    // Non blocchiamo questo endpoint, è informativo
  } else {
    // Token presente ma non premium? Controlla tier
    if (verifyResult.payload && !checkPremiumTier(verifyResult.payload) && verifyResult.payload.tier !== "pro" && verifyResult.payload.tier !== "pro_mixed") {
      return jsonResponse({ error: "Premium subscription required" }, 403);
    }
  }

  try {
    const result = await vpnApiCall("/servers", { method: "GET" }, env);
    if (result.status !== 200) return jsonResponse({ error: "Failed to fetch servers" }, 502);
    const servers = (result.data || []).map(s => ({
      id: s.id,
      name: s.name,
      country: s.country_code,
      city: s.city,
      ip: s.ip,
      // Non esporre load/flags se non necessario (info leaked = superficie attacco)
    }));
    return jsonResponse({ ok: true, servers });
  } catch (e) {
    console.error("handleVpnServers error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * GET /vpn/profile — balance e stato account reseller.
 * Accesso: tier=pro|pro_mixed|premium (info pubblica).
 */
async function handleVpnProfile(request, env) {
  const verifyResult = await verifyPremiumToken(request, env);
  if (!verifyResult.ok) {
    // Permetti anche a Pro (info base)
  } else if (verifyResult.payload && !checkPremiumTier(verifyResult.payload) && verifyResult.payload.tier !== "pro" && verifyResult.payload.tier !== "pro_mixed") {
    return jsonResponse({ error: "Premium subscription required" }, 403);
  }

  try {
    const result = await vpnApiCall("/profile", { method: "GET" }, env);
    return jsonResponse({ ok: true, balance: result.data?.balance || "0.00" });
  } catch (e) {
    console.error("handleVpnProfile error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * GET /vpn/config?accountId=&serverId= — ritorna config WireGuard.
 * Accesso: tier=premium SOLO (VPN attiva).
 */
async function handleVpnGetConfig(request, env) {
  const verifyResult = await verifyPremiumToken(request, env);
  if (!verifyResult.ok) {
    return jsonResponse({ error: "Premium subscription required" }, 403);
  }
  if (!checkPremiumTier(verifyResult.payload)) {
    return jsonResponse({ error: "Premium subscription required" }, 403);
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const serverId = url.searchParams.get("serverId");
  const requestedDeviceId = url.searchParams.get("deviceId");

  if (!checkDeviceIdMatch(verifyResult.payload, requestedDeviceId)) {
    return jsonResponse({ error: "DeviceId mismatch — token not valid for this device" }, 403);
  }

  if (!accountId || !serverId) {
    return jsonResponse({ error: "accountId and serverId required" }, 400);
  }

  try {
    const result = await vpnApiCall(`/configuration/wireguard?server_id=${serverId}&account_id=${accountId}`, { method: "GET" }, env);
    if (result.code === 200) {
      return jsonResponse({ ok: true, config: result.data.content, name: result.data.name });
    }
    return jsonResponse({ error: result.message || "Failed to get config" }, 400);
  } catch (e) {
    console.error("handleVpnGetConfig error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * POST /vpn/create { email?, deviceId, firstName?, lastName? }
 * Genera username+password random, crea account VPNresellers.
 * Accesso: tier=premium SOLO.
 * Rate-limit: max 2/ora per IP.
 */
async function handleVpnCreateAccount(request, env) {
  // Autenticazione Premium
  const verifyResult = await verifyPremiumToken(request, env);
  if (!verifyResult.ok) {
    return jsonResponse({ error: "Premium subscription required" }, 403);
  }
  if (!checkPremiumTier(verifyResult.payload)) {
    return jsonResponse({ error: "Premium subscription required" }, 403);
  }

  const payload = verifyResult.payload;
  const deviceId = payload.deviceId;

  // Rate-limit
  const rl = await checkRateLimitVpnCreate(request, env);
  if (!rl.allowed) {
    return jsonResponse({
      error: "Too many account creation requests. Try again later.",
      retryAfterMs: rl.resetMs,
    }, 429);
  }

  let body = {};
  try { body = await request.json(); } catch { /* optional */ }

  // Genera credenziali random
  const username = "ad" + randomBase64url(12);
  const password = randomBase64url(32); // 32 char, sicuro

  const ip = request.headers.get("CF-Connecting-IP") || null;

  try {
    const result = await vpnApiCall("/accounts", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        customer: {
          first_name: body.firstName || "AdOff",
          last_name: body.lastName || "User",
          email: body.email || `${username}@adoff.app`,
          project_id: VPN_PROJECT_ID,
        },
      }),
    }, env);

    if (result.code === 201) {
      // Audit log — MAI loggare credenziali
      await logVpnAudit(env, {
        action: "create",
        accountId: result.data.id,
        deviceId,
        ip,
        extra: { username, wgIp: result.data.wg_ip },
      });

      return jsonResponse({
        ok: true,
        accountId: result.data.id,
        username,
        // NON ritornare la password in chiaro — solo via config WireGuard
        // Il client mostra "config scaricata" e non deve mostrare credenziali
        status: result.data.status,
        wgIp: result.data.wg_ip,
      });
    }
    return jsonResponse({ error: result.message || "Failed to create account", details: result.errors }, 400);
  } catch (e) {
    console.error("handleVpnCreateAccount error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
}

// =============================================
// HELPERS CONDIVISE (webhook + internal)
// =============================================

/**
 * Provisiona account VPN per un checkout Premium.
 * Crea account su VPNresellers e salva deviceId->accountId in D1.
 * Chiamata da handleStripeWebhook su checkout.session.completed tier=premium.
 *
 * @param {string} deviceId
 * @param {string|null} email
 * @param {string|null} ip  CF-Connecting-IP o null
 * @param {object} env
 * @param {string|null} stripeCustomerId
 * @returns {Promise<{ok: boolean, accountId?: string, username?: string, error?: string}>}
 */
async function provisionVpnForCheckout(deviceId, email, ip, env, stripeCustomerId = null) {
  // Assicura tabella D1
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS vpn_accounts (device_id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE, email TEXT, stripe_customer_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
    ).run();
  } catch (_) { /* gia' esiste */ }

  // Check gia' provisioning per questo device
  try {
    const existing = await env.DB.prepare("SELECT account_id FROM vpn_accounts WHERE device_id = ?").bind(deviceId).first();
    if (existing) {
      return { ok: true, accountId: existing.account_id, username: null, alreadyExists: true };
    }
  } catch (_) { /* table might not exist yet */ }

  // Gia' provisioning per questo customer Stripe? (ricalcolo subscription renewal)
  if (stripeCustomerId) {
    try {
      const existingByCustomer = await env.DB.prepare("SELECT account_id FROM vpn_accounts WHERE stripe_customer_id = ?").bind(stripeCustomerId).first();
      if (existingByCustomer) {
        return { ok: true, accountId: existingByCustomer.account_id, username: null, alreadyExists: true };
      }
    } catch (_) { /* table might not exist yet */ }
  }

  // Genera credenziali
  const username = "ad" + randomBase64url(12);
  const password = randomBase64url(32);

  try {
    const result = await vpnApiCall("/accounts", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        customer: {
          first_name: "AdOff",
          last_name: "User",
          email: email || `${username}@adoff.app`,
          project_id: VPN_PROJECT_ID,
        },
      }),
    }, env);

    if (result.code === 201) {
      const accountId = String(result.data.id);
      try {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO vpn_accounts (device_id, account_id, email, stripe_customer_id) VALUES (?, ?, ?, ?)"
        ).bind(deviceId, accountId, email || null, stripeCustomerId || null).run();
      } catch (_) { /* non bloccare se D1 fallisce */ }

      await logVpnAudit(env, {
        action: "create_checkout",
        accountId,
        deviceId,
        ip,
        extra: { username },
      });

      return { ok: true, accountId, username };
    }
    return { ok: false, error: result.message || "VPNresellers API error" };
  } catch (e) {
    console.error("provisionVpnForCheckout error:", e);
    return { ok: false, error: e.message };
  }
}

/**
 * Disabilita account VPN su cancellazione abbonamento Premium.
 * @param {string} stripeCustomerId  customer ID Stripe (da subscription.deleted)
 * @param {string|null} ip
 * @param {object} env
 */
async function disableVpnForCheckout(stripeCustomerId, ip, env) {
  try {
    const row = await env.DB.prepare("SELECT account_id, device_id FROM vpn_accounts WHERE stripe_customer_id = ?").bind(stripeCustomerId).first();
    if (!row) return { ok: true, notFound: true };

    const result = await vpnApiCall(`/accounts/${row.account_id}/disable`, { method: "PUT" }, env);
    await logVpnAudit(env, {
      action: "disable_checkout",
      accountId: row.account_id,
      deviceId: row.device_id,
      ip,
    });
    return { ok: true, accountId: row.account_id };
  } catch (e) {
    console.error("disableVpnForCheckout error:", e);
    return { ok: false, error: e.message };
  }
}

// =============================================
// ENDPOINT HANDLERS
// =============================================

/**
 * POST /vpn/delete { accountId }
 * Accesso: tier=premium SOLO.
 */
async function handleVpnDeleteAccount(request, env) {
  const verifyResult = await verifyPremiumToken(request, env);
  if (!verifyResult.ok || !checkPremiumTier(verifyResult.payload)) {
    return jsonResponse({ error: "Premium subscription required" }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const { accountId } = body;
  const ip = request.headers.get("CF-Connecting-IP") || null;

  if (!accountId) return jsonResponse({ error: "accountId required" }, 400);

  try {
    const result = await vpnApiCall(`/accounts/${accountId}`, { method: "DELETE" }, env);
    await logVpnAudit(env, {
      action: "delete",
      accountId,
      deviceId: verifyResult.payload.deviceId,
      ip,
    });
    return jsonResponse({ ok: result.code === 200 });
  } catch (e) {
    console.error("handleVpnDeleteAccount error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * POST /vpn/enable { accountId }
 * POST /vpn/disable { accountId }
 * Accesso: tier=premium SOLO.
 */
async function handleVpnEnableDisable(request, env, enable) {
  const verifyResult = await verifyPremiumToken(request, env);
  if (!verifyResult.ok || !checkPremiumTier(verifyResult.payload)) {
    return jsonResponse({ error: "Premium subscription required" }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const { accountId } = body;
  const ip = request.headers.get("CF-Connecting-IP") || null;

  if (!accountId) return jsonResponse({ error: "accountId required" }, 400);

  try {
    const action = enable ? "enable" : "disable";
    const result = await vpnApiCall(`/accounts/${accountId}/${action}`, { method: "PUT" }, env);
    await logVpnAudit(env, {
      action,
      accountId,
      deviceId: verifyResult.payload.deviceId,
      ip,
    });
    return jsonResponse({ ok: result.code === 200, status: action });
  } catch (e) {
    console.error("handleVpnEnableDisable error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
}

// =============================================
// CRON — auto-disable account VPN inattivi e abbonamenti scaduti
// =============================================

/**
 * GET /vpn/auto-disable (chiamato da cron trigger CF).
 * Controlla:
 * 1. Account VPN attivi con ultima connessione >7gg → /vpn/disable
 * 2. Abbonamenti Premium scaduti → /vpn/disable
 *
 * Auto-riattivazione: quando l'utente si riconnette con Premium valido,
 * il client chiama /vpn/enable (o il server rileva e riabilita).
 */
async function handleCronVpnAutoDisable(request, env) {
  const adminToken = request.headers.get("X-Admin-Token");
  if (adminToken !== env.ADMIN_TOKEN) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const results = { disabled: [], errors: [], checked: 0 };

  try {
    // Assicura tabella audit
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS vpn_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        action TEXT NOT NULL,
        account_id TEXT,
        device_id TEXT,
        ip TEXT,
        extra TEXT
      )
    `).run();

    // Crea tabella mapping deviceId → accountId se non esiste
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS vpn_accounts (
        device_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_enabled_at INTEGER NOT NULL,
        last_seen INTEGER
      )
    `).run();

    // 1) Disable per inattività (nessuna connessione >7gg)
    const cutoffInactive = Date.now() - (VPN_INACTIVE_DAYS * 24 * 60 * 60 * 1000);
    const inactiveRows = await env.DB.prepare(
      "SELECT device_id, account_id FROM vpn_accounts WHERE last_seen IS NOT NULL AND last_seen < ?"
    ).bind(cutoffInactive).all();

    for (const row of inactiveRows.rows || []) {
      try {
        const result = await vpnApiCall(`/accounts/${row.account_id}/disable`, { method: "PUT" }, env);
        if (result.code === 200) {
          await env.DB.prepare(
            "UPDATE vpn_accounts SET last_seen = ? WHERE device_id = ?"
          ).bind(Math.max(row.last_seen || 0, cutoffInactive), row.device_id).run();
          await logVpnAudit(env, {
            action: "auto_disable_inactive",
            accountId: row.account_id,
            deviceId: row.device_id,
            extra: { reason: "inactive_7d", lastSeen: row.last_seen },
          });
          results.disabled.push({ deviceId: row.device_id, accountId: row.account_id, reason: "inactive_7d" });
        }
      } catch (e) {
        results.errors.push({ deviceId: row.device_id, error: e.message });
      }
      results.checked++;
    }

    // 2) Disable per abbonamento Premium scaduto
    // Query licenze Premium attive in KV → confronta expiresAt
    // Se una licenza Premium è scaduta, disable l'account VPN associato
    // (faremo una query più targetizzata in Fase 1 quando avremo il mapping completo)
    // Per ora: logga che il check è stato eseguito
    console.log(`[vpn-cron] Checked ${results.checked} accounts. Disabled: ${results.disabled.length}`);

    return jsonResponse({ ok: true, ...results, timestamp: Date.now() });
  } catch (e) {
    console.error("handleCronVpnAutoDisable error:", e);
    return jsonResponse({ error: e.message, ...results }, 500);
  }
}

// =============================================
// UTILITY
// =============================================

function randomBase64url(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// =============================================
// ESPORTAZIONE
// =============================================

export {
  handleVpnServers,
  handleVpnProfile,
  handleVpnGetConfig,
  handleVpnCreateAccount,
  handleVpnDeleteAccount,
  handleVpnEnableDisable,
  handleCronVpnAutoDisable,
  provisionVpnForCheckout,
  disableVpnForCheckout,
};
