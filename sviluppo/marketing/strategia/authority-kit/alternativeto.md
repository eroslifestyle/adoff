# Testi per la scheda AlternativeTo (lingua: inglese, pronti da copia-incolla)

## Tagline
Stealth ad blocker that anti-adblock walls can't detect — free for everyone.

## Short description (1-2 lines)
AdOff is a Manifest V3 browser extension that blocks ads on every website while staying invisible to anti-adblock detection. 100% free, all features included, no paid plans.

## Long description
AdOff is a Manifest V3 ad blocker for Chrome, Edge, Brave, Opera, Firefox and Safari. It works on four layers: 190 declarativeNetRequest network rules that block ad and tracker requests, native CSS cosmetic filtering, a universal IMA SDK stub that neutralizes video ads on any player using the Google IMA SDK, and a built-in Stealth Mode that defeats anti-adblock detection.

The stealth layer is why AdOff exists: sites that detect uBlock Origin or AdBlock Plus do not detect AdOff. It spoofs bait ad slots, masks detection variables, and intercepts ad network calls so the site's probes come back normal — no wall, no nag, no broken player. It is tightly integrated rather than bolted on as a third-party module, so the detectable surface stays small.

Video ads are handled with a universal IMA SDK stub: when a player calls `adsManager.start()`, the stub fires `CONTENT_RESUME_REQUESTED` immediately. Zero pre-roll, zero countdown, playback state and buffering preserved. AdOff adds anti-SABR-backoff so quality is not silently reduced, and content-position recovery so seek/playback state survives the skip.

Privacy is absolute: zero telemetry, zero tracking, zero remote logging, no browsing data collected. The UI ships in 15 languages. The extension is featherlight with no runtime dependencies — a tiny fraction of the size of uBlock Origin and AdBlock Plus.

AdOff is 100% free for everyone: all features included (stealth mode and video ad neutralization from day one). No account, no sign-up, no time limit — free forever.

## Feature list (5)
1. Stealth anti-detection — defeats anti-adblock walls that catch uBlock Origin and AdBlock Plus
2. Universal video ad neutralization — IMA SDK stub, zero pre-roll, no re-buffering, no quality drop
3. 190 network rules + CSS cosmetic filtering + per-domain control
4. Zero data collection — no telemetry, no tracking, no remote logging
5. 100% free — all features included, extension available in 15 languages

## Categories / tags
Browser Extension, Ad Blocker, Internet Filtering, Privacy, Security & Privacy, Anti-Tracking, Chrome Extension, Firefox Extension, Safari Extension, Video Ad Blocker, Manifest V3

## Listed as an alternative to
- uBlock Origin — AdOff adds built-in stealth anti-detection and video-ad neutralization on top of network + cosmetic blocking.
- AdGuard — AdOff is lighter, includes its stealth layer in the free core, and collects no data.
- Adblock Plus — AdOff evades anti-adblock detection (sites that detect ABP do not detect AdOff) and skips video pre-rolls.

## Notes
- Listing owner: independent project (repo: eroslifestyle/adoff).
- No affiliation with any listed third-party product; brand names used descriptively for comparison.
- Contact: via the contact form at adoff.app/support
- Docs: https://adoff.app/ (homepage), https://adoff.app/install (install guide)