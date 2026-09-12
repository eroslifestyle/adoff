/**
 * Cloudflare Worker — AdOff Ticket Proxy + Auto-Reply
 *
 * Endpoint:
 *   POST /report   → Topic "Support" (thread 7)
 *   POST /suggest  → Topic "Suggerimenti" (thread 8)
 *   POST /webhook  → Telegram webhook: reply in topic → email all'utente
 *
 * Secrets:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *   RESEND_API_KEY (da resend.com, gratis 100 email/giorno)
 */

const LIMITS = {
  PER_HOUR: 3,
  PER_DAY: 10,
  MAX_URL_LENGTH: 500,
  MAX_DESC_LENGTH: 1000,
  MAX_TITLE_LENGTH: 200,
  MAX_BODY_SIZE: 4096,
  MAX_EMAIL_LENGTH: 254,
};

const VALID_REPORT_TYPES = ["broken", "ads-visible", "antiblock", "other"];
const VALID_SUGGEST_TYPES = ["feature", "bug", "improvement"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOPIC_SUPPORT = 7;
const TOPIC_SUGGEST = 8;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Email da cui invii le risposte
const FROM_EMAIL = "support@adoff.app";
const FROM_NAME  = "AdOff Support";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const contentLength = parseInt(request.headers.get("Content-Length") || "0", 10);
    if (contentLength > LIMITS.MAX_BODY_SIZE) {
      return jsonResponse({ error: "Payload too large" }, 413);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (path.endsWith("/webhook")) {
      return handleWebhook(body, env);
    }
    if (path.endsWith("/suggest")) {
      return handleSuggest(body, request, env);
    }
    return handleReport(body, request, env);
  },
};

// ==================== REPORT (Support) ====================

async function handleReport(body, request, env) {
  const { url, type, desc, email, version } = body;

  if (!url || typeof url !== "string" || url.length < 3 || url.length > LIMITS.MAX_URL_LENGTH) {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }
  if (!type || !VALID_REPORT_TYPES.includes(type)) {
    return jsonResponse({ error: "Invalid type" }, 400);
  }
  if (desc && (typeof desc !== "string" || desc.length > LIMITS.MAX_DESC_LENGTH)) {
    return jsonResponse({ error: "Description too long" }, 400);
  }
  if (email && (typeof email !== "string" || !EMAIL_REGEX.test(email) || email.length > LIMITS.MAX_EMAIL_LENGTH)) {
    return jsonResponse({ error: "Invalid email" }, 400);
  }

  const sanitizedUrl = sanitize(url).substring(0, LIMITS.MAX_URL_LENGTH);
  const sanitizedDesc = desc ? sanitize(desc).substring(0, LIMITS.MAX_DESC_LENGTH) : "";
  const sanitizedEmail = email ? email.trim().toLowerCase() : "";

  // Anti-spam URL
  if (!sanitizedUrl.includes(".") || !/[a-zA-Z]/.test(sanitizedUrl)) {
    return jsonResponse({ error: "Invalid URL format" }, 400);
  }
  if (/(.)\1{3,}/i.test(sanitizedUrl)) return jsonResponse({ error: "Invalid URL" }, 400);
  const kbPatterns = ["qwert", "asdfg", "zxcvb", "12345", "aaaaa"];
  if (kbPatterns.some((p) => sanitizedUrl.toLowerCase().includes(p))) {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }

  // Anti-spam descrizione
  if (sanitizedDesc.length > 10) {
    if (calcEntropy(sanitizedDesc) < 2.0) return jsonResponse({ error: "Description spam" }, 400);
    if (/(.)\1{4,}/i.test(sanitizedDesc)) return jsonResponse({ error: "Description spam" }, 400);
    if (/(.{2,3})\1{3,}/i.test(sanitizedDesc)) return jsonResponse({ error: "Description spam" }, 400);
  }

  // Rate limit
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rlResult = await checkRateLimit(ip, "report", env);
  if (rlResult) return rlResult;

  // Messaggio
  const TYPE_LABELS = {
    broken: "Sito non funziona",
    "ads-visible": "Ads ancora visibili",
    antiblock: "Anti-adblock",
    other: "Altro",
  };
  const now = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });

  const message =
    "\uD83D\uDD34 *Nuova segnalazione*\n\n" +
    "\uD83C\uDF10 *Sito:* `" + escMd(sanitizedUrl) + "`\n" +
    "\uD83D\uDCC1 *Problema:* " + (TYPE_LABELS[type] || type) + "\n" +
    (sanitizedDesc ? "\uD83D\uDCDD *Descrizione:* " + escMd(sanitizedDesc) + "\n" : "") +
    (sanitizedEmail ? "\uD83D\uDCE7 *Email:* `" + sanitizedEmail + "`\n" : "\u26A0 _Nessuna email fornita_\n") +
    "\uD83D\uDCE6 *Versione:* " + escMd(String(version || "N/A")) + "\n" +
    "\uD83C\uDF0D *IP:* `" + ip + "`\n" +
    "\uD83D\uDCC5 *Data:* " + now +
    (sanitizedEmail ? "\n\n\u2139 _Rispondi a questo messaggio per inviare email all'utente_" : "");

  return sendToTelegram(message, TOPIC_SUPPORT, env);
}

// ==================== SUGGEST (Suggerimenti) ====================

async function handleSuggest(body, request, env) {
  const { type, title, desc, email, version } = body;

  if (!title || typeof title !== "string" || title.length < 3 || title.length > LIMITS.MAX_TITLE_LENGTH) {
    return jsonResponse({ error: "Invalid title" }, 400);
  }
  if (!type || !VALID_SUGGEST_TYPES.includes(type)) {
    return jsonResponse({ error: "Invalid type" }, 400);
  }
  if (desc && (typeof desc !== "string" || desc.length > LIMITS.MAX_DESC_LENGTH)) {
    return jsonResponse({ error: "Description too long" }, 400);
  }
  if (email && (typeof email !== "string" || !EMAIL_REGEX.test(email) || email.length > LIMITS.MAX_EMAIL_LENGTH)) {
    return jsonResponse({ error: "Invalid email" }, 400);
  }

  const sanitizedTitle = sanitize(title).substring(0, LIMITS.MAX_TITLE_LENGTH);
  const sanitizedDesc = desc ? sanitize(desc).substring(0, LIMITS.MAX_DESC_LENGTH) : "";
  const sanitizedEmail = email ? email.trim().toLowerCase() : "";

  // Anti-spam
  if (/(.)\1{3,}/i.test(sanitizedTitle)) return jsonResponse({ error: "Title spam" }, 400);
  if (sanitizedTitle.length > 5 && calcEntropy(sanitizedTitle) < 1.5) {
    return jsonResponse({ error: "Title spam" }, 400);
  }
  if (sanitizedDesc.length > 10) {
    if (calcEntropy(sanitizedDesc) < 2.0) return jsonResponse({ error: "Description spam" }, 400);
    if (/(.)\1{4,}/i.test(sanitizedDesc)) return jsonResponse({ error: "Description spam" }, 400);
    if (/(.{2,3})\1{3,}/i.test(sanitizedDesc)) return jsonResponse({ error: "Description spam" }, 400);
  }

  // Rate limit
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rlResult = await checkRateLimit(ip, "suggest", env);
  if (rlResult) return rlResult;

  // Messaggio
  const TYPE_ICONS = { feature: "\uD83D\uDCA1", bug: "\uD83D\uDC1B", improvement: "\u26A1" };
  const TYPE_LABELS = { feature: "Funzionalita'", bug: "Bug", improvement: "Miglioramento" };
  const now = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });

  const message =
    (TYPE_ICONS[type] || "\uD83D\uDCA1") + " *Nuovo suggerimento*\n\n" +
    "\uD83C\uDFF7 *Tipo:* " + (TYPE_LABELS[type] || type) + "\n" +
    "\uD83D\uDCCC *Titolo:* " + escMd(sanitizedTitle) + "\n" +
    (sanitizedDesc ? "\uD83D\uDCDD *Descrizione:* " + escMd(sanitizedDesc) + "\n" : "") +
    (sanitizedEmail ? "\uD83D\uDCE7 *Email:* `" + sanitizedEmail + "`\n" : "\u26A0 _Nessuna email fornita_\n") +
    "\uD83D\uDCE6 *Versione:* " + escMd(String(version || "N/A")) + "\n" +
    "\uD83C\uDF0D *IP:* `" + ip + "`\n" +
    "\uD83D\uDCC5 *Data:* " + now +
    (sanitizedEmail ? "\n\n\u2139 _Rispondi a questo messaggio per inviare email all'utente_" : "");

  return sendToTelegram(message, TOPIC_SUGGEST, env);
}

// ==================== WEBHOOK (Reply → Email) ====================

async function handleWebhook(body, env) {
  // Telegram invia l'update quando qualcuno risponde nel gruppo
  const msg = body.message;
  if (!msg) return jsonResponse({ ok: true });

  // Deve essere una risposta (reply) a un messaggio del bot
  const reply = msg.reply_to_message;
  if (!reply) return jsonResponse({ ok: true });
  if (!reply.from || !reply.from.is_bot) return jsonResponse({ ok: true });

  // Estrai l'email dal messaggio originale del bot
  const originalText = reply.text || "";
  const emailMatch = originalText.match(/Email:\s*([^\s\n]+@[^\s\n]+)/);
  if (!emailMatch) return jsonResponse({ ok: true }); // Nessuna email nel messaggio originale

  const recipientEmail = emailMatch[1].replace(/`/g, "").trim();
  if (!EMAIL_REGEX.test(recipientEmail)) return jsonResponse({ ok: true });

  // Il testo della risposta e' il corpo dell'email
  const replyText = msg.text;
  if (!replyText || replyText.length < 2) return jsonResponse({ ok: true });

  // Determina il contesto (support o suggerimento) dal topic
  const threadId = msg.message_thread_id;
  const isSupport = threadId === TOPIC_SUPPORT;
  const subject = isSupport
    ? "AdOff Support — Risposta alla tua segnalazione"
    : "AdOff — Aggiornamento sul tuo suggerimento";

  // Invia email via Resend
  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    // Notifica su Telegram che l'email non e' stata inviata
    await sendToTelegram("\u274C Email non inviata: RESEND\\_API\\_KEY non configurata", threadId, env);
    return jsonResponse({ ok: true });
  }

  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_NAME + " <" + FROM_EMAIL + ">",
        to: [recipientEmail],
        subject,
        html: buildEmailHtml(replyText, isSupport),
      }),
    });

    if (emailRes.ok) {
      // Conferma su Telegram
      await sendToTelegram(
        "\u2705 Email inviata a `" + recipientEmail + "`",
        threadId,
        env
      );
    } else {
      const err = await emailRes.text();
      console.error("Resend error:", err);
      await sendToTelegram(
        "\u274C Errore invio email: " + escMd(err.substring(0, 200)),
        threadId,
        env
      );
    }
  } catch (err) {
    console.error("Email send error:", err);
    await sendToTelegram("\u274C Errore invio email", threadId, env);
  }

  return jsonResponse({ ok: true });
}

/**
 * Costruisce l'HTML dell'email di risposta.
 */
function buildEmailHtml(text, isSupport) {
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #7c5cfc; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">AdOff ${isSupport ? "Support" : "Suggerimenti"}</h2>
  </div>
  <div style="background: #f9f9fb; padding: 24px; border: 1px solid #e5e5ea; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 14px; line-height: 1.6;">${escapedText}</p>
    <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 20px 0;">
    <p style="font-size: 12px; color: #888;">
      Questa email e' stata inviata dal team AdOff in risposta alla tua ${isSupport ? "segnalazione" : "idea"}.
      <br>Non rispondere a questa email — scrivi a <a href="mailto:support@adoff.app" style="color: #7c5cfc;">support@adoff.app</a>.
    </p>
  </div>
</body>
</html>`;
}

// ==================== SHARED ====================

async function checkRateLimit(ip, prefix, env) {
  if (!env.RATE_LIMIT) return null;

  const hourKey = `rl:${prefix}:hour:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const dayKey = `rl:${prefix}:day:${ip}:${Math.floor(Date.now() / 86400000)}`;

  const [hourCount, dayCount] = await Promise.all([
    env.RATE_LIMIT.get(hourKey).then((v) => parseInt(v || "0", 10)),
    env.RATE_LIMIT.get(dayKey).then((v) => parseInt(v || "0", 10)),
  ]);

  if (hourCount >= LIMITS.PER_HOUR) {
    return jsonResponse({ error: "Rate limited. Max " + LIMITS.PER_HOUR + " per hour." }, 429);
  }
  if (dayCount >= LIMITS.PER_DAY) {
    return jsonResponse({ error: "Rate limited. Max " + LIMITS.PER_DAY + " per day." }, 429);
  }

  await Promise.all([
    env.RATE_LIMIT.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 }),
    env.RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
  ]);

  return null;
}

async function sendToTelegram(text, topicId, env) {
  const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const tgRes = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        message_thread_id: topicId,
        text,
        parse_mode: "Markdown",
      }),
    });

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error("Telegram error:", errText);
      return jsonResponse({ error: "Delivery failed" }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("Fetch error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function sanitize(text) {
  return text.replace(/[<>"'`]/g, "");
}

function escMd(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function calcEntropy(text) {
  if (text.length < 2) return 0;
  const freq = {};
  for (const ch of text.toLowerCase()) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  let entropy = 0;
  const len = text.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
