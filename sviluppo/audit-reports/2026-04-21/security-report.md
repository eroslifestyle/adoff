# Security Audit Report

**Application:** AdOff — adoff.app (website + landing page)
**Date:** 2026-04-21
**Scanner:** AI Security Scanner (OWASP Top 10:2021)
**Files Scanned:** ~150 files (HTML, JS, CSS) across site/ directory
**Languages Detected:** HTML, JavaScript, CSS
**Framework(s):** Vanilla JS, Cloudflare Pages, Cloudflare Workers API

---

## Executive Summary

**Overall Risk Score:** 45/100
**Risk Level:** MEDIUM

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 2 |
| MEDIUM   | 5 |
| LOW      | 2 |
| **TOTAL** | **9** |

**Scoring:** CRITICAL=25pts, HIGH=10pts, MEDIUM=5pts, LOW=1pt
**Calculation:** (0x25) + (2x10) + (5x5) + (2x1) = 47 pts → **MEDIUM risk**

---

## Findings by OWASP Category

### A01: Broken Access Control

*No findings.* The site is a static website served by Cloudflare Pages. No server-side access control logic exists in the frontend. Access control is handled server-side by the Cloudflare Worker API.

---

### A02: Cryptographic Failures

*No findings.* HTTPS enforced via Cloudflare. No crypto operations in frontend code.

---

### A03: Injection

#### [HIGH] XSS via innerHTML with Server Response Data — support.html

- **File:** `site/support.html` line 246
- **Code:**
  ```javascript
  msg.innerHTML = '<strong>Ticket submitted!</strong> Your ticket ID: <div class="ticket-id">'
    + res.ticketId + '</div><br><br>We will respond to <strong>'
    + data.email + '</strong> within 24 hours.';
  ```
- **Risk:** If the API response `res.ticketId` contains malicious HTML/JS (e.g., via a compromised API or MITM), it gets injected directly into the DOM. Similarly, `data.email` comes from user input and is inserted via innerHTML without escaping.
- **Fix:**
  ```javascript
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  msg.innerHTML = '<strong>Ticket submitted!</strong> Your ticket ID: <div class="ticket-id">'
    + escapeHtml(res.ticketId) + '</div><br><br>We will respond to <strong>'
    + escapeHtml(data.email) + '</strong> within 24 hours.';
  ```

#### [MEDIUM] innerHTML Usage in i18n System — adoff-i18n.js

- **File:** `site/adoff-i18n.js` line 8028
- **Code:**
  ```javascript
  hel.innerHTML = dict[hkey];
  ```
- **Risk:** LOW in practice — the `dict` values are hardcoded trusted strings from the i18n dictionary within the same file, not user input. However, using innerHTML with a dictionary lookup pattern creates a latent risk if the dictionary is ever sourced externally.
- **Fix:** Acceptable risk — the comment on line 8022 correctly notes "values are trusted internal strings." No action needed unless i18n data is ever loaded from an external source.

#### [MEDIUM] innerHTML in Nav/Footer — adoff-nav.js, adoff-footer.js

- **Files:** `site/adoff-nav.js` line 189, `site/adoff-footer.js` lines 107, 114
- **Code:**
  ```javascript
  root.innerHTML = [ /* hardcoded HTML template */ ].join('');
  footer.innerHTML = html;
  ```
- **Risk:** LOW in practice — HTML is constructed from hardcoded strings and internal variables (`activeLang` derived from URL path). The `activeLang` is matched against a known languages array, so injection via URL is mitigated by the allowlist check.
- **Fix:** Acceptable risk — hardcoded templates with allowlist-validated variables. No action needed.

---

### A04: Insecure Design

*No findings.* The site is a static marketing/landing page without complex business logic.

---

### A05: Security Misconfiguration

#### [MEDIUM] Missing Content-Security-Policy Header

- **Source:** HTTP response headers from `https://adoff.app/`
- **Current headers present:**
  ```
  x-content-type-options: nosniff
  x-frame-options: DENY
  referrer-policy: strict-origin-when-cross-origin
  permissions-policy: camera=(), microphone=(), geolocation=()
  ```
- **Missing:**
  - `Content-Security-Policy` — No CSP header found. Inline scripts execute without restriction.
  - `Strict-Transport-Security` (HSTS) — Not present in response headers (Cloudflare may handle this at edge, but explicit header is best practice).
  - `X-XSS-Protection` — Deprecated but still useful for older browsers.
- **Risk:** Without CSP, any XSS vulnerability (like the innerHTML issue above) has no secondary defense. An attacker exploiting the XSS could load external scripts, exfiltrate data, or redirect users.
- **Fix:** Add to Cloudflare Pages `_headers` file:
  ```
  /*
    Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://adoff-license-api.workers.dev https://api.stripe.com; frame-src https://js.stripe.com; base-uri 'self'; form-action 'self'
    Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  ```

#### [MEDIUM] CORS Wildcard on All Responses

- **Source:** HTTP response header: `Access-Control-Allow-Origin: *`
- **Risk:** Any website can make requests to adoff.app and read the responses. For a static site serving public content, this is LOW risk. However, it's a bad habit — if API endpoints or authenticated pages are ever added under the same domain, the wildcard CORS would expose them.
- **Fix:** Remove the wildcard if not needed, or restrict to specific origins. In `_headers`:
  ```
  /*
    Access-Control-Allow-Origin: https://adoff.app
  ```

#### [LOW] No Subresource Integrity (SRI) on External Resources

- **Source:** All HTML pages load `/adoff-nav.js`, `/adoff-footer.js`, `/adoff-i18n.js` without integrity attributes
- **Risk:** If the Cloudflare Pages CDN is compromised, modified scripts would execute without detection. Low probability given Cloudflare's security, but SRI is a defense-in-depth measure.
- **Fix:** Add `integrity` attributes to script tags (regenerate hashes on each deploy):
  ```html
  <script src="/adoff-nav.js" integrity="sha384-..." crossorigin="anonymous"></script>
  ```

---

### A06: Vulnerable and Outdated Components

*No findings.* The site uses zero external JavaScript libraries — all code is vanilla JS. No `package.json`, no npm dependencies, no CDN-loaded libraries. This is an excellent security posture.

---

### A07: Identification and Authentication Failures

#### [HIGH] Support Form Lacks Client-Side Anti-Bot in HTML

- **File:** `site/support.html` lines 122-263
- **Code:**
  ```javascript
  function submitTicket(e) {
    // ... collects form data ...
    fetch(API + '/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  ```
- **Risk:** The support form submits directly to the API without visible client-side anti-bot protections (honeypot field, CAPTCHA, timing check). The guide pages document that the API has "honeypot, timing, captcha, rate limit (max 3/hour), anti-spam, deduplication" — but these protections are NOT visible in the client-side HTML. If they are only server-side, this is acceptable. If the guide is describing planned features not yet implemented, this is a spam vector.
- **Verification needed:** Confirm that the Worker at `adoff-license-api.workers.dev/ticket` implements:
  - Rate limiting (3/hour per IP)
  - Honeypot field detection
  - Timing check (reject submissions < 3 seconds)
  - Email validation
- **Fix (client-side hardening):**
  ```html
  <!-- Honeypot (hidden from users, bots fill it) -->
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
  ```
  ```javascript
  // Timing check
  var formLoadTime = Date.now();
  // In submitTicket():
  if (Date.now() - formLoadTime < 3000) return false; // too fast = bot
  // Add honeypot to data
  data.website = form.website.value; // should be empty
  ```

---

### A08: Software and Data Integrity Failures

*No findings.* No auto-update mechanisms, no deserialization, no CI/CD pipeline in the static site.

---

### A09: Security Logging and Monitoring Failures

#### [MEDIUM] No Client-Side Error Tracking

- **Source:** All JS files
- **Risk:** JavaScript errors (including potential security-related ones) are not captured or reported. The `catch` blocks in fetch calls show generic error messages to users but don't report to any monitoring service.
- **Fix:** Consider adding a lightweight error reporter:
  ```javascript
  window.onerror = function(msg, url, line) {
    navigator.sendBeacon && navigator.sendBeacon('/api/error', JSON.stringify({
      msg: msg, url: url, line: line, ts: Date.now()
    }));
  };
  ```
  **Priority:** LOW — this is a nice-to-have for a static marketing site.

---

### A10: Server-Side Request Forgery (SSRF)

*No findings.* The frontend makes only two fetch calls to a hardcoded API URL (`adoff-license-api.workers.dev`). No user-supplied URLs are fetched server-side from the frontend.

---

## Clean Categories

The following OWASP categories had **zero findings**:
- A01: Broken Access Control
- A02: Cryptographic Failures
- A04: Insecure Design
- A06: Vulnerable and Outdated Components
- A08: Software and Data Integrity Failures
- A10: Server-Side Request Forgery

---

## Security Headers Analysis

| Header | Status | Value |
|--------|--------|-------|
| `X-Frame-Options` | PRESENT | `DENY` |
| `X-Content-Type-Options` | PRESENT | `nosniff` |
| `Referrer-Policy` | PRESENT | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | PRESENT | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | **MISSING** | — |
| `Strict-Transport-Security` | **MISSING** | — |
| `X-XSS-Protection` | **MISSING** | — (deprecated but useful for legacy browsers) |
| `Access-Control-Allow-Origin` | PRESENT | `*` (too permissive) |

---

## Recommendations (Priority Order)

### 1. IMMEDIATE (HIGH findings)

1. **Fix XSS in support.html** — Escape `res.ticketId` and `data.email` before inserting into innerHTML. This is the only exploitable vulnerability found.

2. **Verify server-side anti-bot on /ticket endpoint** — Confirm the Worker implements rate limiting, honeypot detection, and timing checks. If not, add them.

### 2. SHORT-TERM (MEDIUM findings)

3. **Add Content-Security-Policy header** — Create a `site/_headers` file with CSP directives. This is the single most impactful security improvement.

4. **Add HSTS header** — Enforce HTTPS with `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

5. **Restrict CORS** — Change `Access-Control-Allow-Origin: *` to `https://adoff.app` or remove entirely.

6. **Add client-side honeypot to support form** — Hidden field + timing check as first line of defense.

### 3. LONG-TERM (LOW findings + hardening)

7. **Add SRI hashes to script tags** — Defense-in-depth against CDN compromise.

8. **Add client-side error monitoring** — Lightweight beacon-based error reporting.

9. **Consider CSP nonces for inline scripts** — Move inline scripts to external files or add nonce-based CSP for maximum protection.

---

## Positive Security Notes

The site has several strong security practices already in place:

- **Zero external JS dependencies** — No npm, no CDN libraries, no supply chain risk
- **No eval/exec/Function** — No dynamic code execution
- **No hardcoded secrets** — API URLs are public endpoints, no keys exposed
- **HTTPS only** — Cloudflare enforces TLS
- **X-Frame-Options: DENY** — Clickjacking protection
- **Permissions-Policy** — Camera/mic/geolocation disabled
- **Referrer-Policy** — Strict origin when cross-origin
- **No console.log in production** — Clean production code
- **Form validation** — HTML5 validation attributes (required, pattern, type=email)
- **i18n allowlist** — Language detection uses hardcoded array, not raw URL input

---

## Methodology

This audit was performed using:
- Static analysis pattern matching (grep-based) on local source files
- HTTP header analysis of live site (curl)
- AI-powered contextual analysis (false positive elimination)
- OWASP Top 10:2021 checklist (all 10 categories)
- Live site content analysis (WebFetch)

### Limitations
- No dynamic analysis (runtime testing)
- No penetration testing
- Cloudflare Worker backend (`adoff-license-api.workers.dev`) was NOT audited — only the frontend
- Business logic flaws require manual review
