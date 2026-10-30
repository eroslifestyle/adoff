# Testi per Product Hunt (lingua: inglese, pronti da copia-incolla)

## Name
AdOff

## Tagline (<60 char)
Ad blocker that anti-adblock walls can't detect  (49)

## Description (<260 char)
MV3 ad blocker for Chrome, Firefox, Edge, Opera and Safari. 190 network rules, CSS hiding, video-ad neutralization via a universal IMA SDK stub, and built-in stealth that defeats anti-adblock detection. 100% free, all features included, zero data collection.

## Maker first comment
Hi Product Hunt — I built AdOff because ad blocking stopped being enough. Modern sites don't just serve ads; they detect that you're blocking them and then decide what to do about it. Sites that fingerprint uBlock Origin or AdBlock Plus usually sail right past AdOff, so no wall appears and nothing breaks.

Under the hood it's four layers: 190 declarativeNetRequest network rules, CSS cosmetic filtering, a universal IMA SDK stub that neutralizes video ads on any player using Google's IMA SDK, and a tightly integrated Stealth Mode (bait spoofing, variable masking, fetch/XHR interception). The video part is what I'm most proud of — when a player calls `adsManager.start()`, the stub fires `CONTENT_RESUME_REQUESTED` immediately: no pre-roll, no countdown, and playback position and buffering are preserved. I also added anti-SABR-backoff so aggressive server-side monetization can't quietly downgrade your quality.

It's 100% free for everyone with all features included — stealth and video neutralization are not paid add-ons. There's no credit card, no account and no sign-up anywhere: it's free forever. Zero telemetry, zero tracking, zero data collection.

I'd genuinely love feedback — especially on sites that still detect it or players that misbehave. Happy to answer anything technical. The contact form at adoff.app/support reaches me.

## Topics (3)
- Privacy
- Chrome Extensions
- Ad Blockers

## Asset checklist
- [ ] Logo / icon (128px+ transparent PNG)
- [ ] Gallery images 1270x760 (min 3): popup UI, options/statistics, before-after on a heavy ad page
- [ ] Video ad neutralization demo (GIF or short MP4, player skipping pre-roll with no buffering)
- [ ] Thumbnail 240x240
- [ ] First comment copy-pasted and ready before the launch posts
- [ ] Shop/pricing left empty (product is 100% free)
- [ ] Launch link: adoff.app (UTM: ?ref=producthunt)
- [ ] Maker profile complete (no personal data — brand identity only)

## Notes
- Brands mentioned (Chrome, Firefox, Edge, Opera, Safari) descriptively only; no affiliation claimed.
- No real name, email or location of the developer appears in any public field.
- Contact: via the contact form at adoff.app/support