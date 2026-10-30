# AdOff — Off-Page Submissions (copy pronte, 2026-09-27)

Testi in inglese, pronti da copiare/incollare. Verificati contro `site/index.html`, `app/manifest.json` (v3.6.15), `app/rules/adblock-rules.json` (190 regole), `site/privacy.html`.
Contatto pubblico: solo https://adoff.app/support.html — MAI dati personali del developer.

---

## 1. AlternativeTo

**Name:** AdOff

**Tagline:** "Ads? Off!" Free ad blocker with stealth anti-detection.

**Short description (≤300 chars):**
AdOff is a 100% free, universal ad blocker browser extension. It blocks ads at the network level, hides ad elements, neutralizes video ads, and includes stealth anti-adblock-detection — all features included, no account or trial required. Available for Chrome, Firefox, Edge, Opera and Safari.

**Long description:**
AdOff is a free ad blocker for Chrome, Firefox, Edge, Opera and Safari (Safari 16.4+), built on Manifest V3.

It works on four layers:
1. **Network blocking** — 190 declarativeNetRequest rules block requests to ad networks at the HTTP level.
2. **Cosmetic filtering** — hides ad elements left in the page's DOM.
3. **Video ad neutralization** — a universal stub replaces the ad SDK used by video players, so players resume content without pre-roll or mid-roll ads.
4. **Stealth anti-detection** — bait and variable spoofing plus request interception keep the extension invisible to anti-adblock scripts.

Every feature is included for everyone: no account, no trial, no payment. The interface is available in 15 languages. Counters in the popup show only real ads blocked — tracking and analytics requests are blocked too but not counted.

- Website: https://adoff.app
- Privacy policy: https://adoff.app/privacy
- Support: https://adoff.app/support.html

**Tags:** ad-blocker, browser-extension, privacy, chrome-extension, firefox-extension

**Alternative to:** uBlock Origin, AdBlock Plus (Adblock Plus), AdGuard

**Platforms:** Chrome, Firefox, Edge, Opera, Safari

**License:** Free

---

## 2. Product Hunt

**Name:** AdOff

**Tagline (≤60 chars):**
Free ad blocker with stealth anti-detection. Ads? Off!

**Description (≤260 chars):**
AdOff is a 100% free ad blocker for Chrome, Firefox, Edge, Opera and Safari. It blocks ads at the network level, hides ad elements, neutralizes video ads, and evades anti-adblock detection. No account, no trial — every feature included.

**First comment (maker):**
Hi everyone! I'm the developer behind AdOff.

I built it because most ad blockers either paywall their best features or fall over the moment a site fights back with anti-adblock detection. AdOff takes a different route: it blocks ads at the network level with declarativeNetRequest rules (Manifest V3-ready), hides what's left in the DOM, and replaces the video ad SDK that players rely on — so video players just resume the content.

The part I'm most proud of is the stealth layer: bait spoofing and variable spoofing that keep it invisible to anti-adblock scripts.

A few things I decided early on:
- 100% free, every feature included. No account, no trial, no "Pro" tier.
- The counter only counts real ads — analytics and tracking get blocked but don't inflate your numbers.
- 15 languages out of the box.

I'd genuinely love feedback — especially on the video ad neutralization on sites you use daily. What breaks, what's missing?

Website: https://adoff.app — Privacy: https://adoff.app/privacy

**Topics (3):** `Browser Extensions` · `Privacy` · `Ad Blockers` (se non esistono come topic PH: `Chrome Extensions`, `Privacy`, `Productivity`)

---

## 3. Reddit

### r/chrome

**Title:** I built a free Manifest V3 ad blocker for Chrome — looking for feedback (I'm the author)

**Body:**
Hi all — I'm the developer of AdOff, a free ad blocker extension for Chrome (also on Firefox, Edge, Opera, Safari). Being upfront: it's my project, and I'm sharing it to get feedback, not to sell anything (it's 100% free, no account or trial).

How it works, in layers:
- Network-level blocking with 190 declarativeNetRequest rules (Manifest V3-safe)
- Cosmetic filtering for ad elements left in the DOM
- Video ad neutralization: a stub replaces the video ad SDK players load, so players resume content instead of playing pre-roll
- A stealth layer (bait/variable spoofing, request interception) so anti-adblock scripts don't flag it

Everything is enabled for everyone — no pro tier, no registration.

Curious how it holds up on the sites you use: any site where ads still slip through, or where it breaks the page? That's exactly the feedback I'm after.

Site: https://adoff.app — Privacy policy: https://adoff.app/privacy

### r/privacy

**Title:** I made a free, no-account ad blocker — here's exactly what it does and doesn't collect (author here)

**Body:**
I'm the author of AdOff, a free ad blocker extension (Chrome, Firefox, Edge, Opera, Safari). Since privacy-focused folks should judge tools on their data practices, here's the straight summary from our privacy policy (https://adoff.app/privacy):

The extension, used free and without an account:
- Does NOT collect browsing history or URLs of visited sites
- Does NOT collect page content or form data
- Does NOT collect third-party profiling/tracking data
- No behavioral or profiling data
- Everything works locally, stored on your device — no account or registration required

If you voluntarily create a support account, the policy lists what's collected then (license key, extension preferences, a device UUID for device management, browser/OS identifier, extension version). We don't use behavioral analytics services, advertising services, or third-party tracking SDKs.

Functionally: 190 network-level blocking rules (declarativeNetRequest), cosmetic filtering, video ad neutralization, and a stealth layer against anti-adblock detection. Manifest V3.

Happy to answer questions about how it works technically. Feedback on the privacy side is very welcome.

### r/adblock

**Title:** Author here — free MV3 ad blocker with video ad neutralization, looking for filter feedback

**Body:**
I built AdOff (free, all features included, no account) and I'd like feedback from people who actually run filters daily.

Stack:
- 190 static declarativeNetRequest block rules (Manifest V3)
- Cosmetic filtering via content script + CSS
- Video ad neutralization: an in-page stub replaces the ad SDK video players load (the player gets an immediate "resume content" instead of an ad break); external SDK loads are also blocked at network level
- Stealth anti-detection layer (bait spoofing, variable spoofing, fetch/XHR interception) for anti-adblock scripts

What I'd love to know from this sub:
- Sites where the video neutralization fails or breaks the player
- Ad networks slipping past the static rules that should become new rules
- Anything where the stealth layer causes weirdness

Chrome: https://adoff.app — Privacy: https://adoff.app/privacy

### Nota regole anti-autopromozione (da verificare in OGNI sub PRIMA di postare)

- **Rapporto 10:1 / 9:1**: la maggioranza dei sub richiede che le tue attività non di self-promo superino di gran lunga i post sul tuo progetto. Se il tuo account è nuovo o prevalentemente promozionale, il post viene rimosso.
- **Rivelazione obbligatoria**: molti sub (specialmente r/adblock) richiedono di dichiarare l'affiliazione nel post o nel flair — già fatto nei testi sopra, non rimuoverlo.
- **Flair**: alcuni sub richiedono un flair specifico (es. r/chrome "Extension Recommendation" o "Self-Promotion", r/adblock "Discussion"/"Suggestion"). Imposta il flair giusto alla pubblicazione.
- **Account minimo / karma minimo**: r/privacy è la più restrittiva (spesso karma e anzianità account minimi, e i post di sviluppatori possono finire in un thread mensile dedicato). Verifica le regole correnti prima di postare; se non passa, alternativa: commento pertinente in thread esistenti con menzione al progetto.
- **Niente short-link, niente CTA aggressive**: già evitato nei testi — mantienili così.
- **Regole dei sub cambiano spesso**: leggi la sidebar/le regole "leggile il giorno stesso della pubblicazione" — se un mod rimuove, chiedi in modmail, non ripostare.

---

## 4. Awesome-list GitHub

Liste candidate (realistiche):

1. **awesome-adblock** (da verificare esatta esistenza/nome repo)
2. **awesome-browser-extensions-for-privacy / awesome-privacy** (Lissy93/awesome-privacy — da verificare criteri di ammissione)
3. **awesome-chrome-extensions** (da verificare)
4. **awesome-selfhosted / awesome-foss-apps** — solo se AdOff avesse repo FOSS pubblico; **probabilmente NON idoneo** finché il sorgente non è pubblico. Skip.

⚠️ Nota onesta: la maggior parte delle awesome-list richiede il **repo sorgente pubblico**. AdOff è distribuito via store/sito; se non c'è un repo GitHub pubblico, la PR verrà respinta dalla maggior parte delle liste. In quel caso, saltare questa sezione o aprire il repo prima.

**Riga markdown (formato tipico):**

```markdown
- [AdOff](https://adoff.app) - Free universal ad blocker extension with network-level blocking, cosmetic filtering, video ad neutralization, and stealth anti-adblock-detection. Chrome, Firefox, Edge, Opera, Safari. (Manifest V3)
```

**Testo PR:**

Title: `Add AdOff — free ad blocker extension`

Body:
> Hi maintainers,
>
> Adding AdOff (https://adoff.app), a free universal ad blocker browser extension.
>
> Why it fits this list: it's 100% free with all features included (no account, no trial), built on Manifest V3 with declarativeNetRequest rules, cosmetic filtering, video ad neutralization, and a stealth layer against anti-adblock detection. Available for Chrome, Firefox, Edge, Opera and Safari.
>
> Placed alphabetically in the relevant section. Happy to adjust wording/format to match the list's conventions.

---

## 5. G2 e SaaSHub

**Categoria:** Ad Blockers / Web Browser Extensions (Privacy)

**Name:** AdOff

**Short description:**
Free universal ad blocker browser extension for Chrome, Firefox, Edge, Opera and Safari. Network-level blocking, cosmetic filtering, video ad neutralization, and stealth anti-detection — all features included, no account required.

**Long description:**
AdOff is a 100% free ad blocker extension built on Manifest V3, available for Chrome, Firefox, Edge, Opera and Safari (Safari 16.4+).

It blocks ads on four layers:
1. **Network blocking** — 190 declarativeNetRequest rules stop ad requests before they load.
2. **Cosmetic filtering** — hides remaining ad elements in the DOM.
3. **Video ad neutralization** — a universal stub replaces the video ad SDK that players load, so players resume content instead of playing pre-roll or mid-roll ads.
4. **Stealth anti-detection** — bait spoofing, variable spoofing and request interception keep it invisible to anti-adblock scripts.

Every feature is included for everyone — no account, no trial, no paid tier. The badge counts only real ads blocked (tracking and analytics requests are blocked too but not counted). Interface available in 15 languages.

- Website: https://adoff.app
- Privacy: https://adoff.app/privacy (no browsing data collected; GDPR compliant per policy)
- Support: https://adoff.app/support.html

**Feature list:**
- Network-level ad blocking (declarativeNetRequest, 190 rules, Manifest V3)
- Cosmetic filtering of ad elements in the DOM
- Video ad neutralization (universal ad SDK stub)
- Stealth anti-adblock-detection layer
- Blocked-ads counter (real ads only; tracking excluded)
- Per-site pause options and whitelist
- Stats and milestones
- 15 interface languages
- Cross-browser: Chrome, Firefox, Edge, Opera, Safari (16.4+)
- 100% free, all features included, no account or trial

**Pricing:** Free

---

## NOTE VERIFICA (numeri e fonti)

- **Regole statiche: 190** (fonte: `grep -c '"id"' app/rules/adblock-rules.json`). Il brief diceva "180": usa 190, il file è aggiornato.
- **Versione manifest: 3.6.15** (fonte: `app/manifest.json`).
- **Store links**: Chrome `https://chromewebstore.google.com/detail/fcjfpfhdcpbjmihiikbblcokmjnhedhp` e Firefox `https://addons.mozilla.org/firefox/addon/adoff/` (fonte: `site/install.html`). Edge: **[URL DA INSERIRE]** (non trovato in install.html/index.html). Safari: App Store **[URL DA INSERIRE]** se esiste.
- **Privacy** (fonte: `site/privacy.html`): la versione gratuita senza account NON raccoglie nulla oltre ai dati locali sul dispositivo; con account volontario raccoglie license key, preferenze estensione, device UUID, browser/OS, versione estensione. Nessun analytics comportamentale / advertising / SDK di tracking terzi. I testi Reddit r/privacy rispettano esattamente quanto dichiarato dalla pagina.
