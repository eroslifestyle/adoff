// HTTP Basic Auth middleware per la console admin /mgmt-9f4a.
// Il middleware di cartella copre /mgmt-9f4a, /mgmt-9f4a/ e tutte le
// sottorisorse (Pages valuta functions/<dir>/_middleware.js su ogni
// request sotto quella cartella). Fail closed: senza segreti -> 503.
const encoder = new TextEncoder();

// Confronto a tempo costante su byte (XOR); lunghezze diverse -> false
// ma solo dopo un ciclo a lunghezza fissa per non leakare la lunghezza.
function timingSafeEqual(a, b) {
  const ba = encoder.encode(a);
  const bb = encoder.encode(b);
  const len = Math.max(ba.length, bb.length);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export async function onRequest(context) {
  const { env, request, next } = context;
  if (!env.MGMT_BASIC_USER || !env.MGMT_BASIC_PASS) {
    return new Response("Service unavailable", { status: 503 });
  }
  const header = request.headers.get("Authorization") || "";
  const match = /^Basic\s+(.+)$/i.exec(header);
  let ok = false;
  if (match) {
    try {
      const decoded = atob(match[1]);
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        ok =
          timingSafeEqual(decoded.slice(0, sep), env.MGMT_BASIC_USER) &&
          timingSafeEqual(decoded.slice(sep + 1), env.MGMT_BASIC_PASS);
      }
    } catch {
      ok = false; // base64 malformato
    }
  }
  if (!ok) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="adoff-admin", charset="UTF-8"',
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  }
  return next();
}
