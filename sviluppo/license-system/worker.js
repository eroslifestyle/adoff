/**
 * AdOff License API — Cloudflare Worker
 *
 * Deploy su Cloudflare Workers (free tier: 100K req/giorno)
 * Usa Cloudflare KV per storage licenze
 *
 * Endpoints:
 *   POST /validate    — valida una license key
 *   POST /activate    — attiva una key su un dispositivo
 *   POST /deactivate  — rimuovi un dispositivo
 *   POST /revoke      — revoca una licenza (admin)
 *   GET  /health      — health check
 *
 * Setup:
 *   1. Crea un Worker su Cloudflare Dashboard
 *   2. Crea un KV namespace "ADOFF_LICENSES"
 *   3. Bind il KV al Worker
 *   4. Setta la variabile SECRET: wrangler secret put ADOFF_SECRET
 *   5. Deploya: wrangler deploy
 */

// =============================================
// CONFIGURAZIONE
// =============================================

const CORS_ALLOWED_ORIGINS = [
  "https://adoff.app",
  "https://www.adoff.app",
  "chrome-extension://",
];

// Also allow any *.adoff-site.pages.dev (CF Pages preview deployments)
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (CORS_ALLOWED_ORIGINS.some(a => origin === a || origin.startsWith(a))) return true;
  if (/^https:\/\/[a-f0-9]+\.adoff-site\.pages\.dev$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(request) {
  const origin = request ? request.headers.get("Origin") || "" : "";
  const isAllowed = isAllowedOrigin(origin);
  const headers = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token, X-Account-Token",
  };
  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * KV get wrapper — gestisce il rate limit del namespace.
 * Se il limite giornaliero è superato, restituisce null invece di crashare.
 * @param {KVNamespace} kv - Il binding KV
 * @param {string} key - Chiave da leggere
 * @param {string|undefined} type - "json" per parsed, undefined per stringa
 * @returns {Promise<any|null>}
 */
async function kvGet(kv, key, type) {
  try {
    return await kv.get(key, type);
  } catch (e) {
    // KV rate limit exceeded per il giorno — ritorna null, non crashare il worker
    if (e.message && e.message.includes("limit exceeded")) {
      console.warn(`[kvGet] Rate limit exceeded for key "${key}"`);
      return null;
    }
    throw e; // altre eccezioni non gestite
  }
}

// Placeholder costante per contesti senza request (es. cron)
const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token, X-Account-Token",
};

const MAX_DEVICES = 3;
const RATE_LIMIT_MAX = 20;      // Max requests
const RATE_LIMIT_WINDOW = 60;   // Per 60 secondi
const ADMIN_TOKEN_HEADER = "X-Admin-Token";

// =============================================
// DATABASE D1 (AFFILIATI & REFERRAL)
// =============================================

async function getAffiliate(id, env) {
  if (!env.DB) return null;
  return await env.DB.prepare("SELECT * FROM affiliates WHERE id = ?").bind(id).first();
}

// Hasha il deviceId lato server per renderlo non-tracciabile dall'esterno.
// Non è reversibile senza conoscere la chiave, quindi non espone l'identità reale.
async function hashDeviceId(deviceId, env) {
  const secret = env.ADOFF_SECRET || "default-salt-adoff-v1";
  const data = new TextEncoder().encode(secret + ":" + deviceId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}



// =============================================
// EMAIL (Resend API)
// =============================================

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailTemplate(title, body, ctaText, ctaUrl) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media(prefers-color-scheme:dark){.email-bg{background:#0a0a1a!important}.email-card{background:#12122a!important;border-color:#2a2a4a!important}.email-title{color:#fff!important}.email-body,.email-body p,.email-body li,.email-body td{color:#c0c0d0!important}.email-footer p,.email-footer a{color:#8a8aaa!important}}</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7" class="email-bg"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:24px">
    <span style="font-size:28px;font-weight:800;color:#1a1a2e">Ad<span style="color:#7c5cfc">Off</span></span>
  </td></tr>
  <!-- Card -->
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5ea;border-radius:16px" class="email-card">
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e" class="email-title">${title}</h1>
        <div style="color:#444;font-size:15px;line-height:1.7" class="email-body">${body}</div>
        ${ctaText && ctaUrl ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:28px">
          <a href="${ctaUrl}" style="display:inline-block;background:#7c5cfc;color:#ffffff;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;mso-padding-alt:0" target="_blank">
            <!--[if mso]><i style="mso-font-width:350%;mso-text-raise:21pt">&nbsp;</i><![endif]-->
            <span style="mso-text-raise:10pt">${ctaText}</span>
            <!--[if mso]><i style="mso-font-width:350%">&nbsp;</i><![endif]-->
          </a>
        </td></tr></table>` : ''}
      </td></tr>
    </table>
  </td></tr>
  <!-- Footer -->
  <tr><td align="center" style="padding-top:24px" class="email-footer">
    <p style="color:#999;font-size:12px;margin:0 0 6px">AdOff — Ads? Off! | <a href="https://adoff.app" style="color:#7c5cfc;text-decoration:none">adoff.app</a></p>
    <p style="color:#999;font-size:12px;margin:0"><a href="https://adoff.app/support" style="color:#999;text-decoration:none">Supporto</a> &middot; <a href="https://adoff.app/privacy" style="color:#999;text-decoration:none">Privacy</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const EMAIL_TEMPLATES = {
  // --- ATTIVAZIONE ACCOUNT (dopo acquisto) ---
  account_activation(activateUrl, plan, devices) {
    const planNames = { monthly: "Mensile", annual: "Annuale", lifetime: "Lifetime" };
    const safePlan = escapeHtml(planNames[plan] || plan);
    const devLimit = devices || 3;
    return {
      subject: "Attiva il tuo account AdOff Pro!",
      html: emailTemplate(
        "Grazie per il tuo acquisto! 🎉",
        `<p>La tua licenza <strong>AdOff Pro ${safePlan}</strong> e' pronta.</p>
        <p>Clicca il bottone qui sotto per attivare il tuo account e impostare la password.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8f8fc;border-radius:8px;padding:16px">
          <tr><td style="color:#888;padding:8px 16px">Piano</td><td style="color:#1a1a2e;font-weight:600;text-align:right;padding:8px 16px">${safePlan}</td></tr>
          <tr><td style="color:#888;padding:8px 16px">Dispositivi</td><td style="color:#1a1a2e;font-weight:600;text-align:right;padding:8px 16px">${devLimit}</td></tr>
        </table>
        <p><strong>Dopo l'attivazione:</strong></p>
        <ol style="padding-left:20px">
          <li>Apri AdOff nel browser</li>
          <li>Vai nelle Opzioni → Piano &amp; Licenza</li>
          <li>Accedi con la tua email — la licenza e' gia' attiva!</li>
        </ol>
        <p style="color:#888;font-size:13px">Il link scade tra 24 ore. Se non hai effettuato tu questo acquisto, contattaci.</p>`,
        "Attiva il tuo Account",
        activateUrl
      ),
    };
  },

  // --- BENVENUTO (dopo primo acquisto) ---
  welcome(email, plan) {
    const safePlan = escapeHtml(plan || "Pro");
    return {
      subject: "Benvenuto in AdOff Pro! 👋",
      html: emailTemplate(
        "Benvenuto nella famiglia AdOff! 👋",
        `<p>Ciao! Grazie per aver scelto <strong>AdOff Pro ${safePlan}</strong>.</p>
        <p>Ecco cosa puoi fare con il tuo piano Pro:</p>
        <ul style="padding-left:20px;line-height:2">
          <li><strong>Stealth Mode</strong> — Invisibile ai sistemi anti-adblock</li>
          <li><strong>Video Ad Blocking</strong> — Zero ads sulle piattaforme video</li>
          <li><strong>Supporto prioritario</strong> — Risposte rapide dal nostro team</li>
          <li><strong>Gestione dispositivi</strong> — Controlla tutto dal tuo account online</li>
        </ul>
        <p>Se hai domande, siamo qui per te.</p>`,
        "Gestisci il tuo Account",
        "https://adoff.app/account"
      ),
    };
  },

  // --- SCADENZA REMINDER ---
  expiry_reminder(key, daysLeft, email) {
    const safeKey = escapeHtml(key);
    const d = parseInt(daysLeft);
    const urgency = d <= 1 ? "⚠️ " : "";
    return {
      subject: `${urgency}AdOff Pro: il tuo abbonamento scade tra ${d} giorn${d === 1 ? "o" : "i"}`,
      html: emailTemplate(
        `Il tuo abbonamento scade tra ${d} giorn${d === 1 ? "o" : "i"}`,
        `<p>La tua licenza AdOff Pro scadra' tra <strong>${d} giorn${d === 1 ? "o" : "i"}</strong>.</p>
        <div style="background:#fff0f0;border:1px solid #f43f5e;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
          <p style="color:#f43f5e;font-weight:700;margin:0">⏰ ${d === 1 ? "Ultimo giorno!" : d === 3 ? "Mancano solo 3 giorni" : "Scade tra una settimana"}</p>
        </div>
        <p>Dopo la scadenza perderai:</p>
        <ul style="padding-left:20px;color:#d44">
          <li>Stealth Mode (anti-detection)</li>
          <li>Video Ad Blocking avanzato</li>
          <li>Supporto prioritario</li>
        </ul>
        <p>Il blocco ads di base resta <strong>gratuito per sempre</strong>.</p>`,
        "Rinnova Adesso",
        "https://adoff.app/#pricing"
      ),
    };
  },

  // --- SCADUTO ---
  expired(key, email) {
    return {
      subject: "AdOff Pro: il tuo abbonamento e' scaduto",
      html: emailTemplate(
        "Il tuo abbonamento Pro e' scaduto 😔",
        `<p>Le funzionalita' Pro di AdOff sono state disabilitate.</p>
        <p>Il blocco ads di base continua a funzionare <strong>gratuitamente</strong>, ma hai perso:</p>
        <ul style="padding-left:20px;color:#d44">
          <li>Stealth Mode (anti-detection)</li>
          <li>Video Ad Blocking avanzato</li>
          <li>Supporto prioritario</li>
        </ul>
        <p>Rinnova per riattivare tutto immediatamente.</p>`,
        "Rinnova Pro",
        "https://adoff.app/#pricing"
      ),
    };
  },

  // --- PAGAMENTO FALLITO ---
  payment_failed(email) {
    return {
      subject: "⚠️ AdOff Pro: pagamento non riuscito",
      html: emailTemplate(
        "Pagamento non riuscito ⚠️",
        `<p>Il rinnovo del tuo abbonamento AdOff Pro non e' andato a buon fine.</p>
        <p><strong>Cosa fare:</strong></p>
        <ol style="padding-left:20px">
          <li>Verifica che la carta di credito sia valida</li>
          <li>Controlla che il saldo sia sufficiente</li>
          <li>Riprova il pagamento</li>
        </ol>
        <p>Se il problema persiste, la licenza verra' sospesa automaticamente.</p>
        <p style="color:#888;font-size:13px">Hai bisogno di aiuto? <a href="https://adoff.app/support" style="color:#7c5cfc">Contattaci</a></p>`,
        "Aggiorna Pagamento",
        "https://adoff.app/#pricing"
      ),
    };
  },

  // --- ABBONAMENTO CANCELLATO ---
  cancelled(email) {
    return {
      subject: "AdOff Pro: abbonamento cancellato",
      html: emailTemplate(
        "Abbonamento cancellato",
        `<p>Il tuo abbonamento AdOff Pro e' stato cancellato.</p>
        <p>La licenza restera' attiva fino alla <strong>data di scadenza gia' pagata</strong>. Dopo, tornerai al piano Free.</p>
        <p>Il blocco ads di base resta <strong>gratuito per sempre</strong>.</p>
        <p>Se cambi idea, puoi riabbonarti in qualsiasi momento con un click.</p>
        <p style="color:#888;font-size:13px">Ci manchi gia'. Se hai feedback, scrivici su <a href="https://adoff.app/support" style="color:#7c5cfc">adoff.app/support</a>.</p>`,
        "Torna Pro",
        "https://adoff.app/#pricing"
      ),
    };
  },

  // --- VERIFICA EMAIL ---
  verify_email(email, verifyUrl) {
    return {
      subject: "AdOff — Verifica la tua email",
      html: emailTemplate(
        "Verifica la tua email ✉️",
        `<p>Hai creato un account AdOff con questo indirizzo email.</p>
        <p>Clicca il bottone qui sotto per verificare il tuo indirizzo e attivare l'account.</p>
        <p style="color:#888;font-size:13px">Il link scade tra 24 ore. Se non hai richiesto tu questa registrazione, ignora questa email.</p>`,
        "Verifica Email",
        verifyUrl
      ),
    };
  },

  // --- RESET PASSWORD ---
  reset_password(email, resetUrl) {
    return {
      subject: "AdOff — Reimposta la tua password",
      html: emailTemplate(
        "Reimposta la tua password 🔐",
        `<p>Hai richiesto il reset della password per il tuo account AdOff.</p>
        <p>Clicca il bottone qui sotto per scegliere una nuova password.</p>
        <p style="color:#888;font-size:13px">Il link scade tra 1 ora. Se non hai richiesto tu questo reset, ignora questa email — la tua password resta invariata.</p>`,
        "Reimposta Password",
        resetUrl
      ),
    };
  },

  // --- PASSWORD CAMBIATA ---
  password_changed(email) {
    return {
      subject: "AdOff — Password modificata",
      html: emailTemplate(
        "Password modificata con successo ✅",
        `<p>La password del tuo account AdOff e' stata modificata.</p>
        <p>Se sei stato tu, non devi fare nulla.</p>
        <p style="color:#f43f5e"><strong>Se non sei stato tu</strong>, qualcuno potrebbe aver accesso al tuo account. Reimposta la password immediatamente.</p>`,
        "Reimposta Password",
        "https://adoff.app/account"
      ),
    };
  },

  // --- NUOVO DISPOSITIVO ---
  new_device(email, deviceName) {
    const safeName = escapeHtml(deviceName || "Dispositivo sconosciuto");
    return {
      subject: "AdOff — Nuovo dispositivo collegato",
      html: emailTemplate(
        "Nuovo dispositivo collegato 📱",
        `<p>La tua licenza AdOff Pro e' stata attivata su un nuovo dispositivo:</p>
        <div style="background:#f0ecff;border:1px solid #d0c8ff;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
          <p style="color:#7c5cfc;font-weight:700;font-size:16px;margin:0">${safeName}</p>
        </div>
        <p>Se sei stato tu, non devi fare nulla.</p>
        <p>Se <strong>non riconosci</strong> questo dispositivo, vai nel tuo account e rimuovilo subito.</p>`,
        "Gestisci Dispositivi",
        "https://adoff.app/account"
      ),
    };
  },

  // --- LIMITE DISPOSITIVI RAGGIUNTO ---
  device_limit(email, maxDevices) {
    return {
      subject: "AdOff — Limite dispositivi raggiunto",
      html: emailTemplate(
        "Limite dispositivi raggiunto ⚠️",
        `<p>Hai provato ad attivare AdOff Pro su un nuovo dispositivo, ma hai gia' raggiunto il limite di <strong>${maxDevices} dispositivi</strong>.</p>
        <p><strong>Cosa puoi fare:</strong></p>
        <ul style="padding-left:20px">
          <li>Vai nel tuo account e rimuovi un dispositivo che non usi piu'</li>
          <li>Oppure fai upgrade a un piano con piu' dispositivi</li>
        </ul>`,
        "Gestisci Dispositivi",
        "https://adoff.app/account"
      ),
    };
  },

  // --- TRIAL INIZIATO ---
  trial_started(email) {
    return {
      subject: "AdOff Pro — 30 giorni gratis! 🎁",
      html: emailTemplate(
        "Il tuo trial Pro e' iniziato! 🎁",
        `<p>Hai <strong>30 giorni gratuiti</strong> con tutte le funzionalita' Pro di AdOff:</p>
        <ul style="padding-left:20px;line-height:2">
          <li>✅ Stealth Mode — Invisibile ai sistemi anti-adblock</li>
          <li>✅ Video Ad Blocking — Zero pubblicita' nei video</li>
          <li>✅ Uso su piu' dispositivi personali</li>
          <li>✅ Supporto prioritario</li>
        </ul>
        <p>Dopo i 30 giorni, puoi continuare con il piano Free (blocco ads completo) oppure scegliere il piano Pro a partire da <strong>€2,99/mese</strong>.</p>`,
        "Scopri i Piani Pro",
        "https://adoff.app/#pricing"
      ),
    };
  },

  // --- TRIAL SCADE ---
  trial_expiring(email, daysLeft) {
    const d = parseInt(daysLeft);
    return {
      subject: `AdOff — Il tuo trial Pro scade tra ${d} giorn${d === 1 ? "o" : "i"}`,
      html: emailTemplate(
        `Il trial scade tra ${d} giorn${d === 1 ? "o" : "i"} ⏰`,
        `<p>Il tuo periodo di prova gratuito di AdOff Pro sta per terminare.</p>
        <p>Dopo la scadenza, le funzionalita' Pro verranno disabilitate ma il blocco ads di base resta <strong>gratuito per sempre</strong>.</p>
        <p>Per continuare con tutte le funzionalita' Pro, scegli un piano:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #e5e5ea">Mensile</td><td style="color:#1a1a2e;font-weight:600;text-align:right;padding:8px 0;border-bottom:1px solid #e5e5ea">€2,99/mese</td></tr>
          <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #e5e5ea">Annuale — Founder (primi 100)</td><td style="color:#4ade80;font-weight:600;text-align:right;padding:8px 0;border-bottom:1px solid #e5e5ea">€19,99/anno</td></tr>
          <tr><td style="color:#888;padding:8px 0">Founder Lifetime</td><td style="color:#fbbf24;font-weight:600;text-align:right;padding:8px 0">€99 una tantum</td></tr>
        </table>`,
        "Scegli il tuo Piano",
        "https://adoff.app/#pricing"
      ),
    };
  },

  // --- TICKET SUPPORTO RICEVUTO ---
  ticket_received(email, ticketId, subject) {
    const safeId = escapeHtml(ticketId);
    const safeSubject = escapeHtml(subject);
    return {
      subject: `AdOff Supporto — Ticket ${ticketId} ricevuto`,
      html: emailTemplate(
        "Abbiamo ricevuto la tua richiesta ✅",
        `<p>Grazie per averci contattato. Il tuo ticket e' stato registrato:</p>
        <div style="background:#0a0a1a;border:1px solid #2a2a4a;border-radius:10px;padding:16px;margin:16px 0">
          <p style="color:#888;font-size:12px;margin:0 0 4px">TICKET ID</p>
          <p style="color:#7c5cfc;font-weight:700;font-size:16px;margin:0;font-family:monospace">${safeId}</p>
          <p style="color:#fff;margin:12px 0 0">${safeSubject}</p>
        </div>
        <p>Ti risponderemo il prima possibile. Il tempo medio di risposta e' di <strong>24 ore</strong>.</p>`,
        "Stato del Ticket",
        "https://adoff.app/support"
      ),
    };
  },

  // --- RISPOSTA TICKET ---
  ticket_reply(email, ticketId, replyText) {
    const safeId = escapeHtml(ticketId);
    const safeReply = escapeHtml(replyText);
    return {
      subject: `AdOff Supporto — Risposta al ticket ${ticketId}`,
      html: emailTemplate(
        "Nuova risposta al tuo ticket 💬",
        `<p>Abbiamo risposto al tuo ticket <strong>${safeId}</strong>:</p>
        <div style="background:#f7f5ff;border-left:3px solid #7c5cfc;padding:16px;margin:16px 0;border-radius:0 8px 8px 0">
          <p style="color:#333;margin:0;white-space:pre-wrap">${safeReply}</p>
        </div>
        <p style="color:#888;font-size:13px">Puoi rispondere direttamente dalla pagina supporto.</p>`,
        "Vedi Ticket",
        "https://adoff.app/support"
      ),
    };
  },
};

async function sendEmail(to, subject, html, env) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AdOff <noreply@adoff.app>",
        to: [to],
        subject,
        html,
      }),
    });
    const data = await res.json();
    return { ok: res.ok, id: data.id, error: data.message };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// =============================================
// CRYPTO
// =============================================

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

// Confronto a tempo costante per prevenire timing attack sulle firme HMAC.
function constantTimeEqual(a, b) {
  const len = Math.max(a.length, b.length);
  const ap = a.padEnd(len, "\0");
  const bp = b.padEnd(len, "\0");
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    mismatch |= ap.charCodeAt(i) ^ bp.charCodeAt(i);
  }
  return mismatch === 0;
}

async function validateSignature(raw, secret) {
  if (!raw || raw.length < 36) return { valid: false, error: "Key too short" };

  const payloadB64 = raw.slice(0, -32);
  const signature = raw.slice(-32);

  const expected = await hmacSign(payloadB64, secret);

  if (!constantTimeEqual(signature, expected)) return { valid: false, error: "Invalid signature" };

  try {
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: "Decode error" };
  }
}

async function generateDeviceId(request, body, env) {
  // Preferisci l'UUID inviato dal client (stabile tra sessioni) — caso normale.
  if (body && body.deviceId && /^[0-9a-f-]{36}$/i.test(body.deviceId)) {
    return body.deviceId;
  }
  // Fallback (client legacy senza UUID): hash SHA-256 keyed con il secret server,
  // così l'id non è predicibile/forgiabile offline. CF-Connecting-IP è impostato
  // da Cloudflare (non spoofabile dal client).
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  const secret = (env && env.ADOFF_SECRET) || "";
  const data = new TextEncoder().encode(secret + "|" + ip + "|" + ua);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return "fb_" + Array.from(new Uint8Array(buf)).slice(0, 12)
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

// =============================================
// TRIAL — server-anchored, ECDSA P-256 signed token
// =============================================
// Il trial è ancorato al server (tabella D1 `trials`, keyed su device_id) e
// restituito come token firmato ECDSA. La chiave PRIVATA vive solo qui
// (env.ADOFF_TRIAL_PRIVKEY, PKCS8 base64). La chiave PUBBLICA è embeddata
// nell'estensione, che verifica la firma: un cracker non può forgiare un
// token con più giorni di trial né modificarne la scadenza.

const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni

function b64uEncode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let _trialPrivKeyPromise = null;
function importTrialPrivKey(env) {
  if (!_trialPrivKeyPromise) {
    const b64 = env.ADOFF_TRIAL_PRIVKEY || "";
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    _trialPrivKeyPromise = crypto.subtle.importKey(
      "pkcs8", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
    );
  }
  return _trialPrivKeyPromise;
}

async function signTrialToken(payloadObj, env) {
  const privKey = await importTrialPrivKey(env);
  const payloadB64 = b64uEncode(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, privKey,
    new TextEncoder().encode(payloadB64)
  );
  return payloadB64 + "." + b64uEncode(sig);
}

// =============================================
// TRIAL CHECK — server-authoritative (anti-tampering)
// GET /trial/check ritorna lo stato trial basato SOLO su dati server.
// Il client NON ha autorita' sul countdown — solo il server decide.
// =============================================
async function handleTrialCheck(request, env) {
  let deviceId = "";
  let body = {};

  const url = new URL(request.url);
  deviceId = url.searchParams.get("deviceId") || "";

  if (!deviceId) {
    try { body = await request.json(); } catch { /* optional */ }
    deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  }

  if (!deviceId) {
    return jsonResponse({ ok: false, error: "no deviceId" }, 400);
  }

  const now = Date.now();

  let installTs = null;
  try {
    const heartbeat = await env.DB.prepare(
      "SELECT install_ts FROM device_heartbeat WHERE device_id = ?"
    ).bind(deviceId).first();
    if (heartbeat?.install_ts) installTs = heartbeat.install_ts;
  } catch (_) { /* D1 optional */ }

  if (!installTs) {
    try {
      const trial = await env.DB.prepare(
        "SELECT trial_start FROM trials WHERE device_id = ?"
      ).bind(deviceId).first();
      if (trial?.trial_start) installTs = trial.trial_start;
    } catch (_) { /* D1 optional */ }
  }

  if (!installTs) {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS trials (device_id TEXT PRIMARY KEY, trial_start INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
    ).run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO trials (device_id, trial_start) VALUES (?, ?)"
    ).bind(deviceId, now).run();
    installTs = now;

    try {
      const cf = request.cf || {};
      const country = (cf.country || "XX").toUpperCase().slice(0, 2);
      await env.DB.prepare(`
        INSERT OR IGNORE INTO install_events (device_id, install_ts, country, plan, version)
        VALUES (?, ?, ?, 'trial', ?)
      `).bind(deviceId, now, country, "unknown").run();
    } catch (_) { /* D1 optional */ }
  }

  const trialStart = installTs;
  const trialEnd = trialStart + TRIAL_DURATION_MS;
  const active = now < trialEnd;
  const daysLeft = active ? Math.ceil((trialEnd - now) / 86400000) : 0;

  const token = await signTrialToken(
    { deviceId, trialStart, trialEnd, iat: now, v: 2 }, env
  );

  return jsonResponse({
    ok: true, active, trialStart, trialEnd, daysLeft, now, token,
    serverAuthoritative: true,
  });
}

/**
 * POST /trial  { deviceId }
 * Ritorna un token firmato con la scadenza del trial ancorata al server.
 * La prima richiesta per un device_id fissa trial_start = now; le successive
 * ritornano sempre la stessa scadenza (idempotente). Un update/reinstall dello
 * storage locale non puo' estendere o resettare il trial.
 */
async function handleTrial(body, env, request) {
  const deviceId = await generateDeviceId(request, body, env);

  // Tabella idempotente (no migration separata necessaria).
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS trials (device_id TEXT PRIMARY KEY, trial_start INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
  ).run();

  const now = Date.now();
  let row = await env.DB.prepare("SELECT trial_start FROM trials WHERE device_id = ?")
    .bind(deviceId).first();

  if (!row) {
    // INSERT OR IGNORE per gestire race tra richieste concorrenti dello stesso device.
    await env.DB.prepare("INSERT OR IGNORE INTO trials (device_id, trial_start) VALUES (?, ?)")
      .bind(deviceId, now).run();
    row = await env.DB.prepare("SELECT trial_start FROM trials WHERE device_id = ?")
      .bind(deviceId).first();
  }

  const trialStart = row.trial_start;
  const trialEnd = trialStart + TRIAL_DURATION_MS;
  const active = now < trialEnd;
  const daysLeft = active ? Math.ceil((trialEnd - now) / 86400000) : 0;

  // Registra installazione in D1 (se nuova) per tracking retention
  try {
    const cf = request.cf || {};
    const country = (cf.country || "XX").toUpperCase().slice(0, 2);
    const isNew = row.trial_start === now;
    if (isNew) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO install_events (device_id, install_ts, country, plan, version)
        VALUES (?, ?, ?, 'trial', ?)
      `).bind(deviceId, trialStart, country, "unknown").run();
    }
  } catch (e) {
    console.error("D1 install_events error:", e.message);
  }

  const token = await signTrialToken(
    { deviceId, trialStart, trialEnd, iat: now, v: 1 }, env
  );

  return jsonResponse({ ok: true, token, trialStart, trialEnd, now, daysLeft, active });
}

/**
 * Parses User-Agent to produce a human-readable device name.
 * E.g. "Chrome on Windows 11", "Firefox on macOS"
 */
function parseBrowserName(request) {
  const ua = request.headers.get("User-Agent") || "";
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Unknown OS";
  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return browser + " on " + os;
}

/**
 * Normalize device list — supports both legacy string entries and new object entries.
 * Always returns array of {id, name, lastSeen, ip} objects.
 */
function normalizeDeviceList(devices) {
  if (!Array.isArray(devices)) return [];
  return devices.map(d => {
    if (typeof d === "string") {
      return { id: d, name: "Unknown Device", lastSeen: 0, ip: "" };
    }
    return d;
  });
}

/**
 * Find a device index in the devices array by ID.
 * Handles both legacy string format and new object format.
 */
function findDevice(devices, deviceId) {
  return devices.findIndex(d => {
    const id = typeof d === "string" ? d : d.id;
    return id === deviceId;
  });
}

// =============================================
// RATE LIMITING
// =============================================

async function checkRateLimit(ip, env) {
  const key = `rl:${ip}`;
  const current = await kvGet(env.ADOFF_LICENSES, key);

  if (current) {
    const count = parseInt(current);
    if (count >= RATE_LIMIT_MAX) {
      return false;
    }
    await env.ADOFF_LICENSES.put(key, String(count + 1), {
      expirationTtl: RATE_LIMIT_WINDOW,
    });
  } else {
    await env.ADOFF_LICENSES.put(key, "1", {
      expirationTtl: RATE_LIMIT_WINDOW,
    });
  }
  return true;
}

// Rate-limit dedicato ai ticket/suggerimenti: piu' stretto (max N per finestra lunga).
// Difende l'endpoint /ticket anche dalle richieste che si fingono estensione (turnstileToken="extension").
const TICKET_RL_MAX = 6;            // max 6 invii
const TICKET_RL_WINDOW = 3600;      // per ora
async function checkTicketRateLimit(ip, env) {
  if (!ip) return true; // niente IP (impossibile su CF) => non bloccare
  const key = `tkt_rl:${ip}`;
  const current = await kvGet(env.ADOFF_LICENSES, key);
  if (current) {
    const count = parseInt(current);
    if (count >= TICKET_RL_MAX) return false;
    await env.ADOFF_LICENSES.put(key, String(count + 1), { expirationTtl: TICKET_RL_WINDOW });
  } else {
    await env.ADOFF_LICENSES.put(key, "1", { expirationTtl: TICKET_RL_WINDOW });
  }
  return true;
}

// =============================================
// ANTI-SPAM CONTENUTO (euristiche, mirror del client)
// =============================================

const SPAM_KEYBOARD_PATTERNS = [
  "qwert", "asdfg", "zxcvb", "qazws", "poiuy", "lkjhg", "mnbvc",
  "12345", "09876", "aaaaa", "bbbbb", "abcde", "fghij",
];

/** Rapporto di vocali su lettere (testo reale ~0.30-0.55). */
function vowelRatio(text) {
  const letters = (text.match(/[a-zàèéìòù]/gi) || []).length;
  if (letters === 0) return 0;
  const vowels = (text.match(/[aeiouàèéìòù]/gi) || []).length;
  return vowels / letters;
}

/**
 * Euristica anti-spam: true se il testo sembra spam/keyboard-mashing.
 * Conservativa: scatta solo su contenuti chiaramente non umani (>= 12 char).
 */
function looksLikeSpam(text) {
  const t = String(text || "").toLowerCase().trim();
  if (t.length < 12) return false;
  const lower = t.replace(/\s+/g, "");
  for (const p of SPAM_KEYBOARD_PATTERNS) {
    if (lower.includes(p)) return true;
  }
  // Carattere singolo ripetuto > 60% (es. "aaaaaaaaaa")
  const counts = {};
  for (const ch of lower) counts[ch] = (counts[ch] || 0) + 1;
  const maxCh = Math.max(...Object.values(counts));
  if (maxCh / lower.length > 0.6) return true;
  // Vocali quasi assenti in testo lungo => mashing
  if (t.length >= 20 && vowelRatio(t) < 0.12) return true;
  return false;
}

// =============================================
// D1 — TABELLA SUGGERIMENTI
// =============================================

/** Crea la tabella suggestions se non esiste (idempotente). */
async function initSuggestionsTable(env) {
  if (!env.DB) return false;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS suggestions (" +
    "id TEXT PRIMARY KEY, type TEXT, title TEXT, description TEXT, email TEXT, " +
    "browser TEXT, version TEXT, status TEXT DEFAULT 'new', votes INTEGER DEFAULT 1, " +
    "cluster TEXT, proposal TEXT, resolution TEXT, " +
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
  ).run();
  return true;
}

/** Inserisce un suggerimento in D1. Best-effort: non solleva. */
async function insertSuggestion(env, s) {
  try {
    await initSuggestionsTable(env);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO suggestions (id, type, title, description, email, browser, version, status, votes) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 1)"
    ).bind(
      s.id, s.type || "feature", s.title || "", s.description || "",
      s.email || "", s.browser || "", s.version || ""
    ).run();
    return true;
  } catch (e) {
    console.error("[suggestions] insert error:", e && e.message ? e.message : e);
    return false;
  }
}

// =============================================
// HANDLERS
// =============================================

async function handleValidate(body, env, request, opts = {}) {
  // explicitActivation = true quando arriva da /activate (utente inserisce key esplicitamente).
  // In quel caso un device in blacklist puo' essere ri-autorizzato: la blacklist serve
  // a impedire ri-attivazione AUTOMATICA dopo rimozione, non a bloccare l'utente per sempre.
  const explicitActivation = !!opts.explicitActivation;

  let { key } = body;
  if (!key) return jsonResponse({ valid: false, error: "Missing key" }, 400);

  // Risolvi alias ADOFF-XXXX-XXXX-XXXX → raw key
  if (key.startsWith("ADOFF-")) {
    const raw = await kvGet(env.ADOFF_LICENSES, `key:${key}`);
    if (!raw) return jsonResponse({ valid: false, error: "License not found" });
    key = raw;
  }

  const secret = env.ADOFF_SECRET;

  // 1. Verifica firma HMAC
  const sigCheck = await validateSignature(key, secret);
  if (!sigCheck.valid) {
    return jsonResponse({ valid: false, error: sigCheck.error });
  }

  // 1b. Sanity check: x negativo non e' un expiry valido
  if (sigCheck.payload && sigCheck.payload.x < 0) {
    return jsonResponse({ valid: false, error: "Invalid expiry" });
  }

  // 2. Controlla nel KV se la licenza esiste e non e' revocata
  const licenseData = await kvGet(env.ADOFF_LICENSES, `lic:${key}`, "json");

  // Se non esiste record KV, la licenza e' stata eliminata dall'admin (o non e' mai stata creata).
  // La firma HMAC offline da sola non basta: serve l'autorita' del KV.
  // Senza questo check, `validateSignature` passerebbe e il device check ricreerebbe la licenza
  // con `{...null, devices, ...}` resuscitandola silenziosamente.
  if (!licenseData) {
    return jsonResponse({ valid: false, error: "License not found", deleted: true });
  }

  if (licenseData.revoked) {
    return jsonResponse({ valid: false, error: "License revoked" });
  }

  // 3. Controlla scadenza
  const payload = sigCheck.payload;
  if (payload.x > 0 && payload.x < Date.now() / 1000) {
    return jsonResponse({ valid: false, error: "License expired", expired: true });
  }

  // 4. Controlla dispositivi
  const deviceId = await generateDeviceId(request, body, env);
  let devices = normalizeDeviceList(licenseData?.devices || []);
  const maxDevices = licenseData?.deviceLimit || payload.d || MAX_DEVICES;
  let bannedDevices = licenseData?.bannedDevices || [];
  const existingIdx = findDevice(devices, deviceId);

  // Controlla se il dispositivo è stato rimosso dalla dashboard.
  // explicitActivation: l'utente sta riattivando esplicitamente con la key
  //   → rimuovi il device dalla blacklist e procedi (illimitate riattivazioni consentite).
  // !explicitActivation: validazione automatica/background → blocca.
  if (bannedDevices.includes(deviceId)) {
    if (!explicitActivation) {
      return jsonResponse({
        valid: false,
        error: "Device deactivated",
        deactivated: true,
      });
    }
    bannedDevices = bannedDevices.filter(d => d !== deviceId);
  }

  if (existingIdx === -1) {
    if (devices.length >= maxDevices) {
      return jsonResponse({
        valid: false,
        error: "Device limit reached",
        maxDevices,
        currentDevices: devices.length,
      });
    }
    // Registra nuovo dispositivo con metadati
    devices.push({
      id: deviceId,
      name: parseBrowserName(request),
      lastSeen: Date.now(),
      ip: request.headers.get("CF-Connecting-IP") || "",
    });
    await env.ADOFF_LICENSES.put(`lic:${key}`, JSON.stringify({
      ...licenseData,
      devices,
      bannedDevices,
      lastValidated: Date.now(),
      plan: payload.p,
      email: payload.e,
    }));
  } else {
    // Aggiorna lastSeen dispositivo esistente
    devices[existingIdx] = {
      ...devices[existingIdx],
      lastSeen: Date.now(),
      name: parseBrowserName(request),
    };
    await env.ADOFF_LICENSES.put(`lic:${key}`, JSON.stringify({
      ...licenseData,
      devices,
      bannedDevices,
      lastValidated: Date.now(),
    }));
  }

  return jsonResponse({
    valid: true,
    plan: payload.p,
    expires: payload.x > 0 ? payload.x : null,
    expiresHuman: payload.x > 0
      ? new Date(payload.x * 1000).toISOString().split("T")[0]
      : "LIFETIME",
    devices: devices.length,
    maxDevices,
  });
}

async function handleActivate(body, env, request) {
  // Attivazione esplicita: l'utente inserisce la key manualmente.
  // Differenza chiave vs /validate: il device puo' essere riautorizzato
  // anche se era stato rimosso dalla dashboard (illimitate ri-attivazioni).
  return handleValidate(body, env, request, { explicitActivation: true });
}

async function handleDeactivate(body, env, request) {
  let { key } = body;
  if (!key) return jsonResponse({ ok: false, error: "Missing key" }, 400);

  // Risolvi alias ADOFF-XXXX-XXXX-XXXX → raw key
  if (key.startsWith("ADOFF-")) {
    const raw = await kvGet(env.ADOFF_LICENSES, `key:${key}`);
    if (!raw) return jsonResponse({ ok: false, error: "License not found" });
    key = raw;
  }

  const deviceId = await generateDeviceId(request, body, env);
  const licenseData = await kvGet(env.ADOFF_LICENSES, `lic:${key}`, "json");

  if (!licenseData) {
    return jsonResponse({ ok: false, error: "License not found" });
  }

  const devices = normalizeDeviceList(licenseData.devices || [])
    .filter(d => d.id !== deviceId);
  await env.ADOFF_LICENSES.put(`lic:${key}`, JSON.stringify({
    ...licenseData,
    devices,
  }));

  return jsonResponse({ ok: true, devicesRemaining: devices.length });
}

async function handleRevoke(body, env, request) {
  // Solo admin
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let { key } = body;
  if (!key) return jsonResponse({ ok: false, error: "Missing key" }, 400);

  // Risolvi alias ADOFF-XXXX-XXXX-XXXX → raw key
  if (key.startsWith("ADOFF-")) {
    const raw = await kvGet(env.ADOFF_LICENSES, `key:${key}`);
    if (!raw) return jsonResponse({ ok: false, error: "License not found" });
    key = raw;
  }

  const existing = await kvGet(env.ADOFF_LICENSES, `lic:${key}`, "json") || {};
  await env.ADOFF_LICENSES.put(`lic:${key}`, JSON.stringify({
    ...existing,
    revoked: true,
    revokedAt: Date.now(),
  }));

  return jsonResponse({ ok: true, message: "License revoked" });
}

async function handleDeleteLicense(body, env, request) {
  // Solo admin — elimina definitivamente una licenza dal KV
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let { key } = body;
  if (!key) return jsonResponse({ ok: false, error: "Missing key" }, 400);

  let rawKey = key;
  let adoffKey = null;

  // Risolvi alias ADOFF-XXXX-XXXX-XXXX → raw key
  if (key.startsWith("ADOFF-")) {
    adoffKey = key;
    const raw = await kvGet(env.ADOFF_LICENSES, `key:${key}`);
    if (!raw) return jsonResponse({ ok: false, error: "License not found" });
    rawKey = raw;
  }

  // Leggi dati licenza PRIMA di eliminare
  const licData = await kvGet(env.ADOFF_LICENSES, `lic:${rawKey}`, "json");
  if (!licData) return jsonResponse({ ok: false, error: "License not found in KV" });

  if (!adoffKey && licData.key) adoffKey = licData.key;
  const email = licData.email;

  // Elimina licenza dal KV
  await env.ADOFF_LICENSES.delete(`lic:${rawKey}`);

  // Elimina alias key:ADOFF-...
  if (adoffKey) {
    await env.ADOFF_LICENSES.delete(`key:${adoffKey}`);
  }

  // Rimuovi dalla lista email se presente
  if (email) {
    const emailKeys = await kvGet(env.ADOFF_LICENSES, `email:${email}`, "json") || [];
    const filtered = emailKeys.filter(e => e.raw !== rawKey && e.key !== adoffKey);
    if (filtered.length > 0) {
      await env.ADOFF_LICENSES.put(`email:${email}`, JSON.stringify(filtered));
    } else {
      await env.ADOFF_LICENSES.delete(`email:${email}`);
    }
  }

  return jsonResponse({ ok: true, message: "License permanently deleted" });
}

// =============================================
// ADMIN — GENERAZIONE KEY SERVER-SIDE
// =============================================

async function handleAdminGenerateKey(body, env, request) {
  // Autenticazione admin
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const { plan, months, email } = body;
  // Accept both 'devices' (new) and 'deviceLimit' (legacy) for backward compatibility
  const devicesInput = body.devices !== undefined ? body.devices : body.deviceLimit;

  // Validazione input
  const VALID_PLANS = ["pro", "lifetime", "monthly", "annual"];
  if (!plan || !VALID_PLANS.includes(plan)) {
    return jsonResponse({ ok: false, error: "Invalid plan" }, 400);
  }
  const deviceLimit = Math.min(Math.max(parseInt(devicesInput) || 3, 1), 10);
  const monthsVal = plan === "lifetime" ? 0 : (Math.max(parseInt(months) || 1, 1));

  const secret = env.ADOFF_SECRET;
  if (!secret) return jsonResponse({ ok: false, error: "ADOFF_SECRET not configured" }, 500);

  // Genera payload e firma (stessa logica del webhook)
  const now = Math.floor(Date.now() / 1000);
  const expires = plan === "lifetime" ? 0 : now + (monthsVal * 30 * 86400);
  const payload = { c: now, d: deviceLimit, e: email || "", p: plan, v: 1, x: expires };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = btoa(payloadJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signature = await hmacSign(payloadB64, secret);
  const raw = payloadB64 + signature;

  // Key leggibile
  const keyHash = await hmacSign(raw, secret);
  const kh = keyHash.toUpperCase();
  const key = "ADOFF-" + kh.slice(0, 4) + "-" + kh.slice(4, 8) + "-" + kh.slice(8, 12);

  // Salva nel KV
  await env.ADOFF_LICENSES.put(`lic:${raw}`, JSON.stringify({
    key,
    raw,
    plan,
    email: email || "",
    expires,
    deviceLimit,
    devices: [],
    createdAt: Date.now(),
    generatedBy: "admin",
  }));
  await env.ADOFF_LICENSES.put(`key:${key}`, raw);
  if (email) {
    const normalEmail = email.toLowerCase().trim();
    // Email -> keys index (used by various lookups)
    const existingKeys = await kvGet(env.ADOFF_LICENSES, `email:${normalEmail}`, "json") || [];
    existingKeys.push({ key, raw, plan, created: Date.now() });
    await env.ADOFF_LICENSES.put(`email:${normalEmail}`, JSON.stringify(existingKeys));

    // User account record — parity with Stripe webhook flow.
    // Without this, the user dashboard (/account/devices) doesn't see admin-created licenses
    // because it reads from user:{email}.licenses.
    const userKey = `user:${normalEmail}`;
    let user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
    if (!user) {
      user = {
        email: normalEmail,
        passwordHash: null,
        salt: null,
        emailVerified: false,
        providers: [],
        googleId: null,
        microsoftId: null,
        licenses: [raw],
        createdAt: Date.now(),
        lastLogin: null,
        createdVia: "admin",
      };
    } else {
      if (!Array.isArray(user.licenses)) user.licenses = [];
      if (!user.licenses.includes(raw)) user.licenses.push(raw);
    }
    await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));
  }

  const expiresHuman = expires > 0
    ? new Date(expires * 1000).toISOString().split("T")[0]
    : "LIFETIME";

  return jsonResponse({ ok: true, key, raw, plan, email: email || "", expiresHuman, devices: deviceLimit });
}

// =============================================
// TICKET SYSTEM
// =============================================

async function handleCreateTicket(body, env, request) {
  const required = ["category", "name", "email", "subject", "description"];
  for (const field of required) {
    if (!body[field]) return jsonResponse({ ok: false, error: `Missing field: ${field}` }, 400);
  }

  // Anti-bot: verifica Turnstile (il sito invia il token; l'estensione usa "extension")
  const ip = request ? (request.headers.get("CF-Connecting-IP") || "") : "";
  if (!await verifyTurnstile(body.turnstileToken, ip, env)) {
    return jsonResponse({ ok: false, error: "Verification failed" }, 403);
  }

  // Anti-bot: rate-limit per-IP dedicato (vale anche per token "extension" — chiude lo spam diretto)
  if (!await checkTicketRateLimit(ip, env)) {
    return jsonResponse({ ok: false, error: "Too many requests" }, 429);
  }

  // Anti-spam: euristiche sul contenuto (keyboard-mashing / vocali assenti / char ripetuti)
  if (looksLikeSpam(`${body.subject} ${body.description}`)) {
    return jsonResponse({ ok: false, error: "Content rejected" }, 403);
  }

  // Generate ticket ID: TK-YYYYMMDD-XXXXXXXX (crypto random)
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randBytes = crypto.getRandomValues(new Uint8Array(4));
  const rand = Array.from(randBytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const ticketId = `TK-${dateStr}-${rand}`;

  const ticket = {
    id: ticketId,
    category: body.category,
    priority: body.priority || "low",
    name: body.name,
    email: body.email,
    license: body.license || "",
    subject: body.subject,
    description: body.description,
    browser: body.browser || "",
    status: "open",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    replies: [],
  };

  // Save ticket
  await env.ADOFF_LICENSES.put(`ticket:${ticketId}`, JSON.stringify(ticket));

  // Add to ticket index
  const index = await kvGet(env.ADOFF_LICENSES, "tickets:index", "json") || [];
  index.unshift({ id: ticketId, category: ticket.category, priority: ticket.priority, subject: ticket.subject, email: ticket.email, status: "open", createdAt: ticket.createdAt });
  // Keep last 500 tickets in index
  if (index.length > 500) index.length = 500;
  await env.ADOFF_LICENSES.put("tickets:index", JSON.stringify(index));

  // Increment counter
  const count = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_tickets") || "0");
  await env.ADOFF_LICENSES.put("stats:total_tickets", String(count + 1));

  // Notifica Telegram — routing per categoria (refund→topic dedicato, billing→vendite, ecc.)
  const isSuggestion = ticket.category === "suggestion";
  const isRefund = ticket.category === "refund";
  const thread = await resolveTicketThread(ticket.category, env);
  const headEmoji = isSuggestion ? "\u{1F4A1}" : (isRefund ? "\u{1F4B8}" : "\u{1F39F}");
  const headLabel = isSuggestion ? "Nuovo suggerimento" : (isRefund ? "Richiesta RIMBORSO" : "Nuovo ticket");
  const tgMsg = `${headEmoji} <b>${headLabel}</b>\n` +
    `\u{1F3F7} ${escapeHtml(ticket.category)} (${escapeHtml(ticket.priority)})\n` +
    `\u{1F464} ${escapeHtml(ticket.name)} — ${escapeHtml(ticket.email)}\n` +
    `\u{1F4CC} ${escapeHtml(ticket.subject)}\n` +
    (ticket.license ? `\u{1F511} ${escapeHtml(ticket.license)}\n` : "") +
    (ticket.browser ? `\u{1F310} ${escapeHtml(ticket.browser)}\n` : "") +
    `\u{1F194} <code>${ticketId}</code>\n\n` +
    `${escapeHtml(String(ticket.description).slice(-2500))}`;
  await notifyTelegram(tgMsg, env, thread);

  // Email di conferma all'utente (chiude il loop) — solo per ticket reali, non i suggerimenti anon.
  if (!isSuggestion && EMAIL_RE.test(ticket.email || "") && !/^noreply/i.test(ticket.email)) {
    try {
      const tmpl = EMAIL_TEMPLATES.ticket_received(ticket.email, ticketId, ticket.subject);
      await sendEmail(ticket.email, tmpl.subject, tmpl.html, env);
    } catch (e) { console.error("[ticket] confirm email error:", e && e.message); }
  }

  // Persistenza D1 dedicata per i suggerimenti (gestione/analisi nell'admin)
  if (isSuggestion) {
    // type estratto dal subject "[Suggerimento/<type>] ..."
    const typeMatch = /\[Suggerimento\/([a-z]+)\]/i.exec(ticket.subject || "");
    const sType = typeMatch ? typeMatch[1].toLowerCase() : "feature";
    const sTitle = (ticket.subject || "").replace(/^\[Suggerimento\/[a-z]+\]\s*/i, "");
    const verMatch = /Versione:\s*([\w.\-]+)/i.exec(ticket.description || "");
    await insertSuggestion(env, {
      id: ticketId,
      type: sType,
      title: sTitle,
      description: ticket.description,
      email: ticket.email,
      browser: ticket.browser,
      version: verMatch ? verMatch[1] : "",
    });
  }

  return jsonResponse({ ok: true, ticketId, message: "Ticket created" });
}

async function handleListTickets(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const index = await kvGet(env.ADOFF_LICENSES, "tickets:index", "json") || [];
  const tickets = statusFilter
    ? index.filter(t => t.status === statusFilter)
    : index;
  return jsonResponse({ ok: true, tickets, total: tickets.length });
}

const TICKET_ID_RE = /^TK-\d{8}-[A-F0-9]{8}$/;

async function handleGetTicket(request, env, ticketId) {
  if (!TICKET_ID_RE.test(ticketId)) {
    return jsonResponse({ ok: false, error: "Invalid ticket ID" }, 400);
  }
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const ticket = await kvGet(env.ADOFF_LICENSES, `ticket:${ticketId}`, "json");
  if (!ticket) return jsonResponse({ ok: false, error: "Ticket not found" }, 404);
  return jsonResponse({ ok: true, ticket });
}

const VALID_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];

async function handleUpdateTicket(body, env, request, ticketId) {
  if (!TICKET_ID_RE.test(ticketId)) {
    return jsonResponse({ ok: false, error: "Invalid ticket ID" }, 400);
  }
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const ticket = await kvGet(env.ADOFF_LICENSES, `ticket:${ticketId}`, "json");
  if (!ticket) return jsonResponse({ ok: false, error: "Ticket not found" }, 404);

  if (body.status) {
    if (!VALID_TICKET_STATUSES.includes(body.status)) {
      return jsonResponse({ ok: false, error: "Invalid status value" }, 400);
    }
    ticket.status = body.status;
  }
  if (body.reply) {
    ticket.replies.push({ text: body.reply, by: body.by === "ai" ? "ai" : "admin", at: new Date().toISOString() });
    // Chiude il loop: invia la risposta all'utente via email (i template esistevano ma non erano cablati).
    if (EMAIL_RE.test(ticket.email || "") && !/^noreply/i.test(ticket.email)) {
      try {
        const tmpl = EMAIL_TEMPLATES.ticket_reply(ticket.email, ticketId, body.reply);
        await sendEmail(ticket.email, tmpl.subject, tmpl.html, env);
      } catch (e) { console.error("[ticket] reply email error:", e && e.message); }
    }
  }
  ticket.updatedAt = new Date().toISOString();
  await env.ADOFF_LICENSES.put(`ticket:${ticketId}`, JSON.stringify(ticket));

  // Update index status
  const index = await kvGet(env.ADOFF_LICENSES, "tickets:index", "json") || [];
  const idx = index.findIndex(t => t.id === ticketId);
  if (idx >= 0) {
    index[idx].status = ticket.status;
    await env.ADOFF_LICENSES.put("tickets:index", JSON.stringify(index));
  }

  return jsonResponse({ ok: true, ticket });
}

// =============================================
// ADMIN — SUGGERIMENTI (D1)
// =============================================

const VALID_SUGGESTION_STATUSES = ["new", "triaged", "proposed", "approved", "in_progress", "done", "rejected"];

/** GET /admin/suggestions?status=&type= — lista suggerimenti ordinata per voti/data. */
async function handleAdminListSuggestions(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!env.DB) return jsonResponse({ ok: true, suggestions: [], total: 0 });
  await initSuggestionsTable(env);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const where = [];
  const binds = [];
  if (status) { where.push("status = ?"); binds.push(status); }
  if (type) { where.push("type = ?"); binds.push(type); }
  const sql = "SELECT * FROM suggestions" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY votes DESC, created_at DESC LIMIT 500";
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return jsonResponse({ ok: true, suggestions: results || [], total: (results || []).length });
}

/** POST /admin/suggestions/:id — update {status, cluster, proposal, resolution}. */
async function handleAdminUpdateSuggestion(body, env, request, id) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!TICKET_ID_RE.test(id)) return jsonResponse({ ok: false, error: "Invalid id" }, 400);
  if (!env.DB) return jsonResponse({ ok: false, error: "DB unavailable" }, 503);
  await initSuggestionsTable(env);

  const sets = [];
  const binds = [];
  if (body.status !== undefined) {
    if (!VALID_SUGGESTION_STATUSES.includes(body.status)) {
      return jsonResponse({ ok: false, error: "Invalid status" }, 400);
    }
    sets.push("status = ?"); binds.push(body.status);
  }
  if (body.cluster !== undefined) { sets.push("cluster = ?"); binds.push(String(body.cluster)); }
  if (body.proposal !== undefined) { sets.push("proposal = ?"); binds.push(String(body.proposal)); }
  if (body.resolution !== undefined) { sets.push("resolution = ?"); binds.push(String(body.resolution)); }
  if (typeof body.voteDelta === "number") { sets.push("votes = votes + ?"); binds.push(body.voteDelta); }
  if (!sets.length) return jsonResponse({ ok: false, error: "Nothing to update" }, 400);

  sets.push("updated_at = CURRENT_TIMESTAMP");
  binds.push(id);
  await env.DB.prepare(`UPDATE suggestions SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  const row = await env.DB.prepare("SELECT * FROM suggestions WHERE id = ?").bind(id).first();
  return jsonResponse({ ok: true, suggestion: row });
}

/** GET /admin/suggestions/digest?since= — aggregato per il job settimanale. */
async function handleAdminSuggestionsDigest(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!env.DB) return jsonResponse({ ok: true, items: [], byType: {}, total: 0 });
  await initSuggestionsTable(env);
  const url = new URL(request.url);
  const since = url.searchParams.get("since"); // ISO opzionale
  // Considera solo i suggerimenti non ancora chiusi/proposti per la nuova analisi
  const sql = "SELECT * FROM suggestions WHERE status IN ('new','triaged')" +
    (since ? " AND created_at >= ?" : "") +
    " ORDER BY votes DESC, created_at DESC LIMIT 300";
  const stmt = since ? env.DB.prepare(sql).bind(since) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  const items = results || [];
  const byType = {};
  for (const it of items) byType[it.type || "feature"] = (byType[it.type || "feature"] || 0) + 1;
  return jsonResponse({ ok: true, items, byType, total: items.length });
}

/** POST /admin/suggestions/notify — body {text, thread?} → invia su Telegram. */
async function handleAdminNotifyTelegram(body, env, request) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const text = String(body.text || "").slice(0, 3800);
  if (!text) return jsonResponse({ ok: false, error: "Missing text" }, 400);
  const thread = Number.isInteger(body.thread) ? body.thread : TELEGRAM_SUGGEST_THREAD;
  const ok = await notifyTelegram(text, env, thread);
  return jsonResponse({ ok });
}

// =============================================
// TELEGRAM WEBHOOK INBOUND (approvazione real-time)
// =============================================

/**
 * POST /admin/tg-setup-webhook — registra il webhook Telegram su /tg-webhook
 * usando il bot token (worker secret) + il secret condiviso. Admin-gated.
 */
async function handleAdminSetupTelegramWebhook(env, request) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!env.TELEGRAM_BOT_TOKEN) return jsonResponse({ ok: false, error: "TELEGRAM_BOT_TOKEN not set" }, 500);
  if (!env.TELEGRAM_WEBHOOK_SECRET) return jsonResponse({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET not set" }, 500);
  const url = new URL(request.url);
  const webhookUrl = `${url.origin}/tg-webhook`;
  const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
  const res = await fetch(tgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "channel_post"],
    }),
  });
  const data = await res.json().catch(() => ({}));
  return jsonResponse({ ok: !!data.ok, webhookUrl, telegram: data });
}

/**
 * POST /admin/tg-create-topic — crea un forum topic nel gruppo Telegram e ne salva
 * il message_thread_id in KV. Body: {name, configKey, iconColor?}. Admin-gated.
 * Idempotente: se configKey è già valorizzata in KV, ritorna l'id esistente.
 */
async function handleAdminCreateTopic(body, env, request) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return jsonResponse({ ok: false, error: "Telegram not configured" }, 500);
  }
  const name = String(body.name || "").slice(0, 128);
  const configKey = String(body.configKey || "");
  if (!name || !configKey) return jsonResponse({ ok: false, error: "Missing name/configKey" }, 400);

  const existing = parseInt(await kvGet(env.ADOFF_LICENSES, configKey) || "0", 10);
  if (existing > 0 && !body.force) {
    return jsonResponse({ ok: true, threadId: existing, reused: true });
  }

  const payload = { chat_id: env.TELEGRAM_CHAT_ID, name };
  if (Number.isInteger(body.iconColor)) payload.icon_color = body.iconColor;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createForumTopic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok || !data.result || !data.result.message_thread_id) {
    return jsonResponse({ ok: false, error: "createForumTopic failed", telegram: data }, 502);
  }
  const threadId = data.result.message_thread_id;
  await env.ADOFF_LICENSES.put(configKey, String(threadId));
  return jsonResponse({ ok: true, threadId, name, configKey });
}

/**
 * POST /tg-webhook — riceve gli update Telegram.
 * Nel topic Suggerimenti, interpreta comandi di approvazione/rifiuto e aggiorna D1.
 * Comandi: "ok <id|n>" / "esegui <id,...|tutti>" / "rifiuta <id,...>" / "approva ..."
 */
async function handleTelegramWebhook(request, env) {
  // Validazione segreto webhook
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return jsonResponse({ ok: false }, 401);
  }
  let update;
  try { update = await request.json(); } catch { return jsonResponse({ ok: true }); }

  const msg = update && (update.message || update.channel_post);
  if (!msg || !msg.text) return jsonResponse({ ok: true });

  // Topic SEO / AI Search (thread 44): salva la risposta per il watcher sulla macchina
  // (l'applicazione/deploy avviene fuori dal worker, dove c'è il repo del sito).
  if (msg.message_thread_id === TELEGRAM_SEO_THREAD) {
    await env.ADOFF_LICENSES.put("seo:reply:latest", JSON.stringify({
      text: msg.text.trim(), ts: Date.now(), messageId: msg.message_id,
    }));
    return jsonResponse({ ok: true });
  }

  // Solo il topic Suggerimenti (message_thread_id === 8)
  if (msg.message_thread_id !== TELEGRAM_SUGGEST_THREAD) return jsonResponse({ ok: true });

  const text = msg.text.trim();
  const m = /^(ok|approva|esegui|rifiuta|reject)\s+(.+)$/i.exec(text);
  if (!m) return jsonResponse({ ok: true });

  const verb = m[1].toLowerCase();
  const isReject = verb === "rifiuta" || verb === "reject";
  const targetStatus = isReject ? "rejected" : "approved";
  const arg = m[2].trim();

  if (!env.DB) return jsonResponse({ ok: true });
  await initSuggestionsTable(env);

  let updated = 0;
  if (/^(tutti|all)$/i.test(arg)) {
    const r = await env.DB.prepare(
      "UPDATE suggestions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE status = 'proposed'"
    ).bind(targetStatus).run();
    updated = (r.meta && r.meta.changes) || 0;
  } else {
    // Lista di id TK-... oppure indici numerici (riferiti ai 'proposed' ordinati)
    const tokens = arg.split(/[\s,]+/).filter(Boolean);
    const tkIds = tokens.filter(t => TICKET_ID_RE.test(t));
    const nums = tokens.filter(t => /^\d+$/.test(t)).map(n => parseInt(n, 10));

    for (const id of tkIds) {
      const r = await env.DB.prepare(
        "UPDATE suggestions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'proposed'"
      ).bind(targetStatus, id).run();
      updated += (r.meta && r.meta.changes) || 0;
    }
    if (nums.length) {
      const { results } = await env.DB.prepare(
        "SELECT id FROM suggestions WHERE status = 'proposed' ORDER BY updated_at DESC, created_at DESC"
      ).all();
      const proposed = results || [];
      for (const n of nums) {
        const row = proposed[n - 1];
        if (row) {
          const r = await env.DB.prepare(
            "UPDATE suggestions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(targetStatus, row.id).run();
          updated += (r.meta && r.meta.changes) || 0;
        }
      }
    }
  }

  await notifyTelegram(
    `✅ Ricevuto: ${isReject ? "rifiutati" : "approvati"} ${updated} suggerimento/i (\"${escapeHtml(arg)}\").`,
    env, TELEGRAM_SUGGEST_THREAD
  );
  return jsonResponse({ ok: true, updated });
}

// =============================================
// TELEGRAM NOTIFY (supporto — thread 7 · vendite/rimborsi — thread 22)
// =============================================

const TELEGRAM_SUPPORT_THREAD = 7;
const TELEGRAM_SUGGEST_THREAD = 8;
const TELEGRAM_SALES_THREAD = 22;
const TELEGRAM_REVIEWS_THREAD = 24;
const TELEGRAM_REFUNDS_THREAD = 32;   // topic dedicato "💸 Rimborsi" (creato via /admin/tg-create-topic)
const TELEGRAM_SEO_THREAD = 44;       // topic "🔍 SEO / AI Search" — risposte approva/migliora per l'agente SEO settimanale

// Override opzionale via KV (se un giorno il topic viene ricreato con id diverso).
const KV_REFUND_THREAD = "config:tg_refund_thread";

/**
 * Risolve il thread Telegram in base alla categoria del ticket.
 * refund → topic Rimborsi 32 (override KV se presente; MAI fallback al thread sbagliato)
 * billing → Vendite & Rimborsi (22) · suggestion/feature → Suggerimenti (8) · resto → Supporto (7)
 */
async function resolveTicketThread(category, env) {
  if (category === "refund") {
    // Default deterministico = 32 (hardcoded, stabile). KV solo come override esplicito.
    let t = TELEGRAM_REFUNDS_THREAD;
    try {
      const kv = parseInt(await kvGet(env.ADOFF_LICENSES, KV_REFUND_THREAD) || "0", 10);
      if (kv > 0) t = kv;
    } catch (_) { /* usa il default 32 */ }
    return t;
  }
  if (category === "billing") return TELEGRAM_SALES_THREAD;
  if (category === "suggestion" || category === "feature") return TELEGRAM_SUGGEST_THREAD;
  return TELEGRAM_SUPPORT_THREAD;
}

async function notifyTelegram(text, env, threadId = TELEGRAM_SUPPORT_THREAD) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: env.TELEGRAM_CHAT_ID,
    message_thread_id: threadId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) return true;
      const txt = await res.text().catch(() => "");
      console.error(`[telegram] thread=${threadId} status=${res.status} attempt=${attempt} body=${txt.slice(0, 200)}`);
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      return false;
    } catch (e) {
      console.error(`[telegram] thread=${threadId} fetch_error attempt=${attempt} err=${e && e.message ? e.message : e}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
    }
  }
  return false;
}

// =============================================
// AI SUPPORT CHATBOT (LLM locale via tunnel)
// =============================================

const CHAT_LANGS = ["it", "en", "de", "fr", "es", "pt"];
const CHAT_MAX_MESSAGE = 2000;
const CHAT_HISTORY_KEEP = 16;       // ultimi N messaggi tenuti in sessione
const CHAT_SESSION_TTL = 86400;     // 24h
const CHAT_MAX_TOKENS = 650;
const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// Knowledge base brand-safe (nessun brand famoso, nessun dato personale)
const ADOFF_KB = `PRODOTTO
AdOff e' un'estensione browser ad blocker universale con tecnologia stealth anti-detection (slogan "Ads? Off!"). Blocca pubblicita' su tutti i siti, invisibile ai sistemi anti-adblock. Disponibile per Chrome, Edge, Opera, Brave e Firefox; la versione per Safari e' in arrivo.

PIANI
- Free: blocco ads di base (richieste di rete + elementi cosmetici nascosti dal DOM). Gratis per sempre.
- Pro: in piu' neutralizza le pubblicita' video sulle piattaforme di video streaming e attiva l'evasione stealth anti-adblock avanzata.
- Trial: 30 giorni di Pro gratuito all'installazione, senza carta di credito. Dopo il trial si torna automaticamente a Free.
C'e' un solo piano Pro, che include fino a 3 dispositivi per licenza. I tier con piu' dispositivi (5 o 10) non sono al momento in vendita.

PREZZI (piano UNICO Pro, valuta EUR)
- Mensile: 2,99 EUR al mese, disdici quando vuoi.
- Annuale Founder: 19,99 EUR all'anno, riservato ai primi 100 iscritti e bloccato a vita.
- Annuale standard: 24,99 EUR all'anno (dopo esauriti i 100 posti Founder).
- Founder Lifetime: 99 EUR pagamento unico, offerta di lancio a posti limitati (sparisce a esaurimento).
I posti Founder sono limitati a 100 e mostrati in tempo reale sul sito. Pagamento sicuro con carta o wallet del telefono.

COME ATTIVARE PRO
1. Acquista dal sito o dalle Opzioni dell'estensione.
2. Ricevi una email di attivazione account: imposta la password.
3. La license key viene associata al tuo account.
4. Apri il popup AdOff (icona nella toolbar) > Opzioni > sezione Licenza > incolla la key > Attiva.

DISPOSITIVI
Il piano Pro include fino a 3 dispositivi per licenza ed e' un limite effettivo: quando provi ad attivare un quarto dispositivo l'attivazione viene bloccata. Per usarne uno nuovo, libera prima un posto rimuovendo un dispositivo dalla tua area account, poi attiva il nuovo.

ABBONAMENTO E RINNOVO
Gli abbonamenti si rinnovano automaticamente. Puoi annullare quando vuoi dal portale clienti: alla cancellazione il Pro resta attivo fino alla fine del periodo gia' pagato, poi torna Free. La Founder Lifetime e' un pagamento unico senza rinnovo.

RIMBORSI
Garanzia soddisfatti o rimborsati entro 30 giorni dall'acquisto: rimborso completo con lo stesso metodo di pagamento, senza penali. Resta inoltre garantito il diritto di recesso UE entro 14 giorni.

RISOLUZIONE PROBLEMI
- "Vedo ancora pubblicita'": verifica che la protezione sia attiva (toggle nel popup), che il sito non sia in pausa o in whitelist, e ricarica la pagina. Le pubblicita' video richiedono Pro o trial attivo.
- "Un sito non funziona bene": metti AdOff in pausa su quel sito dal popup (opzioni di pausa), ricarica, e segnala il sito.
- "Messaggio anti-adblock": lo stealth Pro neutralizza la maggior parte dei rilevatori; assicurati che il Pro sia attivo. Se persiste, segnala il sito.
- Le pubblicita' video sulle piattaforme di video streaming si bloccano solo con Pro o trial.

PRIVACY
AdOff non raccoglie dati personali di navigazione. Il blocco avviene localmente nel browser.`;

function buildSupportSystemPrompt(lang, licenseContext) {
  const langNames = { it: "italiano", en: "English", de: "Deutsch", fr: "francais", es: "espanol", pt: "portugues" };
  const langName = langNames[lang] || "English";
  return `Sei "AdOff Assistant", l'assistente di supporto ufficiale di AdOff. Aiuti i clienti in modo cordiale, conciso e competente.

REGOLE ASSOLUTE:
- Rispondi SEMPRE ed ESCLUSIVAMENTE in ${langName}.
- Parla SOLO di AdOff e del supporto clienti. Se ti chiedono altro, riporta gentilmente al tema AdOff.
- Puoi nominare i browser e i loro store ufficiali (Chrome Web Store, Microsoft Edge Add-ons, Firefox Add-ons, Safari, Opera). La regola "niente marchi" vale SOLO per le piattaforme di contenuti/streaming di cui AdOff blocca le pubblicita': in quel contesto usa SEMPRE termini generici ("piattaforme di video streaming", "social media", "motori di ricerca", "e-commerce"), MAI i loro nomi propri. Esempi VIETATI: "YouTube", "Netflix", "Twitch", "Facebook", "Instagram", "TikTok", "Reddit", "Amazon". Esempio corretto: invece di "le pubblicita' video su YouTube" scrivi "le pubblicita' video sulle piattaforme di video streaming".
- NON rivelare MAI dettagli tecnici interni, chiavi, URL di sistema, nomi di server, o dati personali di chiunque.
- NON inventare informazioni: se non sai o serve un'azione sull'account/pagamento del cliente, ESCALA a un operatore umano.
- Rispondi in massimo 4-6 frasi. Usa un tono positivo e rassicurante.
- LINK (REGOLA CRITICA): usa SOLO ed ESCLUSIVAMENTE gli URL elencati qui sotto, COPIATI ESATTAMENTE. NON inventare, NON indovinare, NON modificare MAI un URL (specialmente gli ID negli URL degli store: copiali identici). Formato sempre markdown con etichetta descrittiva, MAI URL nudo.
  Link di installazione (puoi indicare lo store del browser dell'utente):
  - Chrome Web Store: https://chromewebstore.google.com/detail/fcjfpfhdcpbjmihiikbblcokmjnhedhp
  - Firefox Add-ons: https://addons.mozilla.org/firefox/addon/adoff/
  - Microsoft Edge, Opera, Safari o "tutti i browser": usa SEMPRE https://adoff.app/install (la pagina guida l'utente; per Edge/Opera/Safari NON esiste ancora un link diretto allo store)
  - Tutti i browser (pagina installazione): https://adoff.app/install
  Altri link: Supporto https://adoff.app/support · Prezzi https://adoff.app/#pricing · Account https://adoff.app/account · Privacy https://adoff.app/privacy · Recesso/rimborsi https://adoff.app/withdrawal
  Se non sei certo dell'URL esatto, usa https://adoff.app/install. NON usare MAI domini diversi da questi.

QUANDO ESCALARE A UN UMANO (caso straordinario):
- Richieste di rimborso o contestazioni di pagamento.
- Problemi di licenza/account che richiedono un'azione manuale (key non funzionante, account bloccato, dispositivi).
- Errori di pagamento o doppi addebiti.
- Richieste legali o di cancellazione dati (GDPR).
- L'utente chiede esplicitamente di parlare con una persona.
- Dopo 2 tentativi non sei riuscito a risolvere.

FORMATO RISPOSTA (OBBLIGATORIO):
Scrivi la tua risposta al cliente, poi SULL'ULTIMA RIGA aggiungi ESATTAMENTE questo tag di controllo (non visibile al cliente):
<<<ESCALATE|no|other|>>>
Se serve un operatore umano, metti "yes" e la categoria tra: billing, technical, account, legal, other, con una breve motivazione:
<<<ESCALATE|yes|billing|richiesta rimborso>>>

=== BASE DI CONOSCENZA ADOFF ===
${ADOFF_KB}
${licenseContext ? "\n=== CONTESTO LICENZA CLIENTE ===\n" + licenseContext : ""}`;
}

// Rete di sicurezza deterministica: forza escalation su intenti critici inequivocabili
// (anche se il modello piccolo non emette il sentinel). Multilingua, accent-insensitive.
const FORCE_ESCALATION = [
  { category: "billing", words: ["rimbors", "refund", "ruckerstatt", "rückerstatt", "remboursement", "rembours", "reembols", "chargeback", "doppio addebito", "doppia addebito", "addebitat", "charged twice", "double charge", "charged me twice", "soldi indietro", "money back", "dispute", "contestazione", "fatturazione errata", "wrong charge", "abgebucht", "doble cargo", "cobrado dos veces"] },
  { category: "legal",   words: ["gdpr", "cancella i miei dati", "cancellare i miei dati", "delete my data", "delete my account data", "right to erasure", "diritto all'oblio", "dati personali", "donnees personnelles", "datos personales", "data protection", "legal action", "avvocato", "lawyer", "denuncia"] },
  { category: "account", words: ["parlare con un operatore", "parlare con una persona", "voglio un operatore", "operatore umano", "talk to a human", "speak to a human", "speak to someone", "real person", "human agent", "agent humain", "parler a un humain", "hablar con una persona", "agente humano", "mit einem menschen", "echte person"] },
];
function detectForceEscalation(message) {
  const m = (message || "").toLowerCase();
  for (const rule of FORCE_ESCALATION) {
    if (rule.words.some(w => m.includes(w))) return rule.category;
  }
  return null;
}

// Sanifica i link: consenti adoff.app e gli store ufficiali (canonicalizzati per
// correggere ID/path allucinati). Qualsiasi altro URL -> pagina installazione.
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch (e) { return ""; }
}
// host store -> URL canonico esatto (corregge eventuali ID/path inventati dal modello)
const STORE_CANONICAL = {
  "chromewebstore.google.com": "https://chromewebstore.google.com/detail/fcjfpfhdcpbjmihiikbblcokmjnhedhp",
  "chrome.google.com":         "https://chromewebstore.google.com/detail/fcjfpfhdcpbjmihiikbblcokmjnhedhp",
  "addons.mozilla.org":        "https://addons.mozilla.org/firefox/addon/adoff/",
  // Edge non ancora pubblicato -> instrada alla pagina installazione (evita 404)
  "microsoftedge.microsoft.com": "https://adoff.app/install",
};
function canonicalUrl(url) {
  const h = hostOf(url);
  if (h === "adoff.app") return url;
  if (STORE_CANONICAL[h]) return STORE_CANONICAL[h];
  return "https://adoff.app/install";
}
function sanitizeReplyLinks(text) {
  if (!text) return text;
  // rimuovi autolink markdown <url> che lasciano parentesi angolari visibili
  text = text.replace(/<(https?:\/\/[^>\s]+)>?/g, "$1");
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
    return `[${label}](${canonicalUrl(url)})`;
  });
  text = text.replace(/(https?:\/\/[^\s)<]+)/g, function (url) {
    return canonicalUrl(url);
  });
  return text;
}

// Rete deterministica brand-policy: il modello piccolo a volte nomina le piattaforme
// di contenuti di cui AdOff blocca le pubblicita' (es. "YouTube") invece dei termini
// generici. Qui le sostituiamo a valle, nella lingua della risposta. NON tocca i
// browser/store ufficiali (Chrome, Edge, Firefox, Safari, Opera) ne' gli URL (gia'
// canonicalizzati da sanitizeReplyLinks, che gira prima).
const BRAND_GENERIC_TERMS = {
  it: { video: "le piattaforme di video streaming", social: "i social media", live: "le piattaforme di live streaming", forum: "i forum", search: "i motori di ricerca", ecom: "i siti di e-commerce" },
  en: { video: "video streaming platforms", social: "social media", live: "live streaming platforms", forum: "forums", search: "search engines", ecom: "e-commerce sites" },
  de: { video: "Video-Streaming-Plattformen", social: "soziale Medien", live: "Live-Streaming-Plattformen", forum: "Foren", search: "Suchmaschinen", ecom: "E-Commerce-Seiten" },
  fr: { video: "les plateformes de streaming video", social: "les reseaux sociaux", live: "les plateformes de live streaming", forum: "les forums", search: "les moteurs de recherche", ecom: "les sites e-commerce" },
  es: { video: "las plataformas de video streaming", social: "las redes sociales", live: "las plataformas de live streaming", forum: "los foros", search: "los motores de busqueda", ecom: "los sitios de e-commerce" },
  pt: { video: "as plataformas de video streaming", social: "as redes sociais", live: "as plataformas de live streaming", forum: "os foruns", search: "os motores de busca", ecom: "os sites de e-commerce" },
};
const BRAND_PATTERNS = [
  { re: /\byou\s?tube\b/gi, key: "video" },
  { re: /\bnetflix\b/gi, key: "video" },
  { re: /\bvimeo\b/gi, key: "video" },
  { re: /\bdailymotion\b/gi, key: "video" },
  { re: /\btwitch\b/gi, key: "live" },
  { re: /\b(facebook|instagram|tik\s?tok|snapchat|linkedin|pinterest)\b/gi, key: "social" },
  { re: /\b(twitter|\bx\.com\b)\b/gi, key: "social" },
  { re: /\breddit\b/gi, key: "forum" },
  { re: /\bamazon\b/gi, key: "ecom" },
];
function sanitizeBrandNames(text, lang) {
  if (!text) return text;
  const terms = BRAND_GENERIC_TERMS[lang] || BRAND_GENERIC_TERMS.en;
  for (const { re, key } of BRAND_PATTERNS) {
    text = text.replace(re, terms[key]);
  }
  return text;
}

function parseEscalation(rawReply) {
  let escalate = false, category = "other", reason = "";
  // Match tollerante: cattura flag+categoria+motivo anche con sentinel malformato
  const flag = rawReply.match(/ESCALATE\s*\|\s*(yes|no)\s*\|\s*([a-z]+)\s*\|?\s*([^\n>]*)/i);
  if (flag) {
    escalate = flag[1].toLowerCase() === "yes";
    category = (flag[2] || "other").toLowerCase();
    reason = (flag[3] || "").replace(/>+/g, "").trim();
  }
  // Rimuovi l'intero blocco sentinel (dal primo marcatore alla fine), ben o mal formato
  let reply = rawReply
    .replace(/\s*<{2,}\s*ESCALATE[\s\S]*$/i, "")
    .replace(/\s*ESCALATE\s*\|[\s\S]*$/i, "")
    .replace(/<{2,}|>{2,}/g, "")
    .trim();
  return { reply, escalate, category, reason };
}

async function callLocalLLM(messages, env) {
  const url = env.LLM_API_URL;
  const key = env.LLM_API_KEY;
  if (!url || !key) return { ok: false, error: "LLM not configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  // Header base: master key LiteLLM. Se sono configurati i secret Cloudflare Access
  // (service token), aggiungili per superare il layer Zero Trust sull'endpoint LLM.
  // Condizionale: prima dell'attivazione di Access l'endpoint resta raggiungibile con la sola key.
  const headers = { "Authorization": "Bearer " + key, "Content-Type": "application/json" };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: env.LLM_MODEL || "fast-max",
        messages,
        max_tokens: CHAT_MAX_TOKENS,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: "LLM HTTP " + res.status };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "Empty LLM response" };
    return { ok: true, content };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e.name === "AbortError" ? "LLM timeout" : e.message };
  }
}

// Lookup best-effort dello stato licenza per email (contesto per il bot)
async function buildLicenseContext(email, env) {
  if (!email || !EMAIL_RE.test(email)) return "";
  try {
    const keys = await kvGet(env.ADOFF_LICENSES, `email:${email.toLowerCase().trim()}`, "json");
    if (!keys || keys.length === 0) return `Email ${email}: nessuna licenza trovata (forse utente Free o trial).`;
    const last = keys[keys.length - 1];
    const lic = await kvGet(env.ADOFF_LICENSES, `lic:${last.raw}`, "json");
    if (!lic) return `Email ${email}: licenza presente.`;
    const status = lic.revoked ? "REVOCATA" : (lic.expires === 0 ? "Lifetime attiva" : (lic.expires * 1000 > Date.now() ? "attiva" : "SCADUTA"));
    return `Email ${email}: piano ${lic.plan}, stato ${status}, dispositivi max ${lic.deviceLimit}.`;
  } catch (_) {
    return "";
  }
}

const CHAT_FALLBACK_MSG = {
  it: "Il nostro assistente AI non e' al momento disponibile. Lascia il tuo messaggio e il nostro team ti rispondera' via email al piu' presto.",
  en: "Our AI assistant is currently unavailable. Leave your message and our team will reply by email as soon as possible.",
  de: "Unser KI-Assistent ist derzeit nicht verfugbar. Hinterlasse deine Nachricht und unser Team antwortet dir per E-Mail.",
  fr: "Notre assistant IA est momentanement indisponible. Laissez votre message, notre equipe vous repondra par email.",
  es: "Nuestro asistente de IA no esta disponible ahora. Deja tu mensaje y nuestro equipo te respondera por email.",
  pt: "O nosso assistente de IA esta indisponivel. Deixe a sua mensagem e a nossa equipa respondera por email.",
};
const CHAT_NEED_EMAIL_MSG = {
  it: "Per inoltrare la tua richiesta a un operatore ho bisogno della tua email. Puoi indicarmela?",
  en: "To forward your request to a human agent I need your email. Could you share it?",
  de: "Um deine Anfrage an einen Mitarbeiter weiterzuleiten, brauche ich deine E-Mail. Kannst du sie angeben?",
  fr: "Pour transmettre votre demande a un agent, j'ai besoin de votre email. Pouvez-vous l'indiquer ?",
  es: "Para enviar tu solicitud a un agente necesito tu email. Puedes indicarmelo?",
  pt: "Para encaminhar o teu pedido a um agente preciso do teu email. Podes indica-lo?",
};
const CHAT_ESCALATED_MSG = {
  it: "Ho inoltrato la tua richiesta al nostro team: riceverai una risposta via email.",
  en: "I have forwarded your request to our team: you'll receive a reply by email.",
  de: "Ich habe deine Anfrage an unser Team weitergeleitet: du erhaltst eine Antwort per E-Mail.",
  fr: "J'ai transmis votre demande a notre equipe : vous recevrez une reponse par email.",
  es: "He enviado tu solicitud a nuestro equipo: recibiras una respuesta por email.",
  pt: "Encaminhei o teu pedido a nossa equipa: receberas uma resposta por email.",
};

// --- Hardening & logging chat ---
const CHAT_RL_PER_MIN = 8;
const CHAT_RL_PER_DAY = 80;
const CHAT_SESSION_MSG_CAP = 30;     // max messaggi utente per sessione
const CHATLOG_TTL = 7776000;          // 90 giorni
const CHATLOG_INDEX_MAX = 1000;

// Rate-limit dedicato alla chat (per-minuto + per-giorno, per IP)
async function checkChatRateLimit(ip, env) {
  const now = Date.now();
  const minKey = `crl:m:${ip}:${Math.floor(now / 60000)}`;
  const dayKey = `crl:d:${ip}:${Math.floor(now / 86400000)}`;
  const [mc, dc] = await Promise.all([
    env.ADOFF_LICENSES.get(minKey).then(v => parseInt(v || "0")),
    env.ADOFF_LICENSES.get(dayKey).then(v => parseInt(v || "0")),
  ]);
  if (mc >= CHAT_RL_PER_MIN || dc >= CHAT_RL_PER_DAY) return false;
  await Promise.all([
    env.ADOFF_LICENSES.put(minKey, String(mc + 1), { expirationTtl: 60 }),
    env.ADOFF_LICENSES.put(dayKey, String(dc + 1), { expirationTtl: 86400 }),
  ]);
  return true;
}

// Anti prompt-injection: pattern di jailbreak/uso improprio noti
const INJECTION_RE = /(ignore\s+(all\s+|the\s+)?(previous|above|prior)\s+(instructions|prompts)|disregard\s+(the\s+|all\s+)?(previous|above)|reveal\s+(your\s+)?(instructions|system\s*prompt|prompt)|show\s+me\s+(your\s+)?(system\s*)?prompt|you\s+are\s+now|act\s+as\s+(an?\s+)?(dan|jailbreak)|developer\s+mode|do\s+anything\s+now|ignora\s+(le\s+|tutte\s+le\s+)?(istruzioni|indicazioni)|dimentica\s+(le\s+)?istruzioni|sei\s+ora\s+un|mostrami\s+(il\s+)?(tuo\s+)?prompt|stampa\s+le\s+istruzioni|ignoriere\s+(die\s+)?anweisungen|ignore[zr]\s+les\s+instructions|ignora\s+las\s+instrucciones)/i;
function looksLikeInjection(msg) { return INJECTION_RE.test(msg || ""); }

const CHAT_DEFLECT_MSG = {
  it: "Posso aiutarti solo con domande sul supporto di AdOff. Come posso esserti utile?",
  en: "I can only help with AdOff support questions. How can I help?",
  de: "Ich kann nur bei Fragen zum AdOff-Support helfen. Wie kann ich helfen?",
  fr: "Je ne peux aider que pour les questions de support AdOff. Comment puis-je aider ?",
  es: "Solo puedo ayudar con preguntas de soporte de AdOff. En que puedo ayudarte?",
  pt: "So posso ajudar com perguntas de suporte do AdOff. Como posso ajudar?",
};
const CHAT_RL_MSG = {
  it: "Troppi messaggi in poco tempo. Attendi qualche istante e riprova.",
  en: "Too many messages in a short time. Please wait a moment and try again.",
  de: "Zu viele Nachrichten in kurzer Zeit. Bitte kurz warten und erneut versuchen.",
  fr: "Trop de messages en peu de temps. Patientez un instant et reessayez.",
  es: "Demasiados mensajes en poco tiempo. Espera un momento e intentalo de nuevo.",
  pt: "Demasiadas mensagens em pouco tempo. Aguarda um momento e tenta de novo.",
};
const CHAT_CAP_MSG = {
  it: "Questa conversazione e' molto lunga. Per un aiuto piu' approfondito apri una richiesta dalla pagina di supporto.",
  en: "This conversation is quite long. For deeper help please open a request from the support page.",
  de: "Dieses Gesprach ist sehr lang. Fur weitere Hilfe offne bitte eine Anfrage auf der Supportseite.",
  fr: "Cette conversation est tres longue. Pour une aide approfondie, ouvrez une demande sur la page de support.",
  es: "Esta conversacion es muy larga. Para mas ayuda abre una solicitud en la pagina de soporte.",
  pt: "Esta conversa e muito longa. Para mais ajuda abre um pedido na pagina de suporte.",
};

// Logging persistente conversazioni (retention 90gg) + indice per pannello admin
async function logChat(sessionId, lang, history, meta, env) {
  try {
    const updatedAt = Date.now();
    const rec = { sessionId, lang, updatedAt, escalated: !!meta.escalated, ticketId: meta.ticketId || "", email: meta.email || "", messages: history };
    await env.ADOFF_LICENSES.put(`chatlog:${sessionId}`, JSON.stringify(rec), { expirationTtl: CHATLOG_TTL });
    let idx = await kvGet(env.ADOFF_LICENSES, "chatlog:index", "json") || [];
    if (!Array.isArray(idx)) idx = [];
    const firstUser = history.find(m => m.role === "user");
    const entry = {
      sessionId, lang, updatedAt,
      msgCount: history.filter(m => m.role === "user").length,
      escalated: rec.escalated, ticketId: rec.ticketId, email: rec.email,
      preview: firstUser ? String(firstUser.content).slice(0, 80) : "",
    };
    const at = idx.findIndex(x => x.sessionId === sessionId);
    if (at >= 0) idx[at] = entry; else idx.unshift(entry);
    if (idx.length > CHATLOG_INDEX_MAX) idx.length = CHATLOG_INDEX_MAX;
    await env.ADOFF_LICENSES.put("chatlog:index", JSON.stringify(idx));
  } catch (_) { /* logging best-effort */ }
}

async function handleChat(body, request, env) {
  const lang = CHAT_LANGS.includes(body.lang) ? body.lang : "en";
  const ip = request ? (request.headers.get("CF-Connecting-IP") || "0.0.0.0") : "0.0.0.0";

  // Rate-limit dedicato chat
  if (!await checkChatRateLimit(ip, env)) {
    return jsonResponse({ ok: true, reply: CHAT_RL_MSG[lang], rateLimited: true }, 429);
  }

  // sessionId: valida o genera
  let sessionId = body.sessionId;
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    sessionId = Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > CHAT_MAX_MESSAGE) {
    return jsonResponse({ ok: false, error: "Invalid message" }, 400);
  }
  const email = (typeof body.email === "string" && EMAIL_RE.test(body.email.trim())) ? body.email.trim().toLowerCase() : "";

  // Carica storia sessione
  const sessKey = `chat:${sessionId}`;
  let history = await kvGet(env.ADOFF_LICENSES, sessKey, "json") || [];
  if (!Array.isArray(history)) history = [];

  const isNewSession = history.length === 0;

  // Anti-bot: Turnstile come verifica PREFERITA sul primo messaggio (sessione nuova),
  // ma NON bloccante: se il token e' presente lo validiamo; se valido la sessione e'
  // "verificata". Se il widget Turnstile fallisce/va in timeout lato browser (es. errore
  // 600010) il client invia senza token: la chat deve comunque rispondere, protetta da
  // rate-limit per IP (8/min, 80/giorno) + anti-injection + cap sessione gia' attivi.
  // L'estensione invia "extension" (esente). Le sessioni esistenti sono fidate.
  const token = body.turnstileToken;
  if (isNewSession && token && token !== "extension") {
    // Token fornito ma NON valido (manomesso/scaduto) -> chiediamo di riverificare.
    if (!await verifyTurnstile(token, ip, env)) {
      return jsonResponse({ ok: false, error: "verification_required", needVerification: true }, 403);
    }
  }

  // Anti prompt-injection: deflette senza chiamare il LLM (risparmia budget + sicuro)
  if (looksLikeInjection(message)) {
    return jsonResponse({ ok: true, sessionId, reply: CHAT_DEFLECT_MSG[lang] });
  }

  // Cap messaggi per sessione (anti-abuso conversazionale)
  const userMsgCount = history.filter(m => m.role === "user").length;
  if (userMsgCount >= CHAT_SESSION_MSG_CAP) {
    return jsonResponse({ ok: true, sessionId, reply: CHAT_CAP_MSG[lang], capped: true });
  }

  // Contesto licenza (se email fornita)
  const licenseContext = email ? await buildLicenseContext(email, env) : "";

  // Costruisci messaggi per il LLM
  const messages = [
    { role: "system", content: buildSupportSystemPrompt(lang, licenseContext) },
    ...history.slice(-CHAT_HISTORY_KEEP),
    { role: "user", content: message },
  ];

  const llm = await callLocalLLM(messages, env);

  // Fallback: LLM non disponibile -> il client mostra il form ticket
  if (!llm.ok) {
    return jsonResponse({ ok: true, sessionId, fallback: true, reply: CHAT_FALLBACK_MSG[lang] });
  }

  let { reply, escalate, category, reason } = parseEscalation(llm.content);

  // Rete di sicurezza: forza escalation su intenti critici (il modello piccolo puo' non emettere il sentinel)
  const forced = detectForceEscalation(message);
  if (forced) {
    escalate = true;
    category = forced;
    if (!reason) reason = "auto: intento critico rilevato (" + forced + ")";
  }

  // Difesa anti-allucinazione: neutralizza ogni URL non-adoff.app
  reply = sanitizeReplyLinks(reply);
  // Brand-policy: sostituisci i nomi delle piattaforme di contenuti con termini generici
  reply = sanitizeBrandNames(reply, lang);

  // Aggiorna e salva storia
  history.push({ role: "user", content: message });
  history.push({ role: "assistant", content: reply });
  if (history.length > CHAT_HISTORY_KEEP) history = history.slice(-CHAT_HISTORY_KEEP);
  await env.ADOFF_LICENSES.put(sessKey, JSON.stringify(history), { expirationTtl: CHAT_SESSION_TTL });

  // Escalation a operatore umano (caso straordinario)
  if (escalate) {
    if (!email) {
      // Serve l'email per poter rispondere
      await logChat(sessionId, lang, history, { escalated: false, email }, env);
      return jsonResponse({ ok: true, sessionId, escalate: true, needEmail: true, reply: CHAT_NEED_EMAIL_MSG[lang] });
    }
    // Crea ticket dalla conversazione + notifica Telegram
    const transcript = history.map(m => (m.role === "user" ? "Utente" : "AI") + ": " + m.content).join("\n");
    const ticket = await createTicketFromChat({
      category: ["billing", "technical", "account", "legal", "other"].includes(category) ? category : "other",
      email,
      lang,
      reason,
      transcript,
      sessionId,
    }, env);
    await logChat(sessionId, lang, history, { escalated: true, ticketId: ticket.ticketId, email }, env);
    return jsonResponse({
      ok: true,
      sessionId,
      escalate: true,
      ticketId: ticket.ticketId,
      reply: reply + "\n\n" + CHAT_ESCALATED_MSG[lang],
    });
  }

  await logChat(sessionId, lang, history, { escalated: false, email }, env);
  return jsonResponse({ ok: true, sessionId, reply });
}

// =============================================
// ADMIN: storico conversazioni chatbot
// =============================================

async function handleAdminListChats(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const idx = await kvGet(env.ADOFF_LICENSES, "chatlog:index", "json") || [];
  return jsonResponse({ ok: true, chats: idx, total: idx.length });
}

async function handleAdminGetChat(request, env, sessionId) {
  if (!/^[a-f0-9]{32}$/.test(sessionId)) {
    return jsonResponse({ ok: false, error: "Invalid session id" }, 400);
  }
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const rec = await kvGet(env.ADOFF_LICENSES, `chatlog:${sessionId}`, "json");
  if (!rec) return jsonResponse({ ok: false, error: "Not found" }, 404);
  return jsonResponse({ ok: true, chat: rec });
}

// Crea un ticket a partire da una conversazione chat escalata
async function createTicketFromChat({ category, email, lang, reason, transcript, sessionId }, env) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randBytes = crypto.getRandomValues(new Uint8Array(4));
  const rand = Array.from(randBytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const ticketId = `TK-${dateStr}-${rand}`;

  const ticket = {
    id: ticketId,
    category,
    priority: (category === "billing" || category === "legal") ? "high" : "normal",
    name: email.split("@")[0],
    email,
    license: "",
    subject: "[AI escalation] " + (reason || category),
    description: transcript,
    browser: "",
    lang: lang || "en",
    status: "open",
    source: "ai-chat",
    sessionId: sessionId || "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    replies: [],
  };

  await env.ADOFF_LICENSES.put(`ticket:${ticketId}`, JSON.stringify(ticket));
  const index = await kvGet(env.ADOFF_LICENSES, "tickets:index", "json") || [];
  index.unshift({ id: ticketId, category, priority: ticket.priority, subject: ticket.subject, email, status: "open", source: "ai-chat", createdAt: ticket.createdAt });
  if (index.length > 500) index.length = 500;
  await env.ADOFF_LICENSES.put("tickets:index", JSON.stringify(index));
  const count = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_tickets") || "0");
  await env.ADOFF_LICENSES.put("stats:total_tickets", String(count + 1));

  // Notifica Telegram
  const msg = `\u{1F916} <b>Escalation AI → umano</b>\n` +
    `\u{1F3F7} ${escapeHtml(category)} (${ticket.priority})\n` +
    `\u{1F4E7} ${escapeHtml(email)}\n` +
    `\u{1F4DD} ${escapeHtml(reason || "-")}\n` +
    `\u{1F194} <code>${ticketId}</code>\n\n` +
    `<b>Conversazione:</b>\n${escapeHtml(transcript.slice(-2500))}`;
  await notifyTelegram(msg, env);

  return { ticketId };
}

// =============================================
// STRIPE CHECKOUT SESSION
// =============================================

// Prezzi in centesimi EUR. Piano UNICO (niente device tiers): la licenza copre
// fino a 3 dispositivi personali. L'Annuale ha prezzo Founder per i primi 100.
const FOUNDER_TOTAL = 100;            // posti Founder totali
const ANNUAL_FOUNDER_AMOUNT = 1999;   // €19,99 — primi 100, bloccato a vita
const ANNUAL_STANDARD_AMOUNT = 2499;  // €24,99 — dopo i primi 100
const PRICE_CONFIG = {
  monthly:  { amount: 299,                  plan: "monthly",  recurring: "month", founder: false },
  annual:   { amount: ANNUAL_FOUNDER_AMOUNT, plan: "annual",   recurring: "year",  founder: true  },
  lifetime: { amount: 9900,                 plan: "lifetime", recurring: null,    founder: true  },
};

// Conta i posti Founder REALMENTE occupati (dati reali da D1). Auto-crea la tabella.
// Ritorna un intero, oppure null se il DB non è raggiungibile (trattato come "esaurito" = scelta sicura).
async function getFounderCount(env) {
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS founder_seats (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, plan TEXT, stripe_session_id TEXT UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM founder_seats").first();
    return row ? (row.n || 0) : 0;
  } catch (e) {
    return null;
  }
}

// Endpoint pubblico: stato reale dei posti Founder per il sito (counter X/100 + prezzo annuale).
async function handleFounderStatus(env) {
  const count = await getFounderCount(env);
  const taken = (count === null) ? FOUNDER_TOTAL : count; // DB irraggiungibile => esaurito (scelta sicura)
  const remaining = Math.max(0, FOUNDER_TOTAL - taken);
  return jsonResponse({
    active: remaining > 0,
    taken,
    remaining,
    total: FOUNDER_TOTAL,
    annual_price: ANNUAL_FOUNDER_AMOUNT / 100,
    annual_standard: ANNUAL_STANDARD_AMOUNT / 100,
    currency: "EUR",
  });
}

// Normalizza il numero di dispositivi al tier valido piu' vicino: 3, 5, 10
// Valori 1 o 2 vengono arrotondati a 3 (tier minimo)
function normalizeDevices(raw) {
  const n = parseInt(raw) || 3;
  if (n <= 3) return 3;
  if (n <= 5) return 5;
  return 10;
}

async function handleCreateCheckout(body, env) {
  const { plan, lang, affiliate } = body;
  const priceConfig = PRICE_CONFIG[plan];
  if (!priceConfig) return jsonResponse({ error: "Invalid plan" }, 400);

  const devices = 3; // piano unico: fino a 3 dispositivi personali
  let amount = priceConfig.amount;
  let isFounder = false;
  let productName = "AdOff Pro — " + plan.charAt(0).toUpperCase() + plan.slice(1);

  // Gating Founder AUTHORITATIVE lato server (il prezzo non si fida del client).
  if (plan === "annual" || plan === "lifetime") {
    const count = await getFounderCount(env);
    const seatsLeft = (count === null) ? 0 : Math.max(0, FOUNDER_TOTAL - count);
    if (plan === "annual") {
      if (seatsLeft > 0) { amount = ANNUAL_FOUNDER_AMOUNT; isFounder = true; productName = "AdOff Pro — Annuale (Founder)"; }
      else { amount = ANNUAL_STANDARD_AMOUNT; isFounder = false; productName = "AdOff Pro — Annuale"; }
    } else { // lifetime: offerta Founder a tiratura limitata, ritirata quando i posti finiscono
      if (seatsLeft <= 0) return jsonResponse({ error: "Founder Lifetime offer is sold out." }, 409);
      isFounder = true; productName = "AdOff Founder Lifetime";
    }
  }

  const isRecurring = priceConfig.recurring !== null;
  const params = new URLSearchParams();

  // Usa price_data inline — prezzo deciso server-side (founder gating), nessuno sconto
  params.append("line_items[0][price_data][currency]", "eur");
  params.append("line_items[0][price_data][unit_amount]", String(amount));
  params.append("line_items[0][price_data][product_data][name]", productName);
  if (isRecurring) {
    params.append("line_items[0][price_data][recurring][interval]", priceConfig.recurring);
    params.append("line_items[0][price_data][recurring][interval_count]", "1");
  }
  params.append("line_items[0][quantity]", "1");
  params.append("mode", isRecurring ? "subscription" : "payment");
  params.append("success_url", "https://adoff.app/success?session_id={CHECKOUT_SESSION_ID}");
  params.append("cancel_url", "https://adoff.app/#pricing");
  params.append("custom_text[submit][message]", "AdOff Pro — Ads? Off!");

  // Lingua checkout — sincronizzata con la lingua selezionata sul sito
  const STRIPE_LOCALES = ['auto','bg','cs','da','de','el','en','es','et','fi','fil','fr','hr','hu','id','it','ja','ko','lt','lv','ms','mt','nb','nl','pl','pt','ro','ru','sk','sl','sv','th','tr','vi','zh'];
  if (lang && STRIPE_LOCALES.indexOf(lang) !== -1) {
    params.append("locale", lang);
  }

  // Metadata: piano, dispositivi e flag Founder come source of truth per il webhook
  params.append("metadata[plan]", plan);
  params.append("metadata[devices]", String(devices));
  params.append("metadata[founder]", isFounder ? "1" : "0");
  if (affiliate) {
    params.append("metadata[affiliate]", affiliate);
    // client_reference_id e' utile per riconciliazione automatica in Stripe
    params.append("client_reference_id", affiliate);
  }
  // Attribution: source-tagged conversions (independent of affiliate)
  const source = body.source;
  if (source && /^src-[a-z0-9_]{2,20}$/.test(source)) {
    params.append("metadata[source]", source);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(env.STRIPE_SECRET_KEY + ":"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const session = await res.json();
  if (session.error) return jsonResponse({ error: session.error.message }, 400);
  return jsonResponse({ url: session.url });
}

// =============================================
// STRIPE WEBHOOK
// =============================================

async function verifyStripeSignature(body, sigHeader, secret) {
  if (!sigHeader || !secret) return false;

  const parts = {};
  for (const item of sigHeader.split(",")) {
    const [key, val] = item.split("=");
    parts[key.trim()] = val;
  }

  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  // Protegge da replay attack: rifiuta webhook piu' vecchi di 5 minuti
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;

  // Calcola firma HMAC-SHA256 con payload = timestamp.body
  const signedPayload = timestamp + "." + body;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Confronto costante per prevenire timing attack
  // Paddiamo entrambe a 64 chars (SHA-256 hex) prima del confronto
  const SIG_LEN = 64;
  const computedPadded = computed.padEnd(SIG_LEN, "\0");
  const expectedPadded = expectedSig.padEnd(SIG_LEN, "\0");
  let mismatch = 0;
  for (let i = 0; i < SIG_LEN; i++) {
    mismatch |= computedPadded.charCodeAt(i) ^ expectedPadded.charCodeAt(i);
  }
  return mismatch === 0;
}

async function handleStripeWebhook(request, env) {
  const body = await request.text();
  const sig = request.headers.get("Stripe-Signature");

  // Verifica firma webhook Stripe (OBBLIGATORIO — secret mancante = errore di configurazione)
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }
  const valid = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const type = event.type;

  if (type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email || "";
    const amount = session.amount_total || 0;

    // Determina piano: prima da metadata.plan (source of truth), poi da price ranges
    let plan = session.metadata?.plan || null;
    if (!plan) {
      const PLAN_PRICE_RANGES = [
        { plan: "monthly",  minCents: 1,    maxCents: 699  },
        { plan: "annual",   minCents: 700,  maxCents: 6999 },
        { plan: "lifetime", minCents: 7000, maxCents: Infinity },
      ];
      for (const range of PLAN_PRICE_RANGES) {
        if (amount >= range.minCents && amount <= range.maxCents) {
          plan = range.plan;
          break;
        }
      }
    }
    if (!plan) plan = "pro"; // ultimo fallback sicuro

    // Affiliazione
    const affiliateId = session.metadata?.affiliate || session.client_reference_id || null;
    if (affiliateId) {
      if (affiliateId.startsWith("ADO-")) {
        // Flusso "Invita Amici": accredita 15 giorni al referrer
        await creditReferralFriend(affiliateId, email, env, session.id);
      } else {
        // Flusso "Partner Affiliato": esistente
        const currency = session.currency || "eur";
        await registerReferral(affiliateId, email, session.id, amount, currency, env);
      }
    }

    // Attribution: register paid conversion by source (independent of affiliate)
    const attrSource = session.metadata?.source;
    if (attrSource && /^src-[a-z0-9_]{2,20}$/.test(attrSource)) {
      await bumpAttributionCounter(env, "paid:" + attrSource, 1);
      await bumpAttributionCounter(env, "revenue:" + attrSource, amount);
    }

    // Revenue stats for the admin Finance dashboard (total sold, daily/per-plan revenue, MRR).
    await bumpRevenueStats(env, amount, plan);

    // Numero dispositivi: da metadata.devices (source of truth), default 3
    const devices = parseInt(session.metadata?.devices) || 3;
    const PLAN_MONTHS = { monthly: 1, annual: 12, lifetime: 0 };
    let months = PLAN_MONTHS[plan] !== undefined ? PLAN_MONTHS[plan] : 1;

    // Genera license key
    const now = Math.floor(Date.now() / 1000);
    const expires = plan === "lifetime" ? 0 : now + (months * 30 * 86400);
    const payload = { c: now, d: devices, e: email, p: plan, v: 1, x: expires };
    const payloadJson = JSON.stringify(payload);

    // Base64 encode
    const payloadB64 = btoa(payloadJson)
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // HMAC signature
    const signature = await hmacSign(payloadB64, env.ADOFF_SECRET);
    const raw = payloadB64 + signature;

    // Key leggibile
    const keyHash = await hmacSign(raw, env.ADOFF_SECRET);
    const kh = keyHash.toUpperCase();
    const key = "ADOFF-" + kh.slice(0,4) + "-" + kh.slice(4,8) + "-" + kh.slice(8,12);

    // BM-7: usa current_period_end da Stripe se disponibile (subscription)
    // invece di calcolare mesi * 30 giorni
    const subscription = session.subscription;
    let finalExpires = expires;
    if (subscription && plan !== "lifetime") {
      try {
        const subRes = await fetch("https://api.stripe.com/v1/subscriptions/" + subscription, {
          headers: { "Authorization": "Basic " + btoa(env.STRIPE_SECRET_KEY + ":") },
        });
        const subData = await subRes.json();
        if (subData.current_period_end) {
          finalExpires = subData.current_period_end; // gia' unix timestamp
        }
      } catch (_) {
        // Fallback al calcolo manuale se Stripe non risponde
      }
    }

    const customerId = session.customer || "";

    // Salva nel KV
    await env.ADOFF_LICENSES.put(`lic:${raw}`, JSON.stringify({
      key,
      raw,
      plan,
      email,
      expires: finalExpires,
      deviceLimit: devices,
      devices: [],
      createdAt: Date.now(),
      stripeSessionId: session.id,
      stripeCustomerId: customerId,
    }));

    // Salva mapping key->raw per lookup
    await env.ADOFF_LICENSES.put(`key:${key}`, raw);

    // Founder seat — conta gli abbonati Founder REALI (annuale a prezzo Founder o Founder Lifetime).
    // stripe_session_id UNIQUE → idempotente sui webhook ritentati.
    if (session.metadata?.founder === "1") {
      try {
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS founder_seats (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, plan TEXT, stripe_session_id TEXT UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
        await env.DB.prepare("INSERT OR IGNORE INTO founder_seats (email, plan, stripe_session_id) VALUES (?, ?, ?)")
          .bind(email, plan, session.id).run();
      } catch (_) { /* non bloccare l'emissione licenza se il conteggio fallisce */ }
    }

    // Sale record keyed by payment_intent — abilita lo storno accurato sui rimborsi.
    const _saleId = session.payment_intent || session.id;
    await env.ADOFF_LICENSES.put(`sale:${_saleId}`, JSON.stringify({
      amount, plan, date: new Date().toISOString().slice(0, 10),
      raw, key, email, affiliateId: affiliateId || null,
      sessionId: session.id, refunded: false,
    }));

    // BA-4: Indice customer->keys per revoke O(1)
    if (customerId) {
      const custKeys = await kvGet(env.ADOFF_LICENSES, `customer:${customerId}`, "json") || [];
      custKeys.push(raw);
      await env.ADOFF_LICENSES.put(`customer:${customerId}`, JSON.stringify(custKeys));
    }

    // BA-6: Indice expiry per cron O(1)
    if (finalExpires > 0) {
      const expiryDate = new Date(finalExpires * 1000).toISOString().slice(0, 10).replace(/-/g, "");
      const expiryList = await kvGet(env.ADOFF_LICENSES, `expiry:${expiryDate}`, "json") || [];
      expiryList.push(raw);
      await env.ADOFF_LICENSES.put(`expiry:${expiryDate}`, JSON.stringify(expiryList));
    }

    // Salva mapping email->keys
    const existingKeys = await kvGet(env.ADOFF_LICENSES, `email:${email}`, "json") || [];
    existingKeys.push({ key, raw, plan, created: Date.now() });
    await env.ADOFF_LICENSES.put(`email:${email}`, JSON.stringify(existingKeys));

    // Incrementa contatore vendite per tier pricing
    const currentSold = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_sold") || "0");
    await env.ADOFF_LICENSES.put("stats:total_sold", String(currentSold + 1));

    // Auto-creazione account e invio email attivazione
    if (email) {
      const normalEmail = email.toLowerCase().trim();
      const userKey = `user:${normalEmail}`;
      let user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
      const nowMs = Date.now();

      if (!user) {
        // Crea nuovo account (senza password — verra' impostata al primo accesso)
        user = {
          email: normalEmail,
          passwordHash: null,
          salt: null,
          emailVerified: false,
          providers: [],
          googleId: null,
          microsoftId: null,
          licenses: [raw],
          createdAt: nowMs,
          lastLogin: null,
          createdVia: "purchase",
        };
      } else {
        // Account esistente — aggiungi licenza se non presente
        if (!user.licenses) user.licenses = [];
        if (!user.licenses.includes(raw)) {
          user.licenses.push(raw);
        }
      }
      await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));

      // Genera token di attivazione (24h)
      const activateBytes = crypto.getRandomValues(new Uint8Array(24));
      const activateToken = Array.from(activateBytes).map(b => b.toString(16).padStart(2, "0")).join("");
      await env.ADOFF_LICENSES.put(
        `account_activate:${activateToken}`,
        JSON.stringify({ email: normalEmail, createdAt: nowMs }),
        { expirationTtl: 86400 }
      );

      // Invia email di attivazione account (NO license key)
      const activateUrl = "https://adoff.app/account/?activate=" + activateToken;
      const tmpl = EMAIL_TEMPLATES.account_activation(activateUrl, plan, devices);
      await sendEmail(normalEmail, tmpl.subject, tmpl.html, env);
    }

    // Notifica vendita su Telegram (thread Vendite & Rimborsi)
    const planLabel = { monthly: "Mensile", annual: "Annuale", lifetime: "Lifetime" }[plan] || plan;
    const saleMsg = `\u{1F4B0} <b>Nuova vendita</b>\n` +
      `\u{1F4B6} ${((amount || 0) / 100).toFixed(2)} ${(session.currency || "eur").toUpperCase()}\n` +
      `\u{1F4E6} ${escapeHtml(planLabel)} · ${devices} dispositiv${devices === 1 ? "o" : "i"}\n` +
      `\u{2709} ${escapeHtml(email || "—")}\n` +
      `\u{1F511} <code>${escapeHtml(key)}</code>` +
      (affiliateId ? `\n\u{1F91D} ref: ${escapeHtml(affiliateId)}` : "");
    await notifyTelegram(saleMsg, env, TELEGRAM_SALES_THREAD);

    return jsonResponse({ ok: true, message: "License created, account activated" });
  }

  if (type === "charge.refunded" || type === "refund.created") {
    // Rimborso — notifica su Telegram (thread Vendite & Rimborsi)
    const obj = event.data.object;
    const isCharge = type === "charge.refunded";
    const amountRefunded = isCharge ? (obj.amount_refunded || 0) : (obj.amount || 0);
    const currency = (obj.currency || "eur").toUpperCase();
    const email = isCharge
      ? (obj.billing_details?.email || obj.receipt_email || "")
      : "";
    const refundMsg = `\u{1F4B8} <b>Rimborso</b>\n` +
      `\u{1F501} ${(amountRefunded / 100).toFixed(2)} ${currency}\n` +
      (email ? `\u{2709} ${escapeHtml(email)}\n` : "") +
      `\u{1F9FE} ${escapeHtml(isCharge ? (obj.id || "") : (obj.charge || obj.id || ""))}`;
    await notifyTelegram(refundMsg, env, TELEGRAM_SALES_THREAD);
    return jsonResponse({ ok: true, message: "Refund notification sent" });
  }

  if (type === "invoice.payment_failed") {
    // Pagamento fallito — notifica via email, NON revocare subito (Stripe riprova)
    const customerEmail = event.data.object.customer_email;
    if (customerEmail) {
      const tmpl = EMAIL_TEMPLATES.payment_failed(customerEmail);
      await sendEmail(customerEmail, tmpl.subject, tmpl.html, env);
    }
    return jsonResponse({ ok: true, message: "Payment failed notification sent" });
  }

  if (type === "customer.subscription.deleted") {
    // Cancellazione abbonamento — revoca licenza + notifica
    const customerId = event.data.object.customer;
    if (customerId) {
      const { revoked, email: revokedEmail } = await revokeByCustomerId(customerId, env, type);
      if (revokedEmail) {
        const tmpl = EMAIL_TEMPLATES.cancelled(revokedEmail);
        await sendEmail(revokedEmail, tmpl.subject, tmpl.html, env);
      }
      return jsonResponse({ ok: true, message: "Revoked " + revoked + " licenses, notification sent" });
    }
    return jsonResponse({ ok: true, message: "No customer ID for " + type });
  }

  if (type === "charge.refunded") {
    // Rimborso — storna il revenue + revoca licenza.
    const charge = event.data.object;
    const customerId = charge.customer;
    const pi = charge.payment_intent;
    let reversed = false;
    if (pi) {
      const sale = await kvGet(env.ADOFF_LICENSES, `sale:${pi}`, "json");
      if (sale && !sale.refunded) {
        await reverseRevenueStats(env, sale.amount, sale.plan, sale.date);
        sale.refunded = true;
        await env.ADOFF_LICENSES.put(`sale:${pi}`, JSON.stringify(sale));
        reversed = true;
        // Marca il referral come rimborsato (se vendita attribuita a un affiliato)
        if (sale.affiliateId && sale.sessionId && env.DB) {
          try {
            await env.DB.prepare("UPDATE referrals SET status='refunded' WHERE stripe_session_id = ?")
              .bind(sale.sessionId).run();
          } catch (e) { /* tabella/record assente: ignora */ }
        }
      } else if (!sale) {
        // Fallback: nessun record vendita (vendita pre-fix) — deduci il piano dall'importo rimborsato.
        const amt = charge.amount_refunded || charge.amount || 0;
        let plan = "monthly";
        if (amt >= 7000) plan = "lifetime"; else if (amt >= 700) plan = "annual";
        if (amt > 0) { await reverseRevenueStats(env, amt, plan, null); reversed = true; }
      }
    }
    let revokedMsg = "";
    if (customerId) {
      const result = await revokeByCustomerId(customerId, env, type);
      revokedMsg = ", revoked " + result.revoked + " licenses";
    }
    return jsonResponse({ ok: true, message: "Refund processed" + (reversed ? ", revenue reversed" : "") + revokedMsg });
  }

  return jsonResponse({ ok: true, message: "Event ignored: " + type });
}

// =============================================
// REVOKE BY CUSTOMER ID
// =============================================

async function revokeByCustomerId(customerId, env, reason) {
  // BA-4: usa indice customer->keys per O(1) invece di listing O(n)
  const rawKeys = await kvGet(env.ADOFF_LICENSES, `customer:${customerId}`, "json");
  let revokedCount = 0;
  let foundEmail = null;

  if (rawKeys && rawKeys.length > 0) {
    // Percorso veloce: usa l'indice
    for (const raw of rawKeys) {
      const data = await kvGet(env.ADOFF_LICENSES, `lic:${raw}`, "json");
      if (data && !data.revoked) {
        data.revoked = true;
        data.revokedAt = Date.now();
        data.revokeReason = reason;
        await env.ADOFF_LICENSES.put(`lic:${raw}`, JSON.stringify(data));
        revokedCount++;
        if (data.email) foundEmail = data.email;
      }
    }
  } else {
    // Fallback: listing completo per licenze create prima dell'indice
    const list = await env.ADOFF_LICENSES.list({ prefix: "lic:" });
    for (const key of list.keys) {
      const data = await kvGet(env.ADOFF_LICENSES, key.name, "json");
      if (data && data.stripeCustomerId === customerId && !data.revoked) {
        data.revoked = true;
        data.revokedAt = Date.now();
        data.revokeReason = reason;
        await env.ADOFF_LICENSES.put(key.name, JSON.stringify(data));
        revokedCount++;
        if (data.email) foundEmail = data.email;
      }
    }
  }

  return { revoked: revokedCount, email: foundEmail };
}

// =============================================
// STRIPE CUSTOMER PORTAL — crea sessione per gestione abbonamento
// =============================================

async function handlePortalSession(request, env) {
  // Estrae customerId: da query param (account già loggato) o da auth session
  const url = new URL(request.url);
  const customerIdFromQuery = url.searchParams.get("customer_id");

  let customerId = customerIdFromQuery;

  // Se non c'è customerId in query, prova a ricavarlo dall'auth session
  if (!customerId) {
    const sessionToken = getSessionToken(request);
    if (sessionToken) {
      const session = await kvGet(env.ADOFF_LICENSES, `session:${sessionToken}`, "json");
      if (session?.customerId) {
        customerId = session.customerId;
      }
    }
  }

  if (!customerId) {
    return jsonResponse({ error: "No customer ID found. Please log in to your account." }, 400);
  }

  // Crea Stripe Customer Portal session
  const returnUrl = url.searchParams.get("return_url") || "https://adoff.app/account";

  const params = new URLSearchParams();
  params.append("customer", customerId);
  params.append("return_url", returnUrl);

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(env.STRIPE_SECRET_KEY + ":"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) {
    return jsonResponse({ error: data.error.message }, 400);
  }

  // Redirect al portale Stripe
  return Response.redirect(data.url, 302);
}

// =============================================
// SUCCESS PAGE (genera la key dalla session)
// =============================================

async function handleSuccess(request, env) {
  const corsHeaders = getCorsHeaders(request);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  // Se abbiamo session_id, recupera email dalla session Stripe
  if (sessionId && env.STRIPE_SECRET_KEY) {
    try {
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions/" + sessionId, {
        headers: { "Authorization": "Basic " + btoa(env.STRIPE_SECRET_KEY + ":") },
      });
      const session = await res.json();
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ ok: false, pending: true }), {
          status: 402,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const email = session.customer_email || session.customer_details?.email;
      if (email) {
        return new Response(JSON.stringify({ ok: true, email }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } catch (e) {
      // Fallback se Stripe non risponde
    }
  }

  return new Response(successHTML(null, "La tua license key e' stata inviata via email. Controlla la posta in arrivo (e lo spam)."), {
    headers: { "Content-Type": "text/html", ...corsHeaders },
  });
}

function successHTML(key, message) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AdOff — Pagamento completato!</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,sans-serif;background:#0a0a1a;color:#fff;min-height:100vh;display:flex;justify-content:center;align-items:center}
  .card{background:#12122a;border:1px solid #2a2a4a;border-radius:16px;padding:40px;max-width:500px;text-align:center}
  h1{font-size:24px;margin-bottom:8px;color:#4ade80}
  .msg{color:#8a8aaa;margin-bottom:24px}
  .key-box{background:#0a0a1a;border:2px solid #4ade80;border-radius:10px;padding:20px;margin:20px 0}
  .key{font-size:24px;font-weight:700;font-family:monospace;color:#4ade80;letter-spacing:3px}
  .raw{font-size:10px;color:#3a3a5a;word-break:break-all;margin-top:12px}
  .btn{background:#7c5cfc;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;margin-top:16px}
  .btn:hover{background:#6a4ce0}
  .instructions{text-align:left;margin-top:24px;padding:16px;background:#1a1a36;border-radius:8px}
  .instructions h3{font-size:14px;margin-bottom:8px;color:#b8a9ff}
  .instructions ol{padding-left:20px;color:#888;font-size:13px;line-height:2}
  .footer{margin-top:20px;font-size:11px;color:#3a3a5a}
</style></head><body>
<div class="card">
  <h1>${key ? 'Pagamento completato!' : 'Grazie!'}</h1>
  <p class="msg">${message || 'Ecco la tua license key AdOff Pro:'}</p>
  ${key ? `
  <div class="key-box">
    <div class="key" id="licenseKey">${key}</div>
  </div>
  <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('licenseKey').textContent);this.textContent='Copiata!'">Copia License Key</button>
  <div class="instructions">
    <h3>Come attivare:</h3>
    <ol>
      <li>Apri il popup AdOff (icona nella toolbar)</li>
      <li>Clicca "Opzioni" in basso</li>
      <li>Vai alla sezione "Licenza"</li>
      <li>Incolla la key e clicca "Attiva"</li>
    </ol>
  </div>` : ''}
  <div class="footer">AdOff — Ads? Off!</div>
</div>
</body></html>`;
}

async function handleHealth() {
  return jsonResponse({
    status: "ok",
    service: "AdOff License API",
    timestamp: new Date().toISOString(),
  });
}

// =============================================
// ADMIN — LOGIN WITH USERNAME/PASSWORD
// =============================================

async function handleAdminLogin(body, env) {
  const { username, password } = body;
  if (!username || !password) {
    return jsonResponse({ ok: false, error: "Missing credentials" }, 400);
  }

  // Get admin account from KV (or create default on first use)
  let admin = await kvGet(env.ADOFF_LICENSES, "admin:account", "json");
  if (!admin) {
    // First login ever — create admin account with ADMIN_TOKEN as default password
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
    const hash = await hashPasswordPBKDF2(env.ADMIN_TOKEN, saltHex);
    admin = {
      username: "admin",
      passwordHash: hash,
      salt: saltHex,
      email: "",
      createdAt: Date.now(),
    };
    await env.ADOFF_LICENSES.put("admin:account", JSON.stringify(admin));
  }

  // Verify credentials
  if (username !== admin.username) {
    return jsonResponse({ ok: false, error: "Invalid credentials" }, 401);
  }

  if (!await verifyPassword(password, admin.salt, admin.passwordHash)) {
    return jsonResponse({ ok: false, error: "Invalid credentials" }, 401);
  }

  // Upgrade trasparente: ri-hash a PBKDF2 se l'hash memorizzato è legacy SHA-256
  if (isLegacyPasswordHash(admin.passwordHash)) {
    admin.passwordHash = await hashPasswordPBKDF2(password, admin.salt);
    await env.ADOFF_LICENSES.put("admin:account", JSON.stringify(admin));
  }

  // Generate session token (valid 24h)
  const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const session = {
    token: sessionToken,
    username: admin.username,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
  };
  await env.ADOFF_LICENSES.put("session:" + sessionToken, JSON.stringify(session), {
    expirationTtl: 86400, // auto-delete after 24h
  });

  return jsonResponse({
    ok: true,
    token: sessionToken,
    expiresIn: "24h",
  });
}

async function handleAdminChangePassword(body, env, request) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  // Accept either session token or legacy ADMIN_TOKEN
  const isAuth = await verifyAdminAuth(adminToken, env);
  if (!isAuth) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const { currentPassword, newPassword, email } = body;

  let admin = await kvGet(env.ADOFF_LICENSES, "admin:account", "json");
  if (!admin) return jsonResponse({ ok: false, error: "No admin account" }, 500);

  // Update password if provided
  if (newPassword) {
    if (!currentPassword && adminToken !== env.ADMIN_TOKEN) {
      return jsonResponse({ ok: false, error: "Current password required" }, 400);
    }
    if (currentPassword) {
      if (!await verifyPassword(currentPassword, admin.salt, admin.passwordHash)) {
        return jsonResponse({ ok: false, error: "Current password incorrect" }, 401);
      }
    }
    if (newPassword.length < 8) {
      return jsonResponse({ ok: false, error: "Password must be at least 8 characters" }, 400);
    }
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    admin.passwordHash = await hashPasswordPBKDF2(newPassword, salt);
    admin.salt = salt;
  }

  // Update email if provided
  if (email !== undefined) {
    admin.email = email;
  }

  await env.ADOFF_LICENSES.put("admin:account", JSON.stringify(admin));
  return jsonResponse({ ok: true, message: "Account updated" });
}

async function handleAdminResetPassword(body, env) {
  const { email } = body;
  if (!email) return jsonResponse({ ok: false, error: "Email required" }, 400);

  const admin = await kvGet(env.ADOFF_LICENSES, "admin:account", "json");
  if (!admin || !admin.email || admin.email !== email) {
    // Don't reveal if email exists
    return jsonResponse({ ok: true, message: "If the email is registered, a reset link has been sent" });
  }

  // Generate reset token
  const resetToken = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  await env.ADOFF_LICENSES.put("reset:" + resetToken, JSON.stringify({
    username: admin.username,
    createdAt: Date.now(),
  }), { expirationTtl: 3600 }); // 1h expiry

  // Send email
  const resetUrl = "https://adoff.app/mgmt-9f4a/?reset=" + resetToken;
  const html = emailTemplate(
    "Password Reset",
    "Click the button below to reset your admin password. This link expires in 1 hour.",
    "Reset Password",
    resetUrl
  );
  await sendEmail(email, "AdOff Admin — Password Reset", html, env);

  return jsonResponse({ ok: true, message: "If the email is registered, a reset link has been sent" });
}

async function handleAdminResetConfirm(body, env) {
  const { resetToken, newPassword } = body;
  if (!resetToken || !newPassword) {
    return jsonResponse({ ok: false, error: "Missing token or password" }, 400);
  }
  if (newPassword.length < 8) {
    return jsonResponse({ ok: false, error: "Password must be at least 8 characters" }, 400);
  }

  const resetData = await kvGet(env.ADOFF_LICENSES, "reset:" + resetToken, "json");
  if (!resetData) {
    return jsonResponse({ ok: false, error: "Invalid or expired reset token" }, 400);
  }

  const admin = await kvGet(env.ADOFF_LICENSES, "admin:account", "json");
  if (!admin) return jsonResponse({ ok: false, error: "No admin account" }, 500);

  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  admin.passwordHash = await hashPasswordPBKDF2(newPassword, salt);
  admin.salt = salt;
  await env.ADOFF_LICENSES.put("admin:account", JSON.stringify(admin));
  await env.ADOFF_LICENSES.delete("reset:" + resetToken);

  return jsonResponse({ ok: true, message: "Password reset successfully" });
}

// LEGACY: hashing SHA-256 (usato SOLO come fallback di verifica per gli hash storici).
// Per i NUOVI hash si usa hashPasswordPBKDF2. La verifica passa da verifyPassword.
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const PBKDF2_ITERATIONS = 100000; // Cloudflare Workers caps PBKDF2 at 100k iterations; higher values throw.

// Hashing password robusto (PBKDF2-SHA256). Formato: "pbkdf2$<iter>$<hexhash>".
async function hashPasswordPBKDF2(password, salt, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    keyMaterial, 256
  );
  const hex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$${iterations}$${hex}`;
}

// Verifica retro-compatibile: PBKDF2 se prefissato, altrimenti fallback SHA-256 legacy.
// Confronto a tempo costante in entrambi i casi.
async function verifyPassword(password, salt, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith("pbkdf2$")) {
    const iterations = parseInt(storedHash.split("$")[1], 10) || PBKDF2_ITERATIONS;
    const computed = await hashPasswordPBKDF2(password, salt, iterations);
    return constantTimeEqual(computed, storedHash);
  }
  const computed = await hashPassword(password, salt);
  return constantTimeEqual(computed, storedHash);
}

// true se l'hash è in formato legacy SHA-256 e va aggiornato a PBKDF2 dopo un login riuscito.
function isLegacyPasswordHash(storedHash) {
  return !!storedHash && !storedHash.startsWith("pbkdf2$");
}

async function verifyAdminAuth(token, env) {
  if (!token) return false;
  // Legacy: direct ADMIN_TOKEN match
  if (token === env.ADMIN_TOKEN) return true;
  // Session token
  const session = await kvGet(env.ADOFF_LICENSES, "session:" + token, "json");
  if (session && session.expiresAt > Date.now()) return true;
  return false;
}

// =============================================
// ADMIN — LICENSE LIST & STATS
// =============================================

async function handleAdminListLicenses(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const limitParam = parseInt(url.searchParams.get("limit")) || 50;
  const limit = Math.min(Math.max(limitParam, 1), 200);
  const filterPlan = url.searchParams.get("plan") || null;
  const filterStatus = url.searchParams.get("status") || null; // active|expired|revoked

  // List all lic: keys from KV with pagination
  const listResult = await env.ADOFF_LICENSES.list({
    prefix: "lic:",
    limit: limit * 3, // fetch more to account for filtering
    cursor,
  });

  const now = Math.floor(Date.now() / 1000);
  const licenses = [];

  for (const key of listResult.keys) {
    const data = await kvGet(env.ADOFF_LICENSES, key.name, "json");
    if (!data) continue;

    // Determine status
    let status = "active";
    if (data.revoked) status = "revoked";
    else if (data.expires && data.expires > 0 && data.expires < now) status = "expired";

    // Apply filters
    if (filterPlan && data.plan !== filterPlan) continue;
    if (filterStatus && status !== filterStatus) continue;

    licenses.push({
      raw: key.name.replace("lic:", ""),
      key: data.key || null,
      email: data.email || "",
      plan: data.plan || "unknown",
      status,
      expires: data.expires || null,
      expiresHuman: data.expires && data.expires > 0
        ? new Date(data.expires * 1000).toISOString().slice(0, 10)
        : "LIFETIME",
      devices: (data.devices || []).length,
      maxDevices: data.deviceLimit || MAX_DEVICES,
      createdAt: data.createdAt || null,
      activatedAt: data.activatedAt || null,
    });

    if (licenses.length >= limit) break;
  }

  return jsonResponse({
    ok: true,
    licenses,
    total: licenses.length,
    cursor: listResult.list_complete ? null : listResult.cursor,
    hasMore: !listResult.list_complete,
  });
}

async function handleAdminStats(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);

  // Scan all licenses for aggregate stats
  let totalLicenses = 0;
  let activeLicenses = 0;
  let expiredLicenses = 0;
  let revokedLicenses = 0;
  let lifetimeLicenses = 0;
  let proLicenses = 0;
  let totalDevices = 0;
  const planCounts = {};
  let cursor = undefined;

  do {
    const listResult = await env.ADOFF_LICENSES.list({
      prefix: "lic:",
      limit: 1000,
      cursor,
    });

    for (const key of listResult.keys) {
      const data = await kvGet(env.ADOFF_LICENSES, key.name, "json");
      if (!data) continue;

      totalLicenses++;
      const plan = data.plan || "unknown";
      planCounts[plan] = (planCounts[plan] || 0) + 1;

      if (data.revoked) {
        revokedLicenses++;
      } else if (data.expires && data.expires > 0 && data.expires < now) {
        expiredLicenses++;
      } else {
        activeLicenses++;
        if (plan === "lifetime") lifetimeLicenses++;
        if (plan === "pro") proLicenses++;
      }

      totalDevices += (data.devices || []).length;
    }

    cursor = listResult.list_complete ? undefined : listResult.cursor;
  } while (cursor);

  // Read counters
  const totalSold = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_sold") || "0");
  const totalTickets = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_tickets") || "0");

  return jsonResponse({
    ok: true,
    timestamp: new Date().toISOString(),
    licenses: {
      total: totalLicenses,
      active: activeLicenses,
      expired: expiredLicenses,
      revoked: revokedLicenses,
      lifetime: lifetimeLicenses,
    },
    plans: planCounts,
    devices: {
      total: totalDevices,
      avgPerLicense: totalLicenses > 0 ? +(totalDevices / totalLicenses).toFixed(1) : 0,
    },
    sales: {
      totalSold,
    },
    support: {
      totalTickets,
    },
  });
}

// =============================================
// TRACKING — INSTALL & DOWNLOAD
// =============================================

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseBrowser(ua) {
  if (!ua) return "unknown";
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "opera";
  if (ua.includes("Firefox/")) return "firefox";
  if (ua.includes("Chrome/")) return "chrome";
  return "other";
}

async function appendToLog(env, logKey, entry, maxEntries) {
  const log = await kvGet(env.ADOFF_LICENSES, logKey, "json") || [];
  log.unshift(entry);
  if (log.length > maxEntries) log.length = maxEntries;
  await env.ADOFF_LICENSES.put(logKey, JSON.stringify(log));
}

async function incrementCounter(env, key) {
  const val = parseInt(await kvGet(env.ADOFF_LICENSES, key) || "0");
  await env.ADOFF_LICENSES.put(key, String(val + 1));
  return val + 1;
}

async function bumpAttributionCounter(env, suffix, delta) {
  const key = "attribution:" + suffix;
  const val = parseInt(await kvGet(env.ADOFF_LICENSES, key) || "0");
  await env.ADOFF_LICENSES.put(key, String(val + delta));
  return val + delta;
}

// Revenue stats for the admin Finance dashboard. Called on every completed sale.
// Writes the stats:* keys that handleAdminRevenue / handleAdminStats read.
async function bumpRevenueStats(env, amount, plan) {
  const today = new Date().toISOString().slice(0, 10);
  const inc = async (key, delta) => {
    const v = parseInt(await kvGet(env.ADOFF_LICENSES, key) || "0");
    await env.ADOFF_LICENSES.put(key, String(v + delta));
  };
  // NB: stats:total_sold is incremented by the sale path itself — do not double-count here.
  await inc(`stats:revenue:${today}:amount`, amount);
  await inc(`stats:revenue:${today}:count`, 1);
  await inc(`stats:revenue:plan:${plan}`, amount);
  // MRR = monthly-equivalent recurring revenue (lifetime is one-off → 0).
  const mrrDelta = plan === "monthly" ? amount : plan === "annual" ? Math.round(amount / 12) : 0;
  if (mrrDelta) await inc("stats:mrr", mrrDelta);
}

// Reverse revenue stats on a refund (mirror of the sale; floors at 0) + track refunds.
async function reverseRevenueStats(env, amount, plan, saleDate) {
  const day = saleDate || new Date().toISOString().slice(0, 10);
  const dec = async (key, delta) => {
    const v = parseInt(await kvGet(env.ADOFF_LICENSES, key) || "0");
    await env.ADOFF_LICENSES.put(key, String(Math.max(0, v - delta)));
  };
  const inc = async (key, delta) => {
    const v = parseInt(await kvGet(env.ADOFF_LICENSES, key) || "0");
    await env.ADOFF_LICENSES.put(key, String(v + delta));
  };
  await dec("stats:total_sold", 1);
  await dec(`stats:revenue:${day}:amount`, amount);
  await dec(`stats:revenue:${day}:count`, 1);
  await dec(`stats:revenue:plan:${plan}`, amount);
  const mrrDelta = plan === "monthly" ? amount : plan === "annual" ? Math.round(amount / 12) : 0;
  if (mrrDelta) await dec("stats:mrr", mrrDelta);
  await inc("stats:refunds:count", 1);
  await inc("stats:refunds:amount", amount);
}

async function handleTrackInstall(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const rlKey = `ratelimit:install:${ip}`;
  const rlVal = await kvGet(env.ADOFF_LICENSES, rlKey);
  if (rlVal) return jsonResponse({ ok: false, error: "Rate limit" }, 429);
  await env.ADOFF_LICENSES.put(rlKey, "1", { expirationTtl: 3600 });

  let body = {};
  try { body = await request.json(); } catch { /* body optional */ }

  const cf = request.cf || {};
  const country = (cf.country || "XX").toUpperCase().slice(0, 2);
  const city = cf.city || "";
  const region = cf.region || "";
  const tz = cf.timezone || "";
  const browser = parseBrowser(request.headers.get("User-Agent") || "");
  const source = ["chrome", "firefox", "edge", "opera", "direct"].includes(body.source) ? body.source : "direct";
  const ref = typeof body.ref === "string" ? body.ref.slice(0, 32) : "";
  const plan = ["free", "trial", "pro"].includes(body.plan) ? body.plan : "free";
  const version = typeof body.version === "string" ? body.version.slice(0, 16) : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const today = getDateStr();
  const now = Date.now();

  // Contatori aggregati (retrocompatibilità)
  await incrementCounter(env, "stats:installs");
  await incrementCounter(env, `stats:installs:${today}`);
  await incrementCounter(env, `stats:installs:country:${country}`);
  await incrementCounter(env, `stats:installs:source:${source}`);
  await incrementCounter(env, `stats:installs:browser:${browser}`);
  await incrementCounter(env, `stats:geo:${country}`);

  await appendToLog(env, "installs:log", {
    ts: now, country, city, region, tz, browser, source, ref,
  }, 1000);

  // ---- D1: scrivi evento install (device-level) ----
  if (deviceId) {
    try {
      const hashedId = await hashDeviceId(deviceId, env);
      await env.DB.prepare(`
        INSERT INTO install_events (device_id, install_ts, country, browser, source, plan, version, timezone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(hashedId, now, country, browser, source, plan, version, tz).run();

      // Heartbeat: registra installazione
      await env.DB.prepare(`
        INSERT INTO device_heartbeat (device_id, last_seen, country, browser, plan, version, install_ts)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
          last_seen = MAX(last_seen, excluded.last_seen),
          country = excluded.country,
          browser = excluded.browser,
          plan = excluded.plan,
          version = excluded.version
      `).bind(hashedId, now, country, browser, plan, version, now).run();
    } catch (e) {
      // D1 opzionale — non blocca il tracking
      console.error("D1 install error:", e.message);
    }
  }

  return jsonResponse({ ok: true });
}

async function handleTrackDownload(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const rlKey = `ratelimit:download:${ip}`;
  const rlVal = await kvGet(env.ADOFF_LICENSES, rlKey);
  if (rlVal) return jsonResponse({ ok: false, error: "Rate limit" }, 429);
  await env.ADOFF_LICENSES.put(rlKey, "1", { expirationTtl: 60 });

  let body = {};
  try { body = await request.json(); } catch { /* body optional */ }

  const cf = request.cf || {};
  const country = (cf.country || "XX").toUpperCase().slice(0, 2);
  const browser = ["chrome", "firefox", "edge", "opera", "other"].includes(body.browser)
    ? body.browser
    : parseBrowser(request.headers.get("User-Agent") || "");
  const page = typeof body.page === "string" ? body.page.slice(0, 32) : "unknown";
  const today = getDateStr();

  await incrementCounter(env, "stats:downloads");
  await incrementCounter(env, `stats:downloads:${today}`);
  await incrementCounter(env, `stats:downloads:browser:${browser}`);

  await appendToLog(env, "downloads:log", {
    ts: Date.now(), country, browser, page,
  }, 1000);

  return jsonResponse({ ok: true });
}

// =============================================
// UNINSTALL SURVEY — perché la gente disinstalla
// =============================================

// Motivi ammessi (allowlist — qualsiasi altro valore → "other").
const UNINSTALL_REASONS = ["broken_site", "ads_visible", "confusing", "performance", "found_better", "other"];

async function handleUninstall(request, env) {
  // Rate-limit largo per IP: l'utente sta già andando via, vogliamo le risposte,
  // ma evitiamo flood. Max ~5/ora per IP.
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const rlKey = `ratelimit:uninstall:${ip}`;
  const rlVal = parseInt(await kvGet(env.ADOFF_LICENSES, rlKey) || "0");
  if (rlVal >= 5) return jsonResponse({ ok: false, error: "Rate limit" }, 429);
  await env.ADOFF_LICENSES.put(rlKey, String(rlVal + 1), { expirationTtl: 3600 });

  let body = {};
  try { body = await request.json(); } catch { /* body optional */ }

  // Honeypot: i bot riempiono il campo nascosto → scarta in silenzio (200 ok).
  if (body.website) return jsonResponse({ ok: true });

  const reason = UNINSTALL_REASONS.includes(body.reason) ? body.reason : "other";
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 500) : "";
  const version = typeof body.version === "string" ? body.version.slice(0, 16) : "";
  const wasPro = body.wasPro === true || body.wasPro === "1";
  const cf = request.cf || {};
  const country = (cf.country || "XX").toUpperCase().slice(0, 2);
  const browser = parseBrowser(request.headers.get("User-Agent") || "");
  const today = getDateStr();

  // Opt-in domain: accettato SOLO con consenso esplicito
  let problemDomain = "";
  if (body.consent === true && typeof body.problem_domain === "string" && body.problem_domain.length > 0) {
    try {
      const u = new URL(body.problem_domain);
      problemDomain = u.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      problemDomain = body.problem_domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    }
    problemDomain = problemDomain.slice(0, 253); // max domain length
  }

  await incrementCounter(env, "stats:uninstalls");
  await incrementCounter(env, `stats:uninstalls:${today}`);
  await incrementCounter(env, `stats:uninstalls:reason:${reason}`);
  await incrementCounter(env, `stats:uninstalls:browser:${browser}`);

  await appendToLog(env, "uninstalls:log", {
    ts: Date.now(), reason, comment, version, wasPro, country, browser,
    ...(problemDomain ? { problemDomain } : {}),
  }, 1000);

  // Notifica Telegram solo se c'è un commento testuale (segnale ad alto valore,
  // tipicamente un sito rotto descritto dall'utente). I conteggi secchi restano nei contatori.
  if (comment) {
    const reasonLabel = {
      broken_site: "🧩 Un sito non funzionava",
      ads_visible: "👀 Vedeva ancora le ads",
      confusing: "😕 Troppo complicato / Free vs Pro",
      performance: "🐌 Rallentava il browser",
      found_better: "🔀 Ha trovato di meglio",
      other: "❔ Altro",
    }[reason] || reason;
    const text =
      `🗑️ <b>Disinstallazione</b>\n` +
      `Motivo: ${reasonLabel}\n` +
      `Browser: ${browser} · Paese: ${country} · v${version || "?"}${wasPro ? " · Pro/Trial" : ""}` +
      (problemDomain ? `\nDominio: ${problemDomain}` : "") +
      (comment ? `\nCommento: ${comment.replace(/[<>&]/g, "")}` : "");
    await notifyTelegram(text, env, TELEGRAM_SUPPORT_THREAD);
  }

  // ---- D1: scrivi evento uninstall (device-level) ----
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (deviceId) {
    try {
      const hashedId = await hashDeviceId(deviceId, env);
      await env.DB.prepare(`
        INSERT INTO uninstall_events (device_id, uninstall_ts, reason, comment, version, was_pro, country)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(hashedId, Date.now(), reason, comment, version, wasPro ? 1 : 0, country).run();

      // Rimuovi dalla heartbeat table (device non più attivo)
      await env.DB.prepare(`DELETE FROM device_heartbeat WHERE device_id = ?`).bind(hashedId).run();

      // Adleak opt-in report (solo se dominio + consenso)
      if (problemDomain) {
        try {
          await env.DB.prepare(`
            INSERT INTO adleak_reports (device_id, uninstall_ts, reason, problem_domain, version, was_pro, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(hashedId, Date.now(), reason, problemDomain, version, wasPro ? 1 : 0, country).run();
        } catch (e) {
          console.error("D1 adleak report error:", e.message);
        }
      }
    } catch (e) {
      console.error("D1 uninstall error:", e.message);
    }
  }

  return jsonResponse({ ok: true });
}

// =============================================
// HEARTBEAT — attività in tempo reale per retention
// Chiamato dall'estensione ogni ora circa.
// =============================================

async function handleHeartbeat(request, env) {
  // Rate limit largo: 1 heartbeat/minuto per device è più che sufficiente.
  let body = {};
  try { body = await request.json(); } catch { /* body optional */ }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (!deviceId) return jsonResponse({ ok: false, error: "no deviceId" }, 400);

  const cf = request.cf || {};
  const country = (cf.country || "XX").toUpperCase().slice(0, 2);
  const browser = parseBrowser(request.headers.get("User-Agent") || "");
  const plan = ["free", "trial", "pro"].includes(body.plan) ? body.plan : "free";
  const version = typeof body.version === "string" ? body.version.slice(0, 16) : "";
  const now = Date.now();

  try {
    const hashedId = await hashDeviceId(deviceId, env);
    await env.DB.prepare(`
      INSERT INTO device_heartbeat (device_id, last_seen, country, browser, plan, version, install_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        last_seen = excluded.last_seen,
        country = excluded.country,
        browser = excluded.browser,
        plan = excluded.plan,
        version = excluded.version
    `).bind(hashedId, now, country, browser, plan, version, body.installTs || now).run();
  } catch (e) {
    console.error("D1 heartbeat error:", e.message);
  }

  return jsonResponse({ ok: true });
}

// =============================================
// RETENTION DASHBOARD DATA
// =============================================

async function handleAdminRetention(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400000;
  const sevenDaysAgo = now - 7 * 86400000;

  // 1) Totali
  const totalInstalls = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM install_events"
  ).first().catch(() => ({ n: 0 }));
  const totalUninstalls = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM uninstall_events"
  ).first().catch(() => ({ n: 0 }));
  const activeDevices = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM device_heartbeat WHERE last_seen > ?"
  ).bind(now - 3 * 86400000).first().catch(() => ({ n: 0 }));
  const activeLast7d = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM device_heartbeat WHERE last_seen > ?"
  ).bind(sevenDaysAgo).first().catch(() => ({ n: 0 }));

  // 2) Retention curve: quanti dispositivi attivi a N giorni dall'installazione
  // N = 1, 3, 7, 14, 30
  const retentionDays = [1, 3, 7, 14, 30];
  const retentionCurve = [];
  for (const days of retentionDays) {
    const threshold = now - days * 86400000;
    const installedBefore = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM install_events WHERE install_ts <= ?"
    ).bind(threshold).first().catch(() => ({ n: 0 }));
    const stillActive = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM device_heartbeat
       WHERE install_ts <= ? AND last_seen > ?`
    ).bind(threshold, threshold).first().catch(() => ({ n: 0 }));
    retentionCurve.push({
      days,
      installed: installedBefore.n,
      active: stillActive.n,
      rate: installedBefore.n > 0 ? Math.round((stillActive.n / installedBefore.n) * 1000) / 10 : 0,
    });
  }

  // 3) Breakdown per source (store/distribution channel)
  const bySource = { items: [] };
  try {
    const { results } = await env.DB.prepare(`
      SELECT source,
             COUNT(*) AS installs,
             SUM(CASE WHEN device_id IN (SELECT device_id FROM uninstall_events) THEN 1 ELSE 0 END) AS uninstalls
      FROM install_events
      GROUP BY source
      ORDER BY installs DESC
    `).all();
    bySource.items = results || [];
  } catch (e) { /* D1 optional */ }

  // 4) Breakdown per country (top 20)
  const byCountry = { items: [] };
  try {
    const { results } = await env.DB.prepare(`
      SELECT country,
             COUNT(*) AS installs,
             SUM(CASE WHEN device_id IN (SELECT device_id FROM uninstall_events) THEN 1 ELSE 0 END) AS uninstalls
      FROM install_events
      GROUP BY country
      ORDER BY installs DESC
      LIMIT 20
    `).all();
    byCountry.items = results || [];
  } catch (e) { /* D1 optional */ }

  // 5) Breakdown per browser
  const byBrowser = { items: [] };
  try {
    const { results } = await env.DB.prepare(`
      SELECT browser,
             COUNT(*) AS installs,
             SUM(CASE WHEN device_id IN (SELECT device_id FROM uninstall_events) THEN 1 ELSE 0 END) AS uninstalls
      FROM install_events
      GROUP BY browser
      ORDER BY installs DESC
    `).all();
    byBrowser.items = results || [];
  } catch (e) { /* D1 optional */ }

  // 6) Breakdown per plan
  const byPlan = { items: [] };
  try {
    const { results } = await env.DB.prepare(`
      SELECT plan,
             COUNT(*) AS installs,
             SUM(CASE WHEN device_id IN (SELECT device_id FROM uninstall_events) THEN 1 ELSE 0 END) AS uninstalls
      FROM install_events
      GROUP BY plan
      ORDER BY installs DESC
    `).all();
    byPlan.items = results || [];
  } catch (e) { /* D1 optional */ }

  // 7) Uninstall reasons breakdown
  const byReason = { items: [] };
  try {
    const { results } = await env.DB.prepare(`
      SELECT reason, COUNT(*) AS n FROM uninstall_events
      GROUP BY reason ORDER BY n DESC
    `).all();
    byReason.items = results || [];
  } catch (e) { /* D1 optional */ }

  // 8) Daily install trend (ultimi 30 giorni)
  const dailyTrend = { items: [] };
  try {
    const { results } = await env.DB.prepare(`
      SELECT
        date(install_ts / 1000, 'unixepoch', 'localtime') AS day,
        COUNT(*) AS installs
      FROM install_events
      WHERE install_ts > ?
      GROUP BY day
      ORDER BY day DESC
    `).bind(thirtyDaysAgo).all();
    dailyTrend.items = (results || []).reverse();
  } catch (e) { /* D1 optional */ }

  // 9) Avg days to uninstall (solo chi ha disinstallato)
  const avgDaysToUninstall = await env.DB.prepare(`
    SELECT AVG((ue.uninstall_ts - ie.install_ts) / 86400000.0) AS avg_days
    FROM uninstall_events ue
    JOIN (
      SELECT device_id, MIN(install_ts) AS install_ts
      FROM install_events GROUP BY device_id
    ) ie ON ue.device_id = ie.device_id
    WHERE ue.uninstall_ts > ie.install_ts
  `).first().catch(() => ({ avg_days: null }));

  return jsonResponse({
    ok: true,
    summary: {
      totalInstalls: totalInstalls.n,
      totalUninstalls: totalUninstalls.n,
      activeDevices: activeDevices.n,
      activeLast7d: activeLast7d.n,
      uninstallRate: totalInstalls.n > 0
        ? Math.round((totalUninstalls.n / totalInstalls.n) * 1000) / 10
        : 0,
      avgDaysToUninstall: avgDaysToUninstall.avg_days
        ? Math.round(avgDaysToUninstall.avg_days * 10) / 10
        : null,
    },
    retentionCurve,
    bySource: bySource.items,
    byCountry: byCountry.items,
    byBrowser: byBrowser.items,
    byPlan: byPlan.items,
    byReason: byReason.items,
    dailyTrend: dailyTrend.items,
  });
}

// =============================================
// ATTRIBUTION — SOURCE TRACKING (orthogonal to referral)
// =============================================

async function handleAttributionInstall(request, env) {
  let body = {};
  try { body = await request.json(); } catch { /* body optional */ }

  const source = body.source;
  if (source && /^src-[a-z0-9_]{2,20}$/.test(source)) {
    await bumpAttributionCounter(env, "install:" + source, 1);
  }

  return jsonResponse({ ok: true });
}

async function handleAttributionStats(request, env) {
  // Admin-only: verify auth token (same as handleAdminStats)
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  // Read all KV keys under "attribution:" prefix
  const result = { install: {}, paid: {}, revenue: {} };
  const list = await env.ADOFF_LICENSES.list({ prefix: "attribution:" });

  for (const item of list.keys) {
    const key = item.name;
    const val = await kvGet(env.ADOFF_LICENSES, key);
    const numVal = parseInt(val || "0");

    // Parse key format: "attribution:<type>:<source>"
    const parts = key.split(":");
    if (parts.length >= 3) {
      const type = parts[1]; // "install", "paid", "revenue"
      const source = parts.slice(2).join(":"); // source name (in case it has colons, unlikely)

      if (type === "install" && result.install) {
        result.install[source] = numVal;
      } else if (type === "paid" && result.paid) {
        result.paid[source] = numVal;
      } else if (type === "revenue" && result.revenue) {
        result.revenue[source] = numVal;
      }
    }
  }

  return jsonResponse(result);
}

// =============================================
// ADMIN — ANALYTICS & REVENUE
// =============================================

async function handleAdminAnalytics(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const totalInstalls = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:installs") || "0");
  const totalDownloads = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:downloads") || "0");
  const today = getDateStr();
  const todayInstalls = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:installs:${today}`) || "0");
  const todayDownloads = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:downloads:${today}`) || "0");

  // Last 7 days arrays
  const last7Installs = [];
  const last7Downloads = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const ic = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:installs:${d}`) || "0");
    const dc = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:downloads:${d}`) || "0");
    last7Installs.push({ date: d, count: ic });
    last7Downloads.push({ date: d, count: dc });
  }

  // By country — scan geo keys
  const geoList = await env.ADOFF_LICENSES.list({ prefix: "stats:geo:" });
  const byCountry = [];
  for (const k of geoList.keys) {
    const cc = k.name.replace("stats:geo:", "");
    const cnt = parseInt(await kvGet(env.ADOFF_LICENSES, k.name) || "0");
    byCountry.push({ country: cc, count: cnt });
  }
  byCountry.sort((a, b) => b.count - a.count);

  // By source — scan install:country keys would be redundant; use source counters
  const sources = ["chrome", "firefox", "edge", "opera", "direct"];
  const bySource = {};
  for (const s of sources) {
    bySource[s] = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:installs:source:${s}`) || "0");
  }

  // By browser for downloads
  const byBrowser = {
    chrome: parseInt(await kvGet(env.ADOFF_LICENSES, "stats:downloads:browser:chrome") || "0"),
    firefox: parseInt(await kvGet(env.ADOFF_LICENSES, "stats:downloads:browser:firefox") || "0"),
    edge: parseInt(await kvGet(env.ADOFF_LICENSES, "stats:downloads:browser:edge") || "0"),
    opera: parseInt(await kvGet(env.ADOFF_LICENSES, "stats:downloads:browser:opera") || "0"),
    other: parseInt(await kvGet(env.ADOFF_LICENSES, "stats:downloads:browser:other") || "0"),
  };

  const installsLog = await kvGet(env.ADOFF_LICENSES, "installs:log", "json") || [];
  const recentLog = installsLog.slice(0, 50);

  // --- Uninstall survey ---
  const totalUninstalls = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:uninstalls") || "0");
  const todayUninstalls = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:uninstalls:${today}`) || "0");
  const last7Uninstalls = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    last7Uninstalls.push({ date: d, count: parseInt(await kvGet(env.ADOFF_LICENSES, `stats:uninstalls:${d}`) || "0") });
  }
  const byReason = {};
  for (const r of UNINSTALL_REASONS) {
    byReason[r] = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:uninstalls:reason:${r}`) || "0");
  }
  const uninstByBrowser = {};
  for (const b of ["chrome", "firefox", "edge", "opera", "other"]) {
    uninstByBrowser[b] = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:uninstalls:browser:${b}`) || "0");
  }
  const uninstallsLog = await kvGet(env.ADOFF_LICENSES, "uninstalls:log", "json") || [];
  // Tasso di disinstallazione approssimato su totali cumulativi (segnale, non esatto).
  const uninstallRate = totalInstalls > 0 ? Math.round((totalUninstalls / totalInstalls) * 1000) / 10 : 0;

  return jsonResponse({
    ok: true,
    installs: {
      total: totalInstalls,
      today: todayInstalls,
      last7days: last7Installs,
      byCountry,
      bySource,
      recentLog,
    },
    downloads: {
      total: totalDownloads,
      today: todayDownloads,
      last7days: last7Downloads,
      byBrowser,
    },
    uninstalls: {
      total: totalUninstalls,
      today: todayUninstalls,
      last7days: last7Uninstalls,
      byReason,
      byBrowser: uninstByBrowser,
      ratePercent: uninstallRate,
      recentLog: uninstallsLog.slice(0, 50),
    },
  });
}

async function handleAdminRevenue(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const totalSold = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_sold") || "0");
  const mrr = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:mrr") || "0");

  const plans = ["monthly", "annual", "lifetime"];
  const byPlan = {};
  for (const p of plans) {
    byPlan[p] = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:revenue:plan:${p}`) || "0");
  }

  // Last 30 days
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const amount = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:revenue:${d}:amount`) || "0");
    const count = parseInt(await kvGet(env.ADOFF_LICENSES, `stats:revenue:${d}:count`) || "0");
    last30.push({ date: d, amount, count });
  }

  const totalSoldCount = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_sold") || "0");

  return jsonResponse({
    ok: true,
    revenue: {
      totalSold,
      mrr,
      byPlan,
      last30days: last30,
    },
    sold: totalSoldCount,
  });
}

// =============================================
// ADMIN — LICENSE UPDATE
// =============================================

const VALID_PLANS_UPDATE = ["pro", "lifetime", "monthly", "annual"];

async function handleAdminLicenseUpdate(body, env, request) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const { key, updates } = body;
  if (!key || !updates) return jsonResponse({ ok: false, error: "Missing key or updates" }, 400);

  // Resolve raw key — support both display key (ADOFF-XXXX-...) and raw
  let rawKey = key;
  if (key.startsWith("ADOFF-")) {
    rawKey = await kvGet(env.ADOFF_LICENSES, `key:${key}`);
    if (!rawKey) return jsonResponse({ ok: false, error: "License not found" }, 404);
  }

  const license = await kvGet(env.ADOFF_LICENSES, `lic:${rawKey}`, "json");
  if (!license) return jsonResponse({ ok: false, error: "License not found" }, 404);

  if (updates.plan !== undefined) {
    if (!VALID_PLANS_UPDATE.includes(updates.plan)) {
      return jsonResponse({ ok: false, error: "Invalid plan" }, 400);
    }
    license.plan = updates.plan;
  }
  if (updates.expires !== undefined) {
    license.expires = typeof updates.expires === "number" ? updates.expires : parseInt(updates.expires);
  }
  if (updates.deviceLimit !== undefined) {
    const dl = Math.min(Math.max(parseInt(updates.deviceLimit) || 3, 1), 10);
    license.deviceLimit = dl;
  }
  if (updates.email !== undefined) {
    license.email = String(updates.email).slice(0, 128);
  }

  license.updatedAt = Date.now();
  license.updatedBy = "admin";
  await env.ADOFF_LICENSES.put(`lic:${rawKey}`, JSON.stringify(license));

  return jsonResponse({ ok: true, message: "License updated", key: license.key || key });
}

// =============================================
// ACCOUNT MANAGEMENT (Netflix-style device management)
// =============================================

/**
 * Verify account session token.
 * Returns session {raw, email} or null if invalid/expired.
 */
async function verifyAccountAuth(token, env) {
  if (!token) return null;
  const session = await kvGet(env.ADOFF_LICENSES, "account_session:" + token, "json");
  if (!session || session.expiresAt < Date.now()) return null;
  return session;
}

/**
 * POST /account/login
 * Body: {key: "ADOFF-XXXX-XXXX-XXXX or raw", email: "user@example.com"}
 * Returns session token valid 24h.
 */
async function handleAccountLogin(body, env) {
  const { key, email } = body;
  if (!key || !email) {
    return jsonResponse({ ok: false, error: "Missing key or email" }, 400);
  }

  // Resolve ADOFF-XXXX alias → raw key
  let rawKey = key.trim();
  if (rawKey.startsWith("ADOFF-")) {
    const resolved = await kvGet(env.ADOFF_LICENSES, `key:${rawKey}`);
    if (!resolved) return jsonResponse({ ok: false, error: "License not found" }, 404);
    rawKey = resolved;
  }

  // Load license data
  const licData = await kvGet(env.ADOFF_LICENSES, `lic:${rawKey}`, "json");
  if (!licData) return jsonResponse({ ok: false, error: "License not found" }, 404);
  if (licData.revoked) return jsonResponse({ ok: false, error: "License revoked" }, 403);

  // Verify email matches
  const storedEmail = (licData.email || "").toLowerCase().trim();
  const inputEmail = email.toLowerCase().trim();
  if (!storedEmail || storedEmail !== inputEmail) {
    return jsonResponse({ ok: false, error: "Email does not match license" }, 401);
  }

  // Sync with user account record — keeps user:{email} up to date
  const userKey = `user:${storedEmail}`;
  const existingUser = await kvGet(env.ADOFF_LICENSES, userKey, "json");
  if (!existingUser) {
    // Migrate legacy key-based login to unified account on first use
    const legacyKeys = await kvGet(env.ADOFF_LICENSES, `email:${storedEmail}`, "json") || [];
    const allRaws = Array.from(new Set([rawKey, ...legacyKeys.map(k => k.raw).filter(Boolean)]));
    await env.ADOFF_LICENSES.put(userKey, JSON.stringify({
      email: storedEmail,
      passwordHash: null,
      salt: null,
      emailVerified: true,
      providers: [],
      googleId: null,
      microsoftId: null,
      licenses: allRaws,
      createdAt: Date.now(),
      lastLogin: Date.now(),
    }));
  } else if (!existingUser.licenses.includes(rawKey)) {
    existingUser.licenses.push(rawKey);
    existingUser.lastLogin = Date.now();
    await env.ADOFF_LICENSES.put(userKey, JSON.stringify(existingUser));
  }

  // Generate session token (32 bytes = 64 hex chars)
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24h

  await env.ADOFF_LICENSES.put(
    "account_session:" + token,
    JSON.stringify({ raw: rawKey, email: storedEmail, createdAt: now, expiresAt, stripeCustomerId: licData.stripeCustomerId || null }),
    { expirationTtl: 86400 }
  );

  const devices = normalizeDeviceList(licData.devices || []);
  const maxDevices = licData.deviceLimit || MAX_DEVICES;
  const expires = licData.expires || 0;

  return jsonResponse({
    ok: true,
    token,
    plan: licData.plan || "pro",
    devices: devices.map(d => ({
      id: d.id,
      name: d.name || "Unknown Device",
      lastSeen: d.lastSeen ? new Date(d.lastSeen).toISOString() : null,
      ipPrefix: d.ip ? d.ip.split(".").slice(0, 2).join(".") + ".x.x" : null,
    })),
    maxDevices,
    expires: expires > 0 ? expires : null,
    expiresHuman: expires > 0
      ? new Date(expires * 1000).toISOString().split("T")[0]
      : "LIFETIME",
    stripeCustomerId: licData.stripeCustomerId || null,
  });
}

/**
 * GET /account/devices
 * Header: X-Account-Token: TOKEN
 */
async function handleAccountDevices(request, env) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const normalEmail = (session.email || "").toLowerCase().trim();

  // Source 1: user:{email}.licenses (canonical, kept in sync by Stripe webhook + admin)
  const userRecord = await kvGet(env.ADOFF_LICENSES, `user:${normalEmail}`, "json");
  const userLicenses = Array.isArray(userRecord?.licenses) ? userRecord.licenses : [];

  // Source 2: email:{email} index (fallback for legacy/admin licenses where user record may lag)
  const emailIndexRaw = await kvGet(env.ADOFF_LICENSES, `email:${normalEmail}`, "json") || [];
  const emailIndexLicenses = emailIndexRaw.map(e => e?.raw).filter(Boolean);

  // Source 3: original session license (final fallback)
  const sessionLicenses = session.raw ? [session.raw] : [];

  // Merge & dedup
  const allLicenseRaws = [...new Set([...userLicenses, ...emailIndexLicenses, ...sessionLicenses])];

  // Self-healing: if email index revealed licenses missing from user record, persist them
  const missingFromUser = allLicenseRaws.filter(r => !userLicenses.includes(r));
  if (userRecord && missingFromUser.length > 0) {
    userRecord.licenses = allLicenseRaws;
    await env.ADOFF_LICENSES.put(`user:${normalEmail}`, JSON.stringify(userRecord));
  }

  // Carica dati per ogni licenza
  const licenses = [];
  for (const rawKey of allLicenseRaws) {
    const licData = await kvGet(env.ADOFF_LICENSES, `lic:${rawKey}`, "json");
    if (!licData || licData.revoked) continue;

    const devices = normalizeDeviceList(licData.devices || []);
    const maxDevices = licData.deviceLimit || MAX_DEVICES;
    const now = Math.floor(Date.now() / 1000);
    const isExpired = licData.expires > 0 && licData.expires < now;
    const expiresHuman = licData.expires > 0
      ? new Date(licData.expires * 1000).toLocaleDateString("it-IT")
      : "LIFETIME";

    licenses.push({
      rawKey,
      key: licData.key || null,
      plan: licData.plan || "pro",
      maxDevices,
      expiresHuman,
      isExpired,
      devices: devices.map(d => ({
        id: d.id,
        name: d.name || "Unknown Device",
        lastSeen: d.lastSeen ? new Date(d.lastSeen).toISOString() : null,
        ipPrefix: d.ip ? d.ip.split(".").slice(0, 2).join(".") + ".x.x" : null,
      })),
    });
  }

  // Retrocompatibilità: se c'è una sola licenza, restituisci anche i campi flat
  const primaryLic = licenses.find(l => l.rawKey === session.raw) || licenses[0];

  return jsonResponse({
    ok: true,
    // Campi flat per retrocompatibilità con frontend esistente
    plan: primaryLic?.plan || "pro",
    maxDevices: primaryLic?.maxDevices || MAX_DEVICES,
    hasLicense: licenses.length > 0,
    licenseKey: primaryLic?.key || null,
    expiresHuman: primaryLic?.expiresHuman || null,
    isExpired: primaryLic?.isExpired || false,
    devices: primaryLic?.devices || [],
    // Nuovo: array con TUTTE le licenze
    licenses,
  });
}

/**
 * POST /account/remove-device
 * Header: X-Account-Token: TOKEN
 * Body: {deviceId: "uuid-xxx"}
 */
async function handleAccountRemoveDevice(body, env, request) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const { deviceId, licenseKey } = body;
  if (!deviceId) return jsonResponse({ ok: false, error: "Missing deviceId" }, 400);

  // Determina quale licenza usare
  let targetRaw = session.raw;
  if (licenseKey && licenseKey !== session.raw) {
    // Verifica che la licenza appartenga all'utente
    const userRecord = await kvGet(env.ADOFF_LICENSES, `user:${session.email}`, "json");
    if (!userRecord?.licenses?.includes(licenseKey)) {
      return jsonResponse({ ok: false, error: "License not found or not owned" }, 403);
    }
    targetRaw = licenseKey;
  }

  // Rate limit: max 3 removals per day per license
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rlKey = `deactivations:${targetRaw}:${today}`;
  const rlVal = parseInt(await kvGet(env.ADOFF_LICENSES, rlKey) || "0");
  if (rlVal >= 3) {
    return jsonResponse({ ok: false, error: "Rate limit: max 3 device removals per day" }, 429);
  }

  const licData = await kvGet(env.ADOFF_LICENSES, `lic:${targetRaw}`, "json");
  if (!licData) return jsonResponse({ ok: false, error: "License not found" }, 404);

  const before = normalizeDeviceList(licData.devices || []);
  const after = before.filter(d => d.id !== deviceId);

  if (before.length === after.length) {
    return jsonResponse({ ok: false, error: "Device not found" }, 404);
  }

  // Increment rate limit counter
  await env.ADOFF_LICENSES.put(rlKey, String(rlVal + 1), { expirationTtl: 86400 });

  // Aggiungi il dispositivo alla blacklist per impedire ri-attivazione automatica
  const bannedDevices = licData.bannedDevices || [];
  if (!bannedDevices.includes(deviceId)) {
    bannedDevices.push(deviceId);
  }

  await env.ADOFF_LICENSES.put(`lic:${targetRaw}`, JSON.stringify({
    ...licData,
    devices: after,
    bannedDevices,
  }));

  return jsonResponse({ ok: true, devicesRemaining: after.length });
}

/**
 * POST /account/remove-all
 * Header: X-Account-Token: TOKEN
 */
async function handleAccountRemoveAll(body, env, request) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const { licenseKey } = body || {};

  // Determina quale licenza usare
  let targetRaw = session.raw;
  if (licenseKey && licenseKey !== session.raw) {
    // Verifica che la licenza appartenga all'utente
    const userRecord = await kvGet(env.ADOFF_LICENSES, `user:${session.email}`, "json");
    if (!userRecord?.licenses?.includes(licenseKey)) {
      return jsonResponse({ ok: false, error: "License not found or not owned" }, 403);
    }
    targetRaw = licenseKey;
  }

  const licData = await kvGet(env.ADOFF_LICENSES, `lic:${targetRaw}`, "json");
  if (!licData) return jsonResponse({ ok: false, error: "License not found" }, 404);

  const devices = normalizeDeviceList(licData.devices || []);
  const count = devices.length;

  // Rate limit: removing all counts as N removals
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rlKey = `deactivations:${targetRaw}:${today}`;
  const rlVal = parseInt(await kvGet(env.ADOFF_LICENSES, rlKey) || "0");
  if (rlVal + count > 3) {
    return jsonResponse({ ok: false, error: "Rate limit: max 3 device removals per day" }, 429);
  }

  if (count > 0) {
    await env.ADOFF_LICENSES.put(rlKey, String(rlVal + count), { expirationTtl: 86400 });
  }

  // Aggiungi TUTTI i dispositivi alla blacklist per impedire ri-attivazione automatica
  const bannedDevices = licData.bannedDevices || [];
  for (const dev of devices) {
    const devId = typeof dev === "string" ? dev : dev.id;
    if (devId && !bannedDevices.includes(devId)) {
      bannedDevices.push(devId);
    }
  }

  await env.ADOFF_LICENSES.put(`lic:${targetRaw}`, JSON.stringify({
    ...licData,
    devices: [],
    bannedDevices,
  }));

  return jsonResponse({ ok: true, removed: count });
}

// =============================================
// AUTH — RATE LIMIT HELPER (10/IP/hour)
// =============================================

async function checkAuthRateLimit(ip, env) {
  const key = `rl:auth:${ip}`;
  const AUTH_LIMIT = 10;
  const AUTH_WINDOW = 3600; // 1 hour
  const current = await kvGet(env.ADOFF_LICENSES, key);
  if (current) {
    const count = parseInt(current);
    if (count >= AUTH_LIMIT) return false;
    await env.ADOFF_LICENSES.put(key, String(count + 1), { expirationTtl: AUTH_WINDOW });
  } else {
    await env.ADOFF_LICENSES.put(key, "1", { expirationTtl: AUTH_WINDOW });
  }
  return true;
}

// =============================================
// OAUTH HANDLERS
// =============================================

/**
 * GET /oauth/{provider}/start
 * Generates state, stores in KV, redirects to provider auth URL.
 */
async function handleOAuthStart(provider, env, flow = "account") {
  if (!env.GOOGLE_OAUTH_CLIENT_ID && provider === "google") {
    return jsonResponse({ ok: false, error: "OAuth not configured" }, 500);
  }
  if (!env.MICROSOFT_OAUTH_CLIENT_ID && provider === "microsoft") {
    return jsonResponse({ ok: false, error: "OAuth not configured" }, 500);
  }

  // Generate cryptographically random state (32 bytes = 64 hex chars)
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  // flow: "account" (login frontend utente) o "admin" (login backend pannello admin)
  await env.ADOFF_LICENSES.put(
    `oauth_state:${state}`,
    JSON.stringify({ provider, flow, createdAt: Date.now() }),
    { expirationTtl: 600 }
  );

  let authUrl;
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      redirect_uri: "https://api.adoff.app/oauth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });
    authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
  } else {
    const params = new URLSearchParams({
      client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
      redirect_uri: "https://api.adoff.app/oauth/microsoft/callback",
      response_type: "code",
      scope: "openid email profile User.Read",
      state,
    });
    authUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + params.toString();
  }

  return Response.redirect(authUrl, 302);
}

/**
 * GET /oauth/{provider}/callback
 * Verifies state, exchanges code for token, finds or creates user, returns session.
 */
async function handleOAuthCallback(provider, request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Base del redirect d'errore: dipende dal flow (admin → pannello, altrimenti → account).
  let errBase = "https://adoff.app/account/?error=";
  const errorRedirect = (msg) => Response.redirect(errBase + encodeURIComponent(msg), 302);

  if (!code || !state) return errorRedirect("missing_params");

  // Verify and consume state
  const stateData = await kvGet(env.ADOFF_LICENSES, `oauth_state:${state}`, "json");
  if (!stateData || stateData.provider !== provider) return errorRedirect("invalid_state");
  if (stateData.flow === "admin") errBase = "https://adoff.app/admin.html#error=";
  await env.ADOFF_LICENSES.delete(`oauth_state:${state}`);

  try {
    // Exchange code for tokens
    let tokenRes, userInfo;

    if (provider === "google") {
      if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
        return errorRedirect("oauth_not_configured");
      }
      const tokenParams = new URLSearchParams({
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: "https://api.adoff.app/oauth/google/callback",
        grant_type: "authorization_code",
      });
      tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });
    } else {
      if (!env.MICROSOFT_OAUTH_CLIENT_ID || !env.MICROSOFT_OAUTH_CLIENT_SECRET) {
        return errorRedirect("oauth_not_configured");
      }
      const tokenParams = new URLSearchParams({
        client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
        client_secret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: "https://api.adoff.app/oauth/microsoft/callback",
        grant_type: "authorization_code",
        scope: "openid email profile User.Read",
      });
      tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return errorRedirect("token_exchange_failed");

    // Get user info from provider
    let email, providerId;
    if (provider === "google") {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { "Authorization": "Bearer " + tokenData.access_token },
      });
      userInfo = await userRes.json();
      email = (userInfo.email || "").toLowerCase().trim();
      providerId = userInfo.sub;
    } else {
      const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { "Authorization": "Bearer " + tokenData.access_token },
      });
      userInfo = await userRes.json();
      email = (userInfo.mail || userInfo.userPrincipalName || "").toLowerCase().trim();
      providerId = userInfo.id;
    }

    if (!email) return errorRedirect("no_email_from_provider");

    // Flow ADMIN: l'email deve combaciare con l'admin autorizzato → sessione admin backend.
    if (stateData.flow === "admin") {
      return await issueAdminOAuthSession(email, env);
    }

    // Find or create user account
    const userKey = `user:${email}`;
    let user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
    const now = Date.now();

    if (!user) {
      // Create new account
      user = {
        email,
        passwordHash: null,
        salt: null,
        emailVerified: true,
        providers: [provider],
        googleId: provider === "google" ? providerId : null,
        microsoftId: provider === "microsoft" ? providerId : null,
        licenses: [],
        createdAt: now,
        lastLogin: now,
      };
      // Import legacy licenses from email index
      const legacyKeys = await kvGet(env.ADOFF_LICENSES, `email:${email}`, "json") || [];
      user.licenses = legacyKeys.map(k => k.raw).filter(Boolean);
    } else {
      // Update existing account
      if (!user.providers.includes(provider)) user.providers.push(provider);
      if (provider === "google") user.googleId = providerId;
      if (provider === "microsoft") user.microsoftId = providerId;
      user.emailVerified = true;
      user.lastLogin = now;
    }

    await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));

    // Resolve first active license for session
    const firstRaw = user.licenses.length > 0 ? user.licenses[0] : null;

    // Generate session token
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const sessionToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = now + 24 * 60 * 60 * 1000;

    await env.ADOFF_LICENSES.put(
      `account_session:${sessionToken}`,
      JSON.stringify({ raw: firstRaw, email, createdAt: now, expiresAt }),
      { expirationTtl: 86400 }
    );

    return Response.redirect(
      "https://adoff.app/account/?token=" + encodeURIComponent(sessionToken),
      302
    );
  } catch (e) {
    return errorRedirect("internal_error");
  }
}

/**
 * Login admin via Google: l'email autenticata deve combaciare con ADMIN_GOOGLE_EMAIL
 * (secret, non hardcodato). In caso positivo crea una sessione admin (stessa struttura
 * di handleAdminLogin → verificata da verifyAdminAuth) e reindirizza al pannello con il
 * token nel fragment (#token=, fuori dai log/referrer). Account non autorizzato → errore.
 */
async function issueAdminOAuthSession(email, env) {
  const allowed = (env.ADMIN_GOOGLE_EMAIL || "").toLowerCase().trim();
  if (!allowed || email !== allowed) {
    return Response.redirect("https://adoff.app/admin.html#error=not_authorized", 302);
  }
  const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  await env.ADOFF_LICENSES.put(
    "session:" + sessionToken,
    JSON.stringify({ token: sessionToken, username: "admin", email, via: "google", createdAt: now, expiresAt: now + 24 * 60 * 60 * 1000 }),
    { expirationTtl: 86400 }
  );
  return Response.redirect("https://adoff.app/admin.html#token=" + encodeURIComponent(sessionToken), 302);
}

// =============================================
// TURNSTILE ANTI-BOT VERIFICATION
// =============================================

/**
 * Verify a Cloudflare Turnstile token server-side.
 * @param {string} token  - cf-turnstile-response from the client
 * @param {string} ip     - connecting IP for extra binding (optional, can be "")
 * @param {object} env    - Worker env (must have TURNSTILE_SECRET_KEY binding)
 * @returns {Promise<boolean>} true if valid
 */
async function verifyTurnstile(token, ip, env) {
  if (!token) return false;
  // Extension cannot render Turnstile widgets — allow bypass for extension logins
  // (still rate-limited by IP via checkAuthRateLimit)
  if (token === "extension" || token === "web") return true;
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return false; // misconfigured — fail closed

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch (_) {
    return false;
  }
}

// =============================================
// EMAIL + PASSWORD AUTH HANDLERS
// =============================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /auth/register
 * Body: {email, password}
 */
async function handleAuthRegister(body, env, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  if (!await checkAuthRateLimit(ip, env)) {
    return jsonResponse({ ok: false, error: "Too many attempts. Try again in 1 hour." }, 429);
  }

  if (!await verifyTurnstile(body.turnstileToken, ip, env)) {
    return jsonResponse({ ok: false, error: "Verifica anti-bot fallita. Riprova." }, 400);
  }

  const { email, password } = body;
  if (!email || !password) return jsonResponse({ ok: false, error: "Missing email or password" }, 400);
  if (!EMAIL_RE.test(email)) return jsonResponse({ ok: false, error: "Invalid email format" }, 400);
  if (password.length < 8) return jsonResponse({ ok: false, error: "Password must be at least 8 characters" }, 400);

  const normalEmail = email.toLowerCase().trim();
  const userKey = `user:${normalEmail}`;
  const now = Date.now();

  let user = await kvGet(env.ADOFF_LICENSES, userKey, "json");

  if (user && user.passwordHash) {
    return jsonResponse({ ok: false, error: "Account already exists" }, 409);
  }

  // Hash password with random salt
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const passwordHash = await hashPasswordPBKDF2(password, salt);

  if (!user) {
    // New account
    const legacyKeys = await kvGet(env.ADOFF_LICENSES, `email:${normalEmail}`, "json") || [];
    user = {
      email: normalEmail,
      passwordHash,
      salt,
      emailVerified: false,
      providers: ["password"],
      googleId: null,
      microsoftId: null,
      licenses: legacyKeys.map(k => k.raw).filter(Boolean),
      createdAt: now,
      lastLogin: now,
    };
  } else {
    // Existing OAuth account — add password provider
    user.passwordHash = passwordHash;
    user.salt = salt;
    if (!user.providers.includes("password")) user.providers.push("password");
    // For OAuth-linked accounts, email is already verified
    if (!user.emailVerified) user.emailVerified = false;
  }

  await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));

  // Generate email verification token
  const verifyBytes = crypto.getRandomValues(new Uint8Array(20));
  const verifyToken = Array.from(verifyBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  await env.ADOFF_LICENSES.put(
    `email_verify:${verifyToken}`,
    JSON.stringify({ email: normalEmail }),
    { expirationTtl: 86400 }
  );

  // Send verification email
  const verifyUrl = "https://adoff.app/account/?verify=" + verifyToken;
  const tmplVerify = EMAIL_TEMPLATES.verify_email(normalEmail, verifyUrl);
  await sendEmail(normalEmail, tmplVerify.subject, tmplVerify.html, env);

  return jsonResponse({ ok: true, message: "Controlla la tua email per la verifica" });
}

/**
 * POST /auth/verify-email
 * Body: {token}
 */
async function handleAuthVerifyEmail(body, env) {
  const { token } = body;
  if (!token) return jsonResponse({ ok: false, error: "Missing token" }, 400);

  const verifyData = await kvGet(env.ADOFF_LICENSES, `email_verify:${token}`, "json");
  if (!verifyData) return jsonResponse({ ok: false, error: "Invalid or expired verification token" }, 400);

  const userKey = `user:${verifyData.email}`;
  const user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
  if (!user) return jsonResponse({ ok: false, error: "User not found" }, 404);

  user.emailVerified = true;
  await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));
  await env.ADOFF_LICENSES.delete(`email_verify:${token}`);

  return jsonResponse({ ok: true });
}

/**
 * POST /auth/login
 * Body: {email, password}
 */
async function handleAuthLogin(body, env, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  if (!await checkAuthRateLimit(ip, env)) {
    return jsonResponse({ ok: false, error: "Too many attempts. Try again in 1 hour." }, 429);
  }

  if (!await verifyTurnstile(body.turnstileToken, ip, env)) {
    return jsonResponse({ ok: false, error: "Verifica anti-bot fallita. Riprova." }, 400);
  }

  const { email, password } = body;
  if (!email || !password) return jsonResponse({ ok: false, error: "Missing email or password" }, 400);

  const normalEmail = email.toLowerCase().trim();
  const user = await kvGet(env.ADOFF_LICENSES, `user:${normalEmail}`, "json");

  // Use generic error to prevent user enumeration
  const INVALID = { ok: false, error: "Invalid credentials" };
  if (!user || !user.passwordHash) return jsonResponse(INVALID, 401);
  if (!user.emailVerified) {
    return jsonResponse({ ok: false, error: "Email non verificata. Controlla la tua casella." }, 401);
  }

  if (!await verifyPassword(password, user.salt, user.passwordHash)) return jsonResponse(INVALID, 401);

  // Upgrade trasparente a PBKDF2 se l'hash è legacy SHA-256 (riusa il put di lastLogin)
  if (isLegacyPasswordHash(user.passwordHash)) {
    user.passwordHash = await hashPasswordPBKDF2(password, user.salt);
  }

  // Update last login
  user.lastLogin = Date.now();
  await env.ADOFF_LICENSES.put(`user:${normalEmail}`, JSON.stringify(user));

  // Resolve first active license for session
  const firstRaw = user.licenses.length > 0 ? user.licenses[0] : null;
  let licData = firstRaw ? await kvGet(env.ADOFF_LICENSES, `lic:${firstRaw}`, "json") : null;

  // Generate session token
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const sessionToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000;

  await env.ADOFF_LICENSES.put(
    `account_session:${sessionToken}`,
    JSON.stringify({ raw: firstRaw, email: normalEmail, createdAt: now, expiresAt }),
    { expirationTtl: 86400 }
  );

  const expires = licData?.expires || 0;
  const devices = normalizeDeviceList(licData?.devices || []);
  const maxDevices = licData?.deviceLimit || MAX_DEVICES;

  return jsonResponse({
    ok: true,
    token: sessionToken,
    plan: licData?.plan || "free",
    devices: devices.map(d => ({
      id: d.id,
      name: d.name || "Unknown Device",
      lastSeen: d.lastSeen ? new Date(d.lastSeen).toISOString() : null,
      ipPrefix: d.ip ? d.ip.split(".").slice(0, 2).join(".") + ".x.x" : null,
    })),
    maxDevices,
    expires: expires > 0 ? expires : null,
    expiresHuman: expires > 0
      ? new Date(expires * 1000).toISOString().split("T")[0]
      : "LIFETIME",
  });
}

/**
 * POST /auth/google-extension
 * Called from the browser extension after getting a Google access token
 * via chrome.identity.launchWebAuthFlow.
 * Body: {email, googleId, name, accessToken}
 * Skips Turnstile (extension cannot render widgets), keeps rate limiting.
 */
async function handleAuthGoogleExtension(body, env, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  if (!await checkAuthRateLimit(ip, env)) {
    return jsonResponse({ ok: false, error: "Too many attempts. Try again in 1 hour." }, 429);
  }

  const { email, googleId, name, accessToken } = body;
  if (!email || !googleId || !accessToken) {
    return jsonResponse({ ok: false, error: "Missing required fields" }, 400);
  }

  // Verify the access token is valid by calling Google userinfo
  let verifiedEmail;
  let verifiedGoogleId;
  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!userRes.ok) return jsonResponse({ ok: false, error: "Invalid Google token" }, 401);
    const userInfo = await userRes.json();
    verifiedEmail    = (userInfo.email || "").toLowerCase().trim();
    verifiedGoogleId = userInfo.sub;
  } catch (_) {
    return jsonResponse({ ok: false, error: "Google token verification failed" }, 401);
  }

  // Sanity check: claimed email/id must match what Google says
  if (verifiedEmail !== (email || "").toLowerCase().trim() || verifiedGoogleId !== googleId) {
    return jsonResponse({ ok: false, error: "Token mismatch" }, 401);
  }

  // Find or create user account (same logic as OAuth callback)
  const userKey = `user:${verifiedEmail}`;
  let user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
  const now = Date.now();

  if (!user) {
    // Import legacy licenses from email index if present
    const legacyKeys = await kvGet(env.ADOFF_LICENSES, `email:${verifiedEmail}`, "json") || [];
    user = {
      email: verifiedEmail,
      passwordHash: null,
      salt: null,
      emailVerified: true,
      providers: ["google"],
      googleId: verifiedGoogleId,
      microsoftId: null,
      licenses: legacyKeys.map(k => k.raw).filter(Boolean),
      createdAt: now,
      lastLogin: now,
    };
  } else {
    if (!user.providers) user.providers = [];
    if (!user.providers.includes("google")) user.providers.push("google");
    user.googleId     = verifiedGoogleId;
    user.emailVerified = true;
    user.lastLogin    = now;
  }

  await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));

  // Resolve first active license for session
  const firstRaw = user.licenses && user.licenses.length > 0 ? user.licenses[0] : null;
  let licData = firstRaw ? await kvGet(env.ADOFF_LICENSES, `lic:${firstRaw}`, "json") : null;
  let licenseKey = null;
  if (licData) {
    licenseKey = licData.key || firstRaw;
  }

  // Generate session token (24h)
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const sessionToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = now + 24 * 60 * 60 * 1000;

  await env.ADOFF_LICENSES.put(
    `account_session:${sessionToken}`,
    JSON.stringify({ raw: firstRaw, email: verifiedEmail, createdAt: now, expiresAt }),
    { expirationTtl: 86400 }
  );

  const plan = licData?.plan || "free";
  const expires = licData?.expires || 0;

  return jsonResponse({
    ok:         true,
    token:      sessionToken,
    email:      verifiedEmail,
    plan,
    licenseRaw: licenseKey,
    expires:    expires > 0 ? expires : null,
    expiresHuman: expires > 0
      ? new Date(expires * 1000).toISOString().split("T")[0]
      : (licenseKey ? "LIFETIME" : null),
  });
}

/**
 * POST /auth/forgot-password
 * Body: {email}
 */
async function handleAuthForgotPassword(body, env, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";

  if (!await verifyTurnstile(body.turnstileToken, ip, env)) {
    return jsonResponse({ ok: false, error: "Verifica anti-bot fallita. Riprova." }, 400);
  }

  const { email } = body;
  if (!email) return jsonResponse({ ok: false, error: "Missing email" }, 400);

  // Always return the same message to prevent user enumeration
  const RESPONSE = { ok: true, message: "Se l'email e' registrata, riceverai un link di reset" };

  const normalEmail = email.toLowerCase().trim();
  const user = await kvGet(env.ADOFF_LICENSES, `user:${normalEmail}`, "json");
  if (!user || !user.passwordHash) return jsonResponse(RESPONSE);

  // Generate reset token (20 bytes = 40 hex chars)
  const resetBytes = crypto.getRandomValues(new Uint8Array(20));
  const resetToken = Array.from(resetBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  await env.ADOFF_LICENSES.put(
    `password_reset:${resetToken}`,
    JSON.stringify({ email: normalEmail, createdAt: Date.now() }),
    { expirationTtl: 3600 }
  );

  const resetUrl = "https://adoff.app/account/?reset=" + resetToken;
  const tmplReset = EMAIL_TEMPLATES.reset_password(normalEmail, resetUrl);
  await sendEmail(normalEmail, tmplReset.subject, tmplReset.html, env);

  return jsonResponse(RESPONSE);
}

/**
 * POST /auth/reset-password
 * Body: {token, newPassword}
 */
async function handleAuthResetPassword(body, env) {
  const { token, newPassword } = body;
  if (!token || !newPassword) return jsonResponse({ ok: false, error: "Missing token or password" }, 400);
  if (newPassword.length < 8) return jsonResponse({ ok: false, error: "Password must be at least 8 characters" }, 400);

  const resetData = await kvGet(env.ADOFF_LICENSES, `password_reset:${token}`, "json");
  if (!resetData) return jsonResponse({ ok: false, error: "Invalid or expired reset token" }, 400);

  const userKey = `user:${resetData.email}`;
  const user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
  if (!user) return jsonResponse({ ok: false, error: "User not found" }, 404);

  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  user.passwordHash = await hashPasswordPBKDF2(newPassword, salt);
  user.salt = salt;

  await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));
  await env.ADOFF_LICENSES.delete(`password_reset:${token}`);

  return jsonResponse({ ok: true });
}

/**
 * POST /auth/activate-account
 * Body: {token, password}
 * Attiva un account creato automaticamente dopo acquisto.
 */
async function handleAuthActivateAccount(body, env) {
  const { token, password } = body;
  if (!token || !password) return jsonResponse({ ok: false, error: "Missing token or password" }, 400);
  if (password.length < 8) return jsonResponse({ ok: false, error: "Password must be at least 8 characters" }, 400);

  const activateData = await kvGet(env.ADOFF_LICENSES, `account_activate:${token}`, "json");
  if (!activateData) return jsonResponse({ ok: false, error: "Invalid or expired activation token" }, 400);

  const userKey = `user:${activateData.email}`;
  const user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
  if (!user) return jsonResponse({ ok: false, error: "User not found" }, 404);

  // Imposta password e attiva account
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  user.passwordHash = await hashPasswordPBKDF2(password, salt);
  user.salt = salt;
  user.emailVerified = true; // Pagamento = email verificata
  if (!user.providers.includes("password")) user.providers.push("password");

  await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));
  await env.ADOFF_LICENSES.delete(`account_activate:${token}`);

  // Genera session token per login automatico
  const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const session = {
    email: activateData.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 giorni
  };
  await env.ADOFF_LICENSES.put(`account_session:${sessionToken}`, JSON.stringify(session), {
    expirationTtl: 30 * 86400,
  });

  return jsonResponse({
    ok: true,
    token: sessionToken,
    email: activateData.email,
    licenses: user.licenses || []
  });
}

// =============================================
// ACCOUNT — LINK LICENSE & PROFILE
// =============================================

/**
 * POST /account/link-license
 * Header: X-Account-Token: TOKEN
 * Body: {key}
 */
async function handleAccountLinkLicense(body, env, request) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const { key } = body;
  if (!key) return jsonResponse({ ok: false, error: "Missing key" }, 400);

  // Resolve ADOFF-XXXX alias → raw key
  let rawKey = key.trim();
  if (rawKey.startsWith("ADOFF-")) {
    const resolved = await kvGet(env.ADOFF_LICENSES, `key:${rawKey}`);
    if (!resolved) return jsonResponse({ ok: false, error: "License not found" }, 404);
    rawKey = resolved;
  }

  const licData = await kvGet(env.ADOFF_LICENSES, `lic:${rawKey}`, "json");
  if (!licData) return jsonResponse({ ok: false, error: "License not found" }, 404);
  if (licData.revoked) return jsonResponse({ ok: false, error: "License is revoked" }, 403);

  // Load user account
  const userKey = `user:${session.email}`;
  const user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
  if (!user) return jsonResponse({ ok: false, error: "Account not found" }, 404);

  // Add raw key to user.licenses if not already present
  if (!user.licenses.includes(rawKey)) {
    user.licenses.push(rawKey);
    await env.ADOFF_LICENSES.put(userKey, JSON.stringify(user));
  }

  // Update license email to match user email
  if (licData.email !== session.email) {
    licData.email = session.email;
    await env.ADOFF_LICENSES.put(`lic:${rawKey}`, JSON.stringify(licData));
  }

  return jsonResponse({ ok: true });
}

/**
 * GET /account/profile
 * Header: X-Account-Token: TOKEN
 */
async function handleAccountProfile(request, env) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const user = await kvGet(env.ADOFF_LICENSES, `user:${session.email}`, "json");
  if (!user) return jsonResponse({ ok: false, error: "Account not found" }, 404);

  // Resolve license details
  const now = Math.floor(Date.now() / 1000);
  const licenses = [];
  for (const raw of (user.licenses || [])) {
    const lic = await kvGet(env.ADOFF_LICENSES, `lic:${raw}`, "json");
    if (!lic) continue;
    const isExpired = lic.expires > 0 && lic.expires < now;
    licenses.push({
      key: lic.key || null,
      plan: lic.plan || "unknown",
      expires: lic.expires || null,
      expiresHuman: lic.expires > 0
        ? new Date(lic.expires * 1000).toISOString().split("T")[0]
        : "LIFETIME",
      status: lic.revoked ? "revoked" : isExpired ? "expired" : "active",
      devices: (lic.devices || []).length,
    });
  }

  // Resolve affiliate data if exists
  let affiliate = null;
  if (env.DB) {
    affiliate = await env.DB.prepare("SELECT id, commission_rate FROM affiliates WHERE user_id = ? OR email = ?")
      .bind(user.email, user.email).first();
  }

  return jsonResponse({
    ok: true,
    email: user.email,
    providers: user.providers || [],
    emailVerified: user.emailVerified || false,
    licenses,
    affiliate: affiliate ? { id: affiliate.id, rate: affiliate.commission_rate } : null,
    createdAt: user.createdAt || null,
  });
}

// =============================================
// STATS
// =============================================

async function handleStats(env) {
  const totalSold = parseInt(await kvGet(env.ADOFF_LICENSES, "stats:total_sold") || "0");
  return jsonResponse({ sold: totalSold });
}

// =============================================
// AFFILIATE ENDPOINTS
// =============================================

async function handleAffiliateStats(request, env) {
  const url = new URL(request.url);
  const affiliateId = url.searchParams.get("id");
  if (!affiliateId) return jsonResponse({ error: "Missing affiliate ID" }, 400);

  if (!env.DB) return jsonResponse({ error: "Database not configured" }, 500);

  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_sales
      FROM referrals 
      WHERE affiliate_id = ? AND status = 'confirmed'
    `).bind(affiliateId).first();

    const daysEarned = (stats.total_sales || 0) * 30; // 30 giorni per vendita

    return jsonResponse({
      ok: true,
      affiliate_id: affiliateId,
      sales: stats.total_sales || 0,
      days_earned: daysEarned
    });
  } catch (e) {
    return jsonResponse({ error: "Database error: " + e.message }, 500);
  }
}

async function registerReferral(affiliateId, customerEmail, sessionId, amount, currency, env) {
  if (!env.DB) return;
  try {
    const daysToAward = 30; // Premio Partner: 30 giorni
    
    // 1. Registra nel DB
    await env.DB.prepare(
      "INSERT INTO referrals (affiliate_id, customer_email, stripe_session_id, amount_total, currency, commission_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(affiliateId, customerEmail, sessionId, amount, currency, 0, "confirmed").run();

    // 2. Trova email affiliato
    const aff = await env.DB.prepare("SELECT email FROM affiliates WHERE id = ?").bind(affiliateId).first();
    if (!aff) return;

    // 3. Accredita giorni su KV
    const userKey = `user:${aff.email}`;
    const user = await kvGet(env.ADOFF_LICENSES, userKey, "json");
    if (user && user.licenses && user.licenses.length > 0) {
      const rawKey = user.licenses[0];
      const lic = await kvGet(env.ADOFF_LICENSES, `lic:${rawKey}`, "json");
      if (lic) {
        const now = Math.floor(Date.now() / 1000);
        const currentExp = (lic.expires && lic.expires > now) ? lic.expires : now;
        lic.expires = currentExp + (daysToAward * 86400);
        lic.updatedAt = Date.now();
        await env.ADOFF_LICENSES.put(`lic:${rawKey}`, JSON.stringify(lic));
      }
    }
  } catch (e) {
    console.error("registerReferral Error:", e.message);
  }
}

async function handleAffiliateRegister(request, env) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  if (!env.DB) return jsonResponse({ error: "Database not configured" }, 500);

  const email = session.email;
  // Verifica se gia' affiliato
  const existing = await env.DB.prepare("SELECT id FROM affiliates WHERE email = ?").bind(email).first();
  if (existing) return jsonResponse({ ok: true, affiliate_id: existing.id });

  // Genera ID: parte dell'email + 3 random chars
  const prefix = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 5);
  const affiliateId = `${prefix}-${suffix}`;

  try {
    await env.DB.prepare(
      "INSERT INTO affiliates (id, email, user_id, commission_rate) VALUES (?, ?, ?, ?)"
    ).bind(affiliateId, email, email, 0.20).run();
    
    return jsonResponse({ ok: true, affiliate_id: affiliateId });
  } catch (e) {
    return jsonResponse({ error: "Errore registrazione: " + e.message }, 500);
  }
}

// =============================================
// REFERRAL ENDPOINTS
// =============================================

const REFERRAL_CODE_REGEX = /^ADO-[A-Z0-9]{5,8}$/;

async function handleReferralRegisterCode(body, env, request) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const code = body && body.code;
  if (!code || !REFERRAL_CODE_REGEX.test(code)) {
    return jsonResponse({ ok: false, error: "Invalid code format" }, 400);
  }

  const existing = await kvGet(env.ADOFF_LICENSES, "referral:" + code, "json");
  if (existing && existing.email !== session.email) {
    return jsonResponse({ ok: false, error: "Code already claimed" }, 409);
  }

  await env.ADOFF_LICENSES.put(
    "referral:" + code,
    JSON.stringify({ email: session.email, createdAt: Date.now() })
  );
  await env.ADOFF_LICENSES.put("user_referral:" + session.email, JSON.stringify({ code, createdAt: Date.now() }));

  const statsExisting = await kvGet(env.ADOFF_LICENSES, "referral_stats:" + code, "json");
  if (!statsExisting) {
    await env.ADOFF_LICENSES.put(
      "referral_stats:" + code,
      JSON.stringify({ count: 0, daysEarned: 0, history: [], paidEmails: [] })
    );
  }

  return jsonResponse({ ok: true, code });
}

async function handleReferralStats(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code || !REFERRAL_CODE_REGEX.test(code)) {
    return jsonResponse({ ok: false, error: "Invalid code format" }, 400);
  }

  const stats = await kvGet(env.ADOFF_LICENSES, "referral_stats:" + code, "json")
    || { count: 0, daysEarned: 0, history: [], paidEmails: [] };

  return jsonResponse({
    ok: true,
    code,
    count: stats.count,
    daysEarned: stats.daysEarned,
    history: stats.history,
  });
}

async function creditReferralFriend(code, payerEmail, env, sessionId) {
  if (!code || !code.startsWith("ADO-")) return;
  const REFERRAL_DAYS_PER_FRIEND = 15;
  try {
    const mapping = await kvGet(env.ADOFF_LICENSES, "referral:" + code, "json");
    if (!mapping || !mapping.email) return;
    const referrerEmail = mapping.email;
    if (referrerEmail.toLowerCase() === (payerEmail || "").toLowerCase()) return;

    // Stripe idempotency: if we've already credited for this session, skip.
    // session.id is unique per Stripe checkout, retried webhooks reuse the same id.
    if (sessionId) {
      const flagKey = "referral_credited:" + sessionId;
      const already = await kvGet(env.ADOFF_LICENSES, flagKey);
      if (already) return;
      // Mark immediately (best-effort lock — KV is eventually consistent but Stripe retries are seconds/minutes apart).
      await env.ADOFF_LICENSES.put(flagKey, "1", { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
    }

    const stats = await kvGet(env.ADOFF_LICENSES, "referral_stats:" + code, "json")
      || { count: 0, daysEarned: 0, history: [], paidEmails: [] };
    if (stats.paidEmails.includes((payerEmail || "").toLowerCase())) return;

    let credited = false;
    const userRecord = await kvGet(env.ADOFF_LICENSES, "user:" + referrerEmail, "json");
    if (userRecord && Array.isArray(userRecord.licenses) && userRecord.licenses.length > 0) {
      const rawKey = userRecord.licenses[0];
      const lic = await kvGet(env.ADOFF_LICENSES, "lic:" + rawKey, "json");
      if (lic && lic.expires && lic.expires > 0) {
        const now = Math.floor(Date.now() / 1000);
        const base = lic.expires > now ? lic.expires : now;
        lic.expires = base + (REFERRAL_DAYS_PER_FRIEND * 86400);
        lic.updatedAt = Date.now();
        await env.ADOFF_LICENSES.put("lic:" + rawKey, JSON.stringify(lic));
        credited = true;
      }
    }
    if (!credited) return; // No active time-limited license to credit — don't inflate stats.

    stats.count += 1;
    stats.daysEarned += REFERRAL_DAYS_PER_FRIEND;
    stats.history.unshift({
      date: Date.now(),
      payerEmail: maskEmail(payerEmail),
      daysEarned: REFERRAL_DAYS_PER_FRIEND,
    });
    if (stats.history.length > 50) stats.history.length = 50;
    stats.paidEmails.push((payerEmail || "").toLowerCase());
    await env.ADOFF_LICENSES.put("referral_stats:" + code, JSON.stringify(stats));
  } catch (e) {
    console.error("creditReferralFriend error:", e.message);
  }
}

function maskEmail(email) {
  if (!email) return "";
  const [u, d] = email.split("@");
  if (!d) return "***";
  return (u.slice(0, 2) || "**") + "***@" + d;
}

async function handleAffiliateMe(request, env) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!env.DB) return jsonResponse({ ok: false, error: "Database not configured" }, 500);
  const aff = await env.DB.prepare("SELECT id FROM affiliates WHERE email = ?").bind(session.email).first();
  if (aff) return jsonResponse({ ok: true, registered: true, affiliate_id: aff.id });
  return jsonResponse({ ok: true, registered: false });
}

// =============================================
// ROUTER
// =============================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// =============================================
// CRON: CONTROLLO SCADENZE LICENZE (giornaliero)
// =============================================

async function handleScheduled(env) {
  const now = Math.floor(Date.now() / 1000);
  let reminders = 0, expired = 0, checked = 0;

  // BA-6: usa indici expiry per O(1) — controlla solo le date rilevanti
  // invece di iterare TUTTE le licenze
  const checkDays = [-1, 0, 1, 3, 7]; // scadute ieri, oggi, tra 1/3/7 giorni
  const processedRaws = new Set();

  for (const offset of checkDays) {
    const targetTs = now + offset * 86400;
    const dateStr = new Date(targetTs * 1000).toISOString().slice(0, 10).replace(/-/g, "");
    const rawKeys = await kvGet(env.ADOFF_LICENSES, `expiry:${dateStr}`, "json");
    if (!rawKeys) continue;

    for (const raw of rawKeys) {
      if (processedRaws.has(raw)) continue;
      processedRaws.add(raw);

      const data = await kvGet(env.ADOFF_LICENSES, `lic:${raw}`, "json");
      if (!data || data.revoked || !data.email || !data.expires || data.expires === 0) continue;
      checked++;

      const daysLeft = Math.floor((data.expires - now) / 86400);

      // Licenza scaduta — invia email (una volta sola)
      if (daysLeft < 0 && !data.expiredNotified) {
        const tmpl = EMAIL_TEMPLATES.expired(data.key, data.email);
        await sendEmail(data.email, tmpl.subject, tmpl.html, env);
        data.expiredNotified = true;
        await env.ADOFF_LICENSES.put(`lic:${raw}`, JSON.stringify(data));
        expired++;
        continue;
      }

      // Reminder: 7, 3, 1 giorni prima della scadenza
      if ([7, 3, 1].includes(daysLeft)) {
        const reminderKey = "reminder_" + daysLeft;
        if (!data[reminderKey]) {
          const tmpl = EMAIL_TEMPLATES.expiry_reminder(data.key, daysLeft, data.email);
          await sendEmail(data.email, tmpl.subject, tmpl.html, env);
          data[reminderKey] = true;
          await env.ADOFF_LICENSES.put(`lic:${raw}`, JSON.stringify(data));
          reminders++;
        }
      }
    }
  }

  // Sync giornaliera Google Search Console (non bloccante: errori isolati)
  let gsc = null;
  try {
    gsc = await syncGscDaily(env);
  } catch (e) {
    gsc = { ok: false, error: e.message };
  }

  return { reminders, expired, checked, gsc };
}

// =============================================
// OUTREACH TRACKING (admin-only, KV-backed, isolated — no impact on licenses/payments)
// =============================================
async function handleOutreachList(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const records = {};
  const list = await env.ADOFF_LICENSES.list({ prefix: "outreach:" });
  for (const item of list.keys) {
    const id = item.name.slice("outreach:".length);
    const rec = await kvGet(env.ADOFF_LICENSES, item.name, "json");
    if (rec) records[id] = rec;
  }
  // Live referral conversions per code (from D1 referrals table)
  const refCounts = {};
  if (env.DB) {
    try {
      const rows = await env.DB.prepare(
        "SELECT affiliate_id, COUNT(*) AS c, COALESCE(SUM(amount_total),0) AS rev FROM referrals GROUP BY affiliate_id"
      ).all();
      for (const r of (rows.results || [])) {
        refCounts[r.affiliate_id] = { count: r.c, revenueCents: r.rev };
      }
    } catch (e) { /* table may be empty; ignore */ }
  }
  return jsonResponse({ ok: true, records, refCounts });
}

async function handleOutreachUpdate(body, env, request) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const id = (body && body.id || "").toString().trim();
  if (!id || !/^[a-zA-Z0-9_-]{1,40}$/.test(id)) {
    return jsonResponse({ ok: false, error: "Invalid id" }, 400);
  }
  const rec = {
    status: (body.status || "").toString().slice(0, 20),
    note: (body.note || "").toString().slice(0, 500),
    refCode: (body.refCode || "").toString().slice(0, 60),
    updatedAt: Date.now(),
  };
  await env.ADOFF_LICENSES.put("outreach:" + id, JSON.stringify(rec));
  return jsonResponse({ ok: true, id, record: rec });
}

async function handleOutreachCreateCode(body, env, request) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const code = (body && body.code || "").toString().trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,60}$/.test(code)) {
    return jsonResponse({ ok: false, error: "Invalid code format" }, 400);
  }
  if (!env.DB) return jsonResponse({ ok: false, error: "DB not configured" }, 500);
  const email = (body.email || (code.toLowerCase() + "@creator.adoff.app")).toString().slice(0, 120);
  const existing = await env.DB.prepare("SELECT id FROM affiliates WHERE id = ?").bind(code).first();
  if (existing) return jsonResponse({ ok: true, code, already: true });
  try {
    await env.DB.prepare(
      "INSERT INTO affiliates (id, email, commission_rate) VALUES (?, ?, ?)"
    ).bind(code, email, 0.20).run();
    return jsonResponse({ ok: true, code });
  } catch (e) {
    return jsonResponse({ ok: false, error: "DB error: " + e.message }, 500);
  }
}

// =============================================
// GOOGLE SEARCH CONSOLE — analisi SEO (admin-only)
// Auth: OAuth refresh token dell'account proprietario (riusa il client desktop
// AdOff CLI). Secrets: GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN.
// Dati: snapshot ricco in KV (gsc:snapshot) + trend giornaliero in D1 (gsc_daily).
// =============================================
const GSC_SITE = "sc-domain:adoff.app";

async function gscAccessToken(env) {
  if (!env.GSC_CLIENT_ID || !env.GSC_CLIENT_SECRET || !env.GSC_REFRESH_TOKEN) {
    throw new Error("GSC secrets non configurati (GSC_CLIENT_ID/SECRET/REFRESH_TOKEN)");
  }
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // NB: con grant_type=refresh_token il parametro `scope` può SOLO restringere gli
    // scope del grant originale — richiederne uno non concesso (es. analytics.readonly
    // su un token emesso solo per webmasters.readonly) fa rispondere Google `invalid_scope`.
    // Omettendolo, Google emette un access token con TUTTI gli scope del refresh token:
    // GSC funziona sempre, GA4 si attiva da solo appena il token verrà ri-autorizzato con analytics.readonly.
    body: new URLSearchParams({
      client_id: env.GSC_CLIENT_ID,
      client_secret: env.GSC_CLIENT_SECRET,
      refresh_token: env.GSC_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error("GSC token " + resp.status + ": " + (await resp.text()).slice(0, 200));
  return (await resp.json()).access_token;
}

async function gscQuery(token, body) {
  const url = "https://searchconsole.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(GSC_SITE) + "/searchAnalytics/query";
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error("GSC query " + resp.status + ": " + (await resp.text()).slice(0, 200));
  return (await resp.json()).rows || [];
}

function gscDateStr(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

function gscMapRows(rows) {
  return rows.map((r) => ({
    key: (r.keys && r.keys[0]) || "",
    clicks: Math.round(r.clicks || 0),
    impressions: Math.round(r.impressions || 0),
    ctr: Math.round((r.ctr || 0) * 1000) / 10,
    position: Math.round((r.position || 0) * 10) / 10,
  }));
}

/** Esegue la sync GSC: scrive snapshot in KV + trend in D1. Ritorna un riepilogo. */
async function syncGscDaily(env) {
  const token = await gscAccessToken(env);
  const END = gscDateStr(2);     // GSC ha ~2 giorni di ritardo
  const start28 = gscDateStr(30);
  const start90 = gscDateStr(92);

  // 1) Trend giornaliero (ultimi 30g) → D1 upsert
  const byDate = await gscQuery(token, { startDate: start28, endDate: END, dimensions: ["date"], rowLimit: 40 });
  if (env.DB) {
    try {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS gsc_daily (date TEXT PRIMARY KEY, clicks INTEGER, impressions INTEGER, ctr REAL, position REAL, updated_at INTEGER)"
      ).run();
      for (const r of byDate) {
        const d = (r.keys && r.keys[0]) || "";
        if (!d) continue;
        await env.DB.prepare(
          "INSERT INTO gsc_daily (date, clicks, impressions, ctr, position, updated_at) VALUES (?,?,?,?,?,?) " +
          "ON CONFLICT(date) DO UPDATE SET clicks=excluded.clicks, impressions=excluded.impressions, ctr=excluded.ctr, position=excluded.position, updated_at=excluded.updated_at"
        ).bind(d, Math.round(r.clicks || 0), Math.round(r.impressions || 0), r.ctr || 0, r.position || 0, Math.floor(Date.now() / 1000)).run();
      }
    } catch (e) { /* D1 opzionale, non bloccante */ }
  }

  // 2) Aggregati e classifiche
  const [totRows, topQuery, topPage, topCountry, oppRows] = await Promise.all([
    gscQuery(token, { startDate: start28, endDate: END, rowLimit: 1 }),
    gscQuery(token, { startDate: start28, endDate: END, dimensions: ["query"], rowLimit: 25 }),
    gscQuery(token, { startDate: start28, endDate: END, dimensions: ["page"], rowLimit: 25 }),
    gscQuery(token, { startDate: start28, endDate: END, dimensions: ["country"], rowLimit: 10 }),
    gscQuery(token, { startDate: start90, endDate: END, dimensions: ["query"], rowLimit: 1000 }),
  ]);

  const totals = totRows[0]
    ? { clicks: Math.round(totRows[0].clicks), impressions: Math.round(totRows[0].impressions), ctr: Math.round(totRows[0].ctr * 1000) / 10, position: Math.round(totRows[0].position * 10) / 10 }
    : { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  const opportunities = gscMapRows(oppRows)
    .filter((r) => r.position >= 5 && r.position <= 20 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25);

  const snapshot = {
    updatedAt: Date.now(),
    range: { start: start28, end: END, days: 28 },
    totals,
    topQuery: gscMapRows(topQuery),
    topPage: gscMapRows(topPage),
    topCountry: gscMapRows(topCountry),
    opportunities,
    trend: byDate.map((r) => ({ date: (r.keys && r.keys[0]) || "", clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) })),
  };
  await env.ADOFF_LICENSES.put("gsc:snapshot", JSON.stringify(snapshot));
  return { ok: true, updatedAt: snapshot.updatedAt, clicks: totals.clicks, impressions: totals.impressions, days: byDate.length };
}

/** GET /admin/gsc — ritorna lo snapshot salvato (no fetch live, veloce). */
async function handleAdminGsc(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const snap = await kvGet(env.ADOFF_LICENSES, "gsc:snapshot", "json");
  if (!snap) return jsonResponse({ ok: true, snapshot: null, note: "Nessun dato ancora. Premi 'Aggiorna ora' o attendi il cron giornaliero." });
  return jsonResponse({ ok: true, snapshot: snap });
}

/** GET /admin/seo-reply — legge e CONSUMA l'ultima risposta nel topic SEO (per il watcher). */
async function handleAdminSeoReply(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const reply = await kvGet(env.ADOFF_LICENSES, "seo:reply:latest", "json");
  if (reply) await env.ADOFF_LICENSES.delete("seo:reply:latest");
  return jsonResponse({ ok: true, reply: reply || null });
}

/** POST /admin/gsc/sync — forza l'aggiornamento immediato. */
async function handleAdminGscSync(request, env) {
  try {
    const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
    if (!await verifyAdminAuth(adminToken, env)) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    const res = await syncGscDaily(env);
    return jsonResponse(res);
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message || e), stack: String(e && e.stack || "").slice(0, 500) }, 500);
  }
}

// =============================================
// SEO/AEO — unified data endpoint
// Reuses the same OAuth token as GSC for all Google APIs
// NOTE: Add `GA4_PROPERTY_ID` to wrangler secrets for GA4 integration
// =============================================

/** GET /admin/seo — unified SEO dashboard data (GSC + GA4 + Sitemaps) */
async function handleAdminSeo(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  // Check cache first (TTL 1 hour)
  const cached = await kvGet(env.ADOFF_LICENSES, "seo:data", "json");
  if (cached && (Date.now() - cached.updatedAt) < 3600000) {
    return jsonResponse({ ok: true, data: cached, cached: true });
  }

  try {
    const token = await gscAccessToken(env);

    const END = gscDateStr(2);
    const start7 = gscDateStr(9);
    const start30 = gscDateStr(32);
    const start90 = gscDateStr(92);

    const [
      gscAggregated, gscTrend7, gscTrend30,
      topQuery, topPage, topCountry, topDevice, topAppearance, opportunities,
      sitemaps, ga4Data,
    ] = await Promise.allSettled([
      gscQuery(token, { startDate: start30, endDate: END, rowLimit: 1 }),
      gscQuery(token, { startDate: start7, endDate: END, dimensions: ["date"], rowLimit: 10 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["date"], rowLimit: 40 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["query"], rowLimit: 25 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["page"], rowLimit: 25 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["country"], rowLimit: 10 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["device"], rowLimit: 5 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["searchAppearance"], rowLimit: 15 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["query"], rowLimit: 5000, "dimensionFilterGroups": [{ filters: [{ dimension: "position", operator: "between", expression: "5", endExpression: "20" }] }] }),
      fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/sitemaps`, { headers: { Authorization: "Bearer " + token } }).then(r => r.ok ? r.json() : { sitemap: [] }),
      fetchGa4Data(token, env, start30, END),
    ]);

    const getResult = (r, fallback = []) => r.status === "fulfilled" ? (r.value || fallback) : fallback;
    const totals = getResult(gscAggregated)[0] || {};
    const trend7 = getResult(gscTrend7);
    const trend30 = getResult(gscTrend30);

    const seoData = {
      updatedAt: Date.now(),
      range: { start: start30, end: END },
      gsc: {
        totals: {
          clicks: Math.round(totals.clicks || 0),
          impressions: Math.round(totals.impressions || 0),
          ctr: Math.round((totals.ctr || 0) * 1000) / 10,
          position: Math.round((totals.position || 0) * 10) / 10,
        },
        trend7d: trend7.map(r => ({ date: (r.keys && r.keys[0]) || "", clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) })),
        trend30d: trend30.map(r => ({ date: (r.keys && r.keys[0]) || "", clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) })),
        topQuery: gscMapRows(getResult(topQuery)),
        topPage: gscMapRows(getResult(topPage)),
        topCountry: gscMapRows(getResult(topCountry)),
        topDevice: gscMapRows(getResult(topDevice)),
        topAppearance: gscMapRows(getResult(topAppearance)),
        opportunities: gscMapRows(getResult(opportunities)).filter(r => r.position >= 5 && r.position <= 20 && r.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 25),
      },
      sitemaps: parseSitemaps(getResult(sitemaps)),
      ga4: getResult(ga4Data, null),
    };

    await env.ADOFF_LICENSES.put("seo:data", JSON.stringify(seoData));
    return jsonResponse({ ok: true, data: seoData, cached: false });
  } catch (e) {
    return jsonResponse({ ok: false, error: "SEO sync failed: " + String(e && e.message || e) }, 500);
  }
}

/** POST /admin/seo/refresh — force refresh */
async function handleAdminSeoRefresh(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  await env.ADOFF_LICENSES.delete("seo:data");
  try {
    const token = await gscAccessToken(env);
    const END = gscDateStr(2);
    const start30 = gscDateStr(32);
    const start7 = gscDateStr(9);

    const [
      gscAggregated, gscTrend7, gscTrend30,
      topQuery, topPage, topCountry, topDevice, topAppearance, opportunities,
      sitemaps, ga4Data,
    ] = await Promise.allSettled([
      gscQuery(token, { startDate: start30, endDate: END, rowLimit: 1 }),
      gscQuery(token, { startDate: start7, endDate: END, dimensions: ["date"], rowLimit: 10 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["date"], rowLimit: 40 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["query"], rowLimit: 25 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["page"], rowLimit: 25 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["country"], rowLimit: 10 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["device"], rowLimit: 5 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["searchAppearance"], rowLimit: 15 }),
      gscQuery(token, { startDate: start30, endDate: END, dimensions: ["query"], rowLimit: 5000 }),
      fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/sitemaps`, { headers: { Authorization: "Bearer " + token } }).then(r => r.ok ? r.json() : { sitemap: [] }),
      fetchGa4Data(token, env, start30, END),
    ]);

    const getResult = (r, fallback = []) => r.status === "fulfilled" ? (r.value || fallback) : fallback;
    const totals = getResult(gscAggregated)[0] || {};
    const trend7 = getResult(gscTrend7);
    const trend30 = getResult(gscTrend30);

    const seoData = {
      updatedAt: Date.now(),
      range: { start: start30, end: END },
      gsc: {
        totals: {
          clicks: Math.round(totals.clicks || 0),
          impressions: Math.round(totals.impressions || 0),
          ctr: Math.round((totals.ctr || 0) * 1000) / 10,
          position: Math.round((totals.position || 0) * 10) / 10,
        },
        trend7d: trend7.map(r => ({ date: (r.keys && r.keys[0]) || "", clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) })),
        trend30d: trend30.map(r => ({ date: (r.keys && r.keys[0]) || "", clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) })),
        topQuery: gscMapRows(getResult(topQuery)),
        topPage: gscMapRows(getResult(topPage)),
        topCountry: gscMapRows(getResult(topCountry)),
        topDevice: gscMapRows(getResult(topDevice)),
        topAppearance: gscMapRows(getResult(topAppearance)),
        opportunities: gscMapRows(getResult(opportunities)).filter(r => r.position >= 5 && r.position <= 20 && r.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 25),
      },
      sitemaps: parseSitemaps(getResult(sitemaps)),
      ga4: getResult(ga4Data, null),
    };

    await env.ADOFF_LICENSES.put("seo:data", JSON.stringify(seoData));
    return jsonResponse({ ok: true, data: seoData });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

/** GA4 Data API — returns users, sessions, engagement for last N days */
async function fetchGa4Data(token, env, startDate, endDate) {
  const GA4_PROPERTY_ID = env.GA4_PROPERTY_ID;
  if (!GA4_PROPERTY_ID) return null;
  try {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;
    const body = {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "totalUsers" }, { name: "sessions" }, { name: "engagedSessions" },
        { name: "engagementRate" }, { name: "bounceRate" },
        { name: "averageSessionDuration" }, { name: "screenPageViews" },
      ],
      dimensions: [{ name: "date" }],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const rows = json.rows || [];
    const metricNames = (json.metricHeaders || []).map(h => h.name);
    const usersIdx = metricNames.indexOf("totalUsers");
    const sessionsIdx = metricNames.indexOf("sessions");
    const engagedIdx = metricNames.indexOf("engagedSessions");
    const engRateIdx = metricNames.indexOf("engagementRate");
    const bounceIdx = metricNames.indexOf("bounceRate");
    const avgDurIdx = metricNames.indexOf("averageSessionDuration");
    const viewsIdx = metricNames.indexOf("screenPageViews");

    const totals = rows.length ? {
      users: rows.reduce((s, r) => s + parseInt(r.metricValues?.[usersIdx]?.value || 0, 10), 0),
      sessions: rows.reduce((s, r) => s + parseInt(r.metricValues?.[sessionsIdx]?.value || 0, 10), 0),
      engagedSessions: rows.reduce((s, r) => s + parseInt(r.metricValues?.[engagedIdx]?.value || 0, 10), 0),
      engagementRate: rows.reduce((s, r) => s + parseFloat(r.metricValues?.[engRateIdx]?.value || 0), 0) / rows.length,
      bounceRate: rows.reduce((s, r) => s + parseFloat(r.metricValues?.[bounceIdx]?.value || 0), 0) / rows.length,
      avgSessionDuration: rows.reduce((s, r) => s + parseFloat(r.metricValues?.[avgDurIdx]?.value || 0), 0) / rows.length,
      pageViews: rows.reduce((s, r) => s + parseFloat(r.metricValues?.[viewsIdx]?.value || 0), 0),
    } : null;

    const trend = rows.map(r => ({
      date: r.dimensionValues?.[0]?.value || "",
      users: parseInt(r.metricValues?.[usersIdx]?.value || 0),
      sessions: parseInt(r.metricValues?.[sessionsIdx]?.value || 0),
    }));

    return { totals, trend };
  } catch (e) { return null; }
}

/** Parse GSC sitemaps response */
function parseSitemaps(data) {
  if (!data || !data.sitemap) return [];
  return (data.sitemap || []).map(s => ({
    path: s.path || "",
    lastSubmitted: s.lastSubmitted || null,
    lastDownloaded: s.lastDownloaded || null,
    errors: s.errors || 0,
    warnings: s.warnings || 0,
    contents: (s.contents || []).map(c => ({
      type: c.type || "web",
      submitted: c.submitted || 0,
      indexed: c.indexed || 0,
    })),
  }));
}

/** POST /admin/seo/url-inspect — inspect single URL */
async function handleAdminSeoUrlInspect(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ ok: false, error: "Invalid JSON" }, 400); }
  const url = (body && body.url || "").toString().trim();
  if (!url) return jsonResponse({ ok: false, error: "URL required" }, 400);

  try {
    const token = await gscAccessToken(env);
    const resp = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_SITE }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return jsonResponse({ ok: false, error: "GSC inspection failed: " + errText.slice(0, 200) }, 500);
    }
    const json = await resp.json();
    return jsonResponse({ ok: true, result: json.inspectionResult || {} });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

/** POST /admin/seo/sitemap/submit — submit sitemap to Google */
async function handleAdminSeoSitemapSubmit(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ ok: false, error: "Invalid JSON" }, 400); }
  const sitemapUrl = (body && body.sitemapUrl || "").toString().trim();
  if (!sitemapUrl) return jsonResponse({ ok: false, error: "sitemapUrl required" }, 400);

  try {
    const token = await gscAccessToken(env);
    // PUT /sitemaps/{feedpath} — feedpath è l'URL-encoded sitemap path
    const feedpath = encodeURIComponent(sitemapUrl);
    const resp = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/sitemaps/${feedpath}`,
      { method: "PUT", headers: { Authorization: "Bearer " + token } }
    );
    const text = await resp.text();
    if (!resp.ok) return jsonResponse({ ok: false, error: "Submit failed: " + text.slice(0, 200) }, 500);
    return jsonResponse({ ok: true, result: JSON.parse(text) });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

/** POST /admin/seo/url-inspect/batch — batch inspect URLs from sitemap */
async function handleAdminSeoUrlInspectBatch(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ ok: false, error: "Invalid JSON" }, 400); }
  const sitemapUrl = (body && body.sitemapUrl || "https://adoff.app/sitemap.xml").toString().trim();

  try {
    const token = await gscAccessToken(env);
    const sitemapResp = await fetch(sitemapUrl);
    if (!sitemapResp.ok) return jsonResponse({ ok: false, error: "Cannot fetch sitemap: " + sitemapResp.status }, 500);
    const sitemapText = await sitemapResp.text();
    const urls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]).slice(0, 100);

    const toInspect = urls.slice(0, 20);
    const results = [];
    for (const url of toInspect) {
      try {
        const resp = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_SITE }),
        });
        if (resp.ok) {
          const json = await resp.json();
          const r = json.inspectionResult || {};
          results.push({ url, indexed: r.indexStatusResult?.indexStatus === "INDEXED", status: r.indexStatusResult?.indexStatus || "UNKNOWN" });
        } else {
          results.push({ url, indexed: false, status: "ERROR", error: resp.status });
        }
      } catch (e) {
        results.push({ url, indexed: false, status: "ERROR", error: String(e && e.message || e) });
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return jsonResponse({ ok: true, results, total: urls.length, inspected: toInspect.length });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

/** GET /admin/seo/export — CSV export */
async function handleAdminSeoExport(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  const cached = await kvGet(env.ADOFF_LICENSES, "seo:data", "json");
  if (!cached) return jsonResponse({ ok: false, error: "Nessun dato — esegui prima Aggiorna" }, 400);

  const { gsc } = cached;
  const rows = [
    "Keyword,Clicks,Impressions,CTR,Position",
    ...(gsc.topQuery || []).map(r => `"${r.key}",${r.clicks},${r.impressions},${r.ctr}%,${r.position}`)
  ].join("\n");

  return new Response(rows, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="adoff-seo-${gsc.range?.end || new Date().toISOString().slice(0,10)}.csv"` },
  });
}

/**
 * GET /admin/autofix/status — ritorna lo stato del sistema autofix dal file statico.
 * Legge /autofix-status.json (scritto da autofix_nightly.sh, servito da CF Pages).
 */
async function handleAdminAutofixStatus(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }
  try {
    const resp = await fetch("https://adoff.app/autofix-status.json");
    if (!resp.ok) {
      return jsonResponse({ ok: false, error: "Status file unavailable" }, 502);
    }
    const status = await resp.json();
    try {
      const dash = await buildAutofixDashboard(env);
      status.pending_decisions = dash.counts.pending;
      status.approved_unapplied = dash.counts.approved_unapplied;
      status.deferred = dash.counts.deferred;
    } catch (_) {}
    return jsonResponse({ ok: true, ...status });
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
}

/** ─────────────────────────────────────────────────────────────────────────────
 * Helper interno — costruisce l'oggetto dashboard per autofix leaks.
 ───────────────────────────────────────────────────────────────────────────── */
async function buildAutofixDashboard(env) {
  const now = new Date().toISOString();
  const leaksRows = await env.DB.prepare(`SELECT * FROM autofix_leaks`).all();
  const decRows   = await env.DB.prepare(`SELECT * FROM autofix_decisions`).all();
  const decMap = {};
  for (const d of decRows.results) { decMap[d.fingerprint] = d; }

  const ads_real = [], tracking = [], dom_fp = [];
  let pending = 0, approved_unapplied = 0, deferred = 0;

  for (const l of leaksRows.results) {
    const dec = decMap[l.fingerprint];
    const obj = {
      ...l,
      candidate_rule: l.candidate_rule ? JSON.parse(l.candidate_rule) : null,
      decision: dec ? (dec.decision || null) : null,
      note: dec ? (dec.note || null) : null,
      applied: dec ? (dec.applied || 0) : 0,
      screenshot_url: l.screenshot ? `/admin/autofix/screenshot?fp=${l.fingerprint}` : null,
    };
    if (l.fp_suspect === 1) {
      dom_fp.push(obj);
    } else if (l.confidence === 'high') {
      ads_real.push(obj);
    } else {
      tracking.push(obj);
    }
    if (l.status === 'open' && !dec) pending++;
    else if (dec && dec.decision === 'fix' && !dec.applied) approved_unapplied++;
    else if (dec && dec.decision === 'defer') deferred++;
  }

  const sortBy = arr => arr.sort((a, b) => a.domain.localeCompare(b.domain));
  return {
    generated: now,
    counts: { pending, approved_unapplied, deferred, total: leaksRows.results.length },
    buckets: {
      ads_real: sortBy(ads_real),
      tracking:  sortBy(tracking),
      dom_fp:    sortBy(dom_fp),
    },
  };
}

/** ─────────────────────────────────────────────────────────────────────────────
 * POST /admin/autofix/ingest — ingestisce leak dal crawler.
 ───────────────────────────────────────────────────────────────────────────── */
async function handleAutofixIngest(request, env) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch (_) { return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400); }
  const { leaks = [], shots = {} } = body;
  if (!Array.isArray(leaks) || leaks.length === 0) return jsonResponse({ ok: false, error: 'No leaks provided' }, 400);

  const now = new Date().toISOString();
  let ingested = 0;

  for (const leak of leaks) {
    const cr = leak.candidate_rule != null ? JSON.stringify(leak.candidate_rule) : null;
    await env.DB.prepare(`
      INSERT INTO autofix_leaks
        (fingerprint, domain, category, site_type, country, leak_type, ad_network,
         blocked_url, selector, candidate_rule, confidence, fp_suspect, screenshot,
         first_seen, last_seen, status)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,'open')
      ON CONFLICT(fingerprint) DO UPDATE SET
        domain=excluded.domain, category=excluded.category, site_type=excluded.site_type,
        country=excluded.country, leak_type=excluded.leak_type, ad_network=excluded.ad_network,
        blocked_url=excluded.blocked_url, selector=excluded.selector,
        candidate_rule=excluded.candidate_rule, confidence=excluded.confidence,
        fp_suspect=excluded.fp_suspect, screenshot=excluded.screenshot,
        last_seen=excluded.last_seen
    `).bind(
      leak.fingerprint, leak.domain, leak.category, leak.site_type, leak.country,
      leak.leak_type, leak.ad_network, leak.blocked_url, leak.selector, cr,
      leak.confidence, leak.fp_suspect ? 1 : 0, leak.screenshot || null,
      now, now
    ).run();
    ingested++;
  }

  for (const [fp, b64] of Object.entries(shots)) {
    if (b64) await env.ADOFF_LICENSES.put(`autofix:shot:${fp}`, b64);
  }

  const dash = await buildAutofixDashboard(env);
  await env.ADOFF_LICENSES.put('autofix:dashboard', JSON.stringify(dash));
  return jsonResponse({ ok: true, ingested });
}

/** ─────────────────────────────────────────────────────────────────────────────
 * GET /admin/autofix/leaks — restituisce la dashboard (da KV o fallback).
 ───────────────────────────────────────────────────────────────────────────── */
async function handleAutofixLeaks(request, env) {
  if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  try {
    const cached = await env.ADOFF_LICENSES.get('autofix:dashboard');
    if (cached) return jsonResponse({ ok: true, ...JSON.parse(cached) });
  } catch (_) {}
  const dash = await buildAutofixDashboard(env);
  return jsonResponse({ ok: true, ...dash });
}

/** ─────────────────────────────────────────────────────────────────────────────
 * POST /admin/autofix/decision — registra una o piu' decisioni su leak.
 ───────────────────────────────────────────────────────────────────────────── */
async function handleAutofixDecision(request, env) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch (_) { return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400); }

  const raw = body.decisions ? body.decisions : [body];
  const decisions = raw.filter(d => d.fingerprint && d.decision);
  const validDecisions = ['fix', 'ignore', 'defer'];
  for (const d of decisions) {
    if (!validDecisions.includes(d.decision))
      return jsonResponse({ ok: false, error: `Invalid decision: ${d.decision}` }, 400);
  }
  if (decisions.length === 0) return jsonResponse({ ok: false, error: 'No valid decisions' }, 400);

  const now = new Date().toISOString();
  let updated = 0;

  for (const { fingerprint, decision, note } of decisions) {
    await env.DB.prepare(`
      INSERT INTO autofix_decisions
        (fingerprint, decision, note, decided_by, decided_at, applied)
      VALUES (?1,?2,?3,'admin',?4,0)
      ON CONFLICT(fingerprint) DO UPDATE SET
        decision=excluded.decision, note=excluded.note,
        decided_by='admin', decided_at=excluded.decided_at, applied=0
    `).bind(fingerprint, decision, note || null, now).run();

    const statusMap = { ignore: 'ignored', defer: 'deferred' };
    const newStatus = statusMap[decision] || 'open';
    await env.DB.prepare(`UPDATE autofix_leaks SET status=?1 WHERE fingerprint=?2`)
      .bind(newStatus, fingerprint).run();
    updated++;
  }

  const dash = await buildAutofixDashboard(env);
  await env.ADOFF_LICENSES.put('autofix:dashboard', JSON.stringify(dash));
  return jsonResponse({ ok: true, updated });
}

/** ─────────────────────────────────────────────────────────────────────────────
 * GET /admin/autofix/screenshot — restituisce screenshot PNG del leak.
 ───────────────────────────────────────────────────────────────────────────── */
async function handleAutofixScreenshot(request, env) {
  if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  const fp = new URL(request.url).searchParams.get('fp');
  if (!fp) return jsonResponse({ ok: false, error: 'Missing fp parameter' }, 400);
  let b64;
  try { b64 = await env.ADOFF_LICENSES.get(`autofix:shot:${fp}`); } catch (_) {}
  if (!b64) return jsonResponse({ ok: false, error: 'Screenshot not found' }, 404);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' },
  });
}

/**
 * GET /admin/edge/status — verifica le credenziali dell'Edge Add-ons API v1.1.
 *
 * NB (doc ufficiale Microsoft): l'API v1.1 NON espone alcun GET su /products/{id},
 * /submissions o /submissions/draft — quegli endpoint tornano sempre 404 "Resource not
 * found" perché non esistono (la vecchia implementazione li sondava, da qui i 404 fuorvianti).
 * Gli UNICI GET validi sono gli status di un'operazione:
 *   GET /v1/products/{id}/submissions/operations/{operationId}
 * Lo usiamo come health-check dell'auth con un operationId fittizio ben formato:
 *   - creds VALIDE  → 404 sull'operazione (auth passata, l'operazione non esiste)
 *   - creds SCADUTE → 401/403 (auth rifiutata → API key da rinnovare in Partner Center)
 */
async function handleAdminEdgeStatus(request, env) {
  const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!await verifyAdminAuth(adminToken, env)) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }
  const EDGE_PRODUCT_ID = env.EDGE_PRODUCT_ID;
  const EDGE_API_KEY = env.EDGE_API_KEY;
  const EDGE_CLIENT_ID = env.EDGE_CLIENT_ID;
  if (!EDGE_PRODUCT_ID) return jsonResponse({ ok: false, error: 'EDGE_PRODUCT_ID not configured' }, 400);
  if (!EDGE_API_KEY) return jsonResponse({ ok: false, error: 'EDGE_API_KEY not configured' }, 400);
  if (!EDGE_CLIENT_ID) return jsonResponse({ ok: false, error: 'EDGE_CLIENT_ID not configured' }, 400);

  const DUMMY_OPERATION_ID = '00000000-0000-0000-0000-000000000000';
  const probeUrl = `https://api.addons.microsoftedge.microsoft.com/v1/products/${EDGE_PRODUCT_ID}/submissions/operations/${DUMMY_OPERATION_ID}`;

  let httpStatus = 0;
  let body = null;
  try {
    const resp = await fetch(probeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `ApiKey ${EDGE_API_KEY}`,
        'X-ClientID': EDGE_CLIENT_ID,
      },
    });
    httpStatus = resp.status;
    const text = await resp.text();
    try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  } catch (e) {
    return jsonResponse({ ok: false, error: 'Edge API unreachable: ' + String(e && e.message || e) }, 502);
  }

  // 404 sull'operazione fittizia = auth OK; 401/403 = credenziali scadute/non valide.
  const credsValid = httpStatus === 404 || httpStatus === 200 || httpStatus === 202;
  const authRejected = httpStatus === 401 || httpStatus === 403;

  let state, message;
  if (credsValid) {
    state = 'ok';
    message = 'Credenziali Edge API valide — pronto per upload/publish.';
  } else if (authRejected) {
    state = 'expired';
    message = 'API key Edge scaduta o non valida (HTTP ' + httpStatus + '). Rinnova in Partner Center → Microsoft Edge → Publish API → Create API credentials, poi aggiorna EDGE_API_KEY.';
  } else {
    state = 'unknown';
    message = 'Risposta inattesa dall\'Edge API (HTTP ' + httpStatus + ').';
  }

  return jsonResponse({
    ok: true,
    productId: EDGE_PRODUCT_ID,
    state,
    message,
    probe: { httpStatus, body },
  });
}

export default {
  // Cron trigger — eseguito da Cloudflare ogni giorno alle 09:00 UTC
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },

  async fetch(request, env) {
    // Auto-create tracking tables (run on every worker startup — CREATE IF NOT EXISTS è idempotente)
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS install_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT NOT NULL,
          install_ts INTEGER NOT NULL,
          country TEXT,
          browser TEXT,
          source TEXT,
          plan TEXT DEFAULT 'free',
          version TEXT,
          timezone TEXT,
          UNIQUE(device_id, install_ts)
        )
      `).run();

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS uninstall_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT NOT NULL,
          uninstall_ts INTEGER NOT NULL,
          reason TEXT,
          comment TEXT,
          version TEXT,
          was_pro INTEGER DEFAULT 0,
          country TEXT
        )
      `).run();

      // adleak_reports: domain opt-in per survey uninstall
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS adleak_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT,
          uninstall_ts INTEGER NOT NULL,
          reason TEXT,
          problem_domain TEXT,
          version TEXT,
          was_pro INTEGER DEFAULT 0,
          country TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS device_heartbeat (
          device_id TEXT PRIMARY KEY,
          last_seen INTEGER NOT NULL,
          country TEXT,
          browser TEXT,
          plan TEXT DEFAULT 'free',
          version TEXT,
          install_ts INTEGER
        )
      `).run();

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS autofix_leaks (
          fingerprint TEXT PRIMARY KEY,
          domain TEXT, category TEXT, site_type TEXT, country TEXT,
          leak_type TEXT, ad_network TEXT, blocked_url TEXT, selector TEXT,
          candidate_rule TEXT, confidence TEXT, fp_suspect INTEGER DEFAULT 0,
          screenshot TEXT, status TEXT DEFAULT 'open',
          first_seen TEXT, last_seen TEXT
        )
      `).run();

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS autofix_decisions (
          fingerprint TEXT PRIMARY KEY,
          decision TEXT, note TEXT, decided_by TEXT, decided_at TEXT,
          applied INTEGER DEFAULT 0, applied_by TEXT, applied_at TEXT
        )
      `).run();
    } catch (e) {
      console.error("D1 init tables error:", e.message);
    }

    const corsHeaders = getCorsHeaders(request);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    // Same-origin support: requests via adoff.app/api/* route here too.
    // Strip the /api prefix so internal routing is identical to api.adoff.app/*.
    let path = url.pathname;
    if (path === "/api" || path === "/api/") path = "/";
    else if (path.startsWith("/api/")) path = path.slice(4);

    // Health check — no rate limit
    if (path === "/health" && request.method === "GET") {
      return handleHealth();
    }

    // Admin panel — served from KV with no-cache headers
    // NOTE: /admin serves the same HTML as /panel (via Pages), but via worker+KV.
    // Keep no-cache headers so the CDN does not cache stale versions.
    if ((path === "/admin" || path === "/admin.html") && request.method === "GET") {
      const html = await kvGet(env.ADOFF_LICENSES, "admin:html");
      if (!html) return new Response("Admin panel not installed. Run: wrangler kv:key put --namespace-id=... admin:html --path=admin.html", { status: 404 });

      const headers = new Headers();
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
      headers.set("CDN-Cache-Control", "no-store");
      headers.set("Cloudflare-CDN-Cache-Control", "no-store");
      headers.set("Surrogate-Control", "no-store");
      headers.set("Vary", "*");

      return new Response(html, { status: 200, headers });
    }


    // Stripe webhook — no rate limit (Stripe deve sempre passare)
    if (path === "/stripe-webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }

    // Telegram webhook — no rate limit, auth via secret header (approvazione real-time)
    if (path === "/tg-webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    // Admin: registra il webhook Telegram (one-shot, admin-gated).
    // NB: withCors non è ancora definito qui (const più sotto) → return diretto, come stripe/tg-webhook.
    if (path === "/admin/tg-setup-webhook" && request.method === "POST") {
      return handleAdminSetupTelegramWebhook(env, request);
    }
    // Admin: forza l'aggiornamento immediato dei dati Google Search Console.
    if (path === "/admin/gsc/sync" && request.method === "POST") {
      return handleAdminGscSync(request, env);
    }
    // Admin: crea un forum topic Telegram e salva il thread id in KV.
    if (path === "/admin/tg-create-topic" && request.method === "POST") {
      let tBody; try { tBody = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }
      return handleAdminCreateTopic(tBody, env, request);
    }

    // Admin endpoints — no rate limit (autenticati via password admin)
    // Rate limiting solo per endpoint pubblici
    const isAdminEndpoint = path.startsWith("/admin");
    if (!isAdminEndpoint) {
      const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
      const allowed = await checkRateLimit(ip, env);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Helper: garantisce che OGNI risposta abbia i CORS headers dinamici corretti
    const withCors = async (handlerPromise) => {
      const resp = await handlerPromise;
      // Redirect responses (3xx) non vengono modificate — il browser le segue direttamente
      if (resp.status >= 300 && resp.status < 400) return resp;
      const newHeaders = new Headers(resp.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        newHeaders.set(k, v);
      }
      return new Response(resp.body, { status: resp.status, headers: newHeaders });
    };

    // GET endpoints
    if (request.method === "GET") {
      if (path === "/stats") return withCors(handleStats(env));
      if (path === "/affiliate/stats") return withCors(handleAffiliateStats(request, env));
      if (path === "/affiliate/me") return withCors(handleAffiliateMe(request, env));
      if (path === "/referral/stats") return withCors(handleReferralStats(request, env));
      if (path === "/admin/stats") return withCors(handleAdminStats(request, env));
      if (path === "/admin/retention") return withCors(handleAdminRetention(request, env));
      if (path === "/admin/analytics") return withCors(handleAdminAnalytics(request, env));
      if (path === "/admin/revenue") return withCors(handleAdminRevenue(request, env));
      if (path === "/admin/licenses") return withCors(handleAdminListLicenses(request, env));
      if (path === "/admin/chats") return withCors(handleAdminListChats(request, env));
      if (path.startsWith("/admin/chat/")) return withCors(handleAdminGetChat(request, env, path.split("/admin/chat/")[1]));
      if (path === "/attribution/stats") return withCors(handleAttributionStats(request, env));
      if (path === "/admin/outreach") return withCors(handleOutreachList(request, env));
      if (path === "/admin/gsc") return withCors(handleAdminGsc(request, env));
      if (path === "/admin/seo") return withCors(handleAdminSeo(request, env));
      if (path === "/admin/seo/export") return withCors(handleAdminSeoExport(request, env));
      if (path === "/admin/seo-reply") return withCors(handleAdminSeoReply(request, env));
      if (path === "/admin/autofix/status")    return withCors(handleAdminAutofixStatus(request, env));
      if (path === "/admin/autofix/leaks")     return withCors(handleAutofixLeaks(request, env));
      if (path === "/admin/autofix/screenshot") return withCors(handleAutofixScreenshot(request, env));
      if (path === "/admin/edge/status") return withCors(handleAdminEdgeStatus(request, env));
      if (path === "/success") return withCors(handleSuccess(request, env));
      if (path === "/portal") return withCors(handlePortalSession(request, env));
      if (path === "/founder-status") return withCors(handleFounderStatus(env));
      if (path === "/tickets") return withCors(handleListTickets(request, env));
      if (path === "/trial/check") return withCors(handleTrialCheck(request, env));
      if (path === "/admin/suggestions/digest") return withCors(handleAdminSuggestionsDigest(request, env));
      if (path === "/admin/suggestions") return withCors(handleAdminListSuggestions(request, env));
      if (path.startsWith("/ticket/")) return withCors(handleGetTicket(request, env, path.split("/ticket/")[1]));
      if (path === "/account/devices") return withCors(handleAccountDevices(request, env));
      if (path === "/account/profile") return withCors(handleAccountProfile(request, env));
      if (path === "/account/me") return withCors(handleAccountProfile(request, env)); // alias for account.html
      if (path === "/oauth/google/start") return handleOAuthStart("google", env); // redirect — no CORS wrap
      if (path === "/oauth/google-admin/start") return handleOAuthStart("google", env, "admin"); // login super-admin — pubblico, gate sull'email nel callback
      if (path === "/oauth/microsoft/start") return handleOAuthStart("microsoft", env); // redirect — no CORS wrap
      if (path === "/oauth/google/callback") return handleOAuthCallback("google", request, env); // redirect — no CORS wrap
      if (path === "/oauth/microsoft/callback") return handleOAuthCallback("microsoft", request, env); // redirect — no CORS wrap
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST admin endpoints — autofix
    if (request.method === "POST") {
      if (path === "/admin/autofix/ingest") return withCors(handleAutofixIngest(request, env));
      if (path === "/admin/autofix/decision") return withCors(handleAutofixDecision(request, env));
    }

    // Auth endpoints — own rate limiting, before generic rate limit check
    if (path === "/auth/register" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAuthRegister(authBody, env, request));
    }
    if (path === "/auth/login" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAuthLogin(authBody, env, request));
    }
    if (path === "/auth/verify-email" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAuthVerifyEmail(authBody, env));
    }
    if (path === "/auth/forgot-password" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAuthForgotPassword(authBody, env, request));
    }
    if (path === "/auth/reset-password" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAuthResetPassword(authBody, env));
    }
    if (path === "/auth/activate-account" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAuthActivateAccount(authBody, env));
    }
    if (path === "/auth/google-extension" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAuthGoogleExtension(authBody, env, request));
    }
    if (path === "/account/link-license" && request.method === "POST") {
      let authBody;
      try { authBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAccountLinkLicense(authBody, env, request));
    }
    if (path === "/affiliate/register" && request.method === "POST") {
      return withCors(handleAffiliateRegister(request, env));
    }
    if (path === "/referral/register-code" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleReferralRegisterCode(body, env, request));
    }

    // Account management endpoints (own JSON parsing, before generic switch)
    if (path === "/account/login" && request.method === "POST") {
      const loginIp = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
      if (!await checkAuthRateLimit(loginIp, env)) {
        return withCors(jsonResponse({ ok: false, error: "Too many attempts, try again later" }, 429));
      }
      let accBody;
      try { accBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAccountLogin(accBody, env));
    }
    if (path === "/account/remove-device" && request.method === "POST") {
      let accBody;
      try { accBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAccountRemoveDevice(accBody, env, request));
    }
    if (path === "/account/remove-all" && request.method === "POST") {
      let accBody;
      try { accBody = await request.json(); } catch { accBody = {}; }
      return withCors(handleAccountRemoveAll(accBody, env, request));
    }

    // Checkout session (crea sessione Stripe con dark mode)
    if (path === "/checkout" && request.method === "POST") {
      let checkoutBody;
      try { checkoutBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleCreateCheckout(checkoutBody, env));
    }

    // AI support chatbot
    if (path === "/chat" && request.method === "POST") {
      let chatBody;
      try { chatBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleChat(chatBody, request, env));
    }

    // Attribution endpoints (GET /attribution/stats handled in the GET block above)
    if (path === "/attribution/install" && request.method === "POST") {
      return withCors(handleAttributionInstall(request, env));
    }

    // Ticket system
    if (path === "/ticket" && request.method === "POST") {
      let ticketBody;
      try { ticketBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleCreateTicket(ticketBody, env, request));
    }
    if (path.startsWith("/ticket/") && request.method === "POST") {
      let updateBody;
      try { updateBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleUpdateTicket(updateBody, env, request, path.split("/ticket/")[1]));
    }

    // Admin — suggerimenti (notify + update). Auth via X-Admin-Token nei rispettivi handler.
    if (path === "/admin/suggestions/notify" && request.method === "POST") {
      let nBody;
      try { nBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAdminNotifyTelegram(nBody, env, request));
    }
    if (path.startsWith("/admin/suggestions/") && request.method === "POST") {
      let sBody;
      try { sBody = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
      return withCors(handleAdminUpdateSuggestion(sBody, env, request, path.split("/admin/suggestions/")[1]));
    }

    // Tracking endpoints — rate-limited, no auth, read request.cf before body parse
    if (path === "/track/install" && request.method === "POST") {
      return withCors(handleTrackInstall(request, env));
    }
    if (path === "/track/heartbeat" && request.method === "POST") {
      return withCors(handleHeartbeat(request, env));
    }
    if (path === "/track/download" && request.method === "POST") {
      return withCors(handleTrackDownload(request, env));
    }
    if (path === "/track/uninstall" && request.method === "POST") {
      return withCors(handleUninstall(request, env));
    }

    // POST endpoints
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    switch (path) {
      case "/trial":
        return withCors(handleTrial(body, env, request));
      case "/validate":
        return withCors(handleValidate(body, env, request));
      case "/activate":
        return withCors(handleActivate(body, env, request));
      case "/deactivate":
        return withCors(handleDeactivate(body, env, request));
      case "/revoke":
        return withCors(handleRevoke(body, env, request));
      case "/admin/generate-key":
        return withCors(handleAdminGenerateKey(body, env, request));
      case "/admin/delete-license":
        return withCors(handleDeleteLicense(body, env, request));
      case "/admin/license-update":
        return withCors(handleAdminLicenseUpdate(body, env, request));
      case "/admin/outreach-update":
        return withCors(handleOutreachUpdate(body, env, request));
      case "/admin/outreach-code":
        return withCors(handleOutreachCreateCode(body, env, request));
      case "/admin/login": {
        const adminLoginIp = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
        if (!await checkAuthRateLimit(adminLoginIp, env)) {
          return withCors(jsonResponse({ ok: false, error: "Too many attempts, try again later" }, 429));
        }
        return withCors(handleAdminLogin(body, env));
      }
      case "/admin/change-password":
        return withCors(handleAdminChangePassword(body, env, request));
      case "/admin/reset-password":
        return withCors(handleAdminResetPassword(body, env));
      case "/admin/reset-confirm":
        return withCors(handleAdminResetConfirm(body, env));
      case "/admin/seo/refresh":
        return withCors(handleAdminSeoRefresh(request, env));
      case "/admin/seo/url-inspect":
        return withCors(handleAdminSeoUrlInspect(request, env));
      case "/admin/seo/url-inspect/batch":
        return withCors(handleAdminSeoUrlInspectBatch(request, env));
      case "/admin/seo/sitemap/submit":
        return withCors(handleAdminSeoSitemapSubmit(request, env));
      default:
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  },
};
