# AdOff — Social Media Launch Kit

> Version 1.0 | April 2026 | Copy-paste ready
> **BRAND RULE**: Never use YouTube, Google, Facebook, Instagram, Twitter/X by name in public posts. Use generic: "video platforms", "search engines", "social media".

---

## TABLE OF CONTENTS

1. [Profile Bios](#1-profile-bios)
2. [Launch Thread (X/Twitter)](#2-launch-thread-xtwitter)
3. [Reddit Launch Posts](#3-reddit-launch-posts)
4. [Content Calendar (Week 1–4)](#4-content-calendar-week-14)
5. [Hashtag Sets](#5-hashtag-sets)
6. [Referral Message Templates](#6-referral-message-templates)

---

## 1. PROFILE BIOS

---

### GitHub Organization Bio
> **Limit: 160 chars**

```
AdOff — Universal ad blocker for Chrome. 107+ network rules, CSS hiding, stealth anti-detection. MV3 native. Open filter rules.
```

*(128 chars)*

---

### GitHub Repo README — `adoff-filter-rules`

```markdown
# adoff-filter-rules

> The open-source filter rule set powering [AdOff](https://adoff.app) — a universal ad blocker for Chrome.

## What's in this repo

This repository contains the `declarativeNetRequest` rule set used by the AdOff Chrome extension to block ad network requests at the network layer, before they reach the page.

- **107+ rules** targeting ad networks, trackers, and telemetry endpoints
- Written in Chrome MV3 `declarativeNetRequest` JSON format
- Covers display ads, pre-roll video ads, interstitials, and tracking pixels
- Updated regularly as ad networks evolve

## Rule format

Rules follow the [Chrome declarativeNetRequest specification](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/).

```json
{
  "id": 1,
  "priority": 1,
  "action": { "type": "block" },
  "condition": {
    "urlFilter": "||doubleclick.net^",
    "resourceTypes": ["script", "image", "xmlhttprequest"]
  }
}
```

## How AdOff uses these rules

AdOff operates on three layers:

1. **Network blocking** — These rules block HTTP requests to ad servers before the browser fetches them.
2. **CSS cosmetic filtering** — Hides ad container elements that slip through network rules.
3. **Stealth anti-detection** — Spoofs browser properties to make the extension invisible to anti-adblock scripts (Pro tier).

## Contributing

Spotted an ad source that should be blocked? Open an issue with:
- The domain/URL pattern
- The site where you saw it
- What type of ad it is (banner, video pre-roll, tracker, etc.)

Pull requests welcome. Rules are reviewed and tested before merging.

## License

MIT — use freely in your own projects.

## Related

- [AdOff Extension](https://adoff.app) — Install the full extension
- [AdOff Website](https://adoff.app) — Pricing, docs, support
```

---

### Twitter/X Bio
> **Limit: 160 chars**

```
Block ads everywhere. Stealth mode so sites can't detect you. ultraleggera, MV3 native, 15-day free trial. No credit card. adoff.app
```

*(127 chars)*

---

### Twitter/X Pinned Tweet
> **Limit: 280 chars**

```
🚫 AdOff — the ad blocker that hides itself.

Most blockers get caught. AdOff spoof the variables anti-adblock scripts look for, intercepts their detection requests, and stays invisible.

ultraleggera. MV3 native. 15-day free trial, no credit card.

👉 adoff.app
```

*(261 chars)*

---

### Reddit User Bio
> **Limit: 200 chars**

```
Built AdOff — a stealth ad blocker for Chrome that hides from anti-adblock detection. MV3 native, ultraleggera, open filter rules. Ask me anything. adoff.app
```

*(152 chars)*

---

### Discord Server Description
> **Limit: 300 chars**

```
Official community for AdOff — the Chrome ad blocker that stays invisible to anti-adblock detection. Get support, report ad sources that slip through, discuss privacy, and vote on new features. Free users and Pro members welcome. adoff.app
```

*(240 chars)*

---

### Discord Welcome Message (#welcome channel)

```
👋 Welcome to the AdOff community!

AdOff is a Chrome ad blocker with stealth anti-detection — it blocks ads and hides itself from anti-adblock scripts.

**Get started:**
• 🌐 Website & download: https://adoff.app
• 🐛 **#bug-reports** — ads slipping through? post here
• 💡 **#feature-requests** — suggest a new filter or feature
• 🆘 **#support** — extension not working? we'll help
• 💬 **#general** — everything else

**Free tier** blocks ads on all sites. **Pro** adds stealth anti-detection so sites can't detect you're using an ad blocker.

15-day free trial, no credit card required. Try Pro and see the difference.

Thanks for being here. 🙏
```

---

### Discord Rules (5 rules)

```
📋 SERVER RULES

1. **Be respectful** — No harassment, hate speech, or personal attacks. Treat everyone as you'd want to be treated.

2. **Stay on topic** — Keep discussions relevant to AdOff, ad blocking, and privacy. Off-topic goes in #general.

3. **No spam** — No repeated messages, self-promotion, or unsolicited DMs to other members.

4. **Bug reports need details** — When posting in #bug-reports, include: site URL, what ad appeared, and your AdOff version. Vague reports can't be fixed.

5. **No piracy or illegal content** — Discussion of bypassing paywalls or accessing paid content for free is not allowed.

Breaking rules = warning → mute → ban. Use common sense.
```

---

### Mastodon Bio
> **Limit: 500 chars**

```
AdOff — Chrome ad blocker with stealth anti-detection 🚫

Blocks ads at the network layer (107+ rules), hides them with CSS, and spoofs the browser variables anti-adblock scripts look for — so sites can't tell you're using a blocker.

ultraleggera. Manifest V3 native. 6 languages. Free plan available. Pro from €2.69/mo with a 15-day trial, no credit card.

Open filter rules on GitHub. adoff.app
```

*(381 chars)*

---

### TikTok Bio
> **Limit: 80 chars** · No AI-disclosure room here → see pinned video + link page

```
Watch anything. Read anything. Zero ads, anywhere ↓
```

*(51 chars)* — Display name: `AdOff` · Username: `@adoff.app`
> Copy rule: video+web angle, "free" solo implicito (mai "15-day"/"no card" in bio — vedi memory `feedback-social-copy`). AI-disclosure → video pinnato.

---

### Instagram Bio
> **Limit: 150 chars** · AI disclosure inline (EU AI Act)

```
Every ad off — video + web 🚫
Invisible to anti-adblock · all major browsers
Watch & read, uninterrupted
AI-assisted brand channel
```

*(~131 chars incl. line breaks)* — video+web angle, "free" implicito (mai "15-day"/"no card", regola `feedback-social-copy`). Name field: `AdOff — Ad Blocker` · Username: `@adoff.app` · Link: `https://adoff.app`

---

### Facebook Page

- **Page name**: `AdOff`
- **Username**: `@adoff.app`
- **Category**: `Software` (also tag `Product/Service`)
- **Intro / short bio** (limit ~101 chars):

```
Every ad off — video & web. Invisible to anti-adblock. AI-assisted brand · adoff.app
```

*(84 chars)* — AI disclosure inline (la nuova UI Pagine FB NON ha campo About lungo); "free" implicito, mai "15-day" (`feedback-social-copy`)

- **Privacy** (Informazioni → Informazioni legali e sulla privacy): link `https://adoff.app/privacy`. **Impressum: vuoto** (vietati dati legali/identità).
- **Disclosure AI completa → POST FISSATO** (no campo About nella nuova UI):

```
AdOff — official brand channel. Free: blocks website ads (banners, pop-ups, trackers). Pro: adds video ads on streaming platforms + stealth anti-detection. Posts and replies are AI-assisted, published on behalf of the AdOff brand. Info & support: https://adoff.app
```

---

### AI Disclosure — canonical text (reuse where a long field exists)

> Place in: IG bio line (short form above) · FB Page About (long form above) · TikTok pinned-video description · link-in-bio page · any channel "About"/"Bio" with room.

**Short** (≤30 chars): `AI-assisted brand channel`

**Long** (for About / pinned / link page):
```
Official AdOff brand channel. Posts and replies are AI-assisted and published on behalf of the AdOff brand, with human oversight. Not operated as an individual person. Info & support: adoff.app
```

---

### Product Hunt Tagline
> **Limit: 60 chars**

```
The ad blocker that hides from anti-adblock detection
```

*(54 chars)*

---

### Product Hunt Description
> **~300 words**

```
AdOff is a Chrome ad blocker built for the modern web — where simply blocking ads is no longer enough.

**The problem with most blockers**

Most ad blockers work fine until a site detects them. Anti-adblock scripts check for known JavaScript variables, monitor fetch/XHR requests, or look for modified DOM elements. When they find evidence of a blocker, they throw up a wall: "Please disable your ad blocker."

**What AdOff does differently**

AdOff operates on three layers:

1. **Network blocking** — 107+ declarativeNetRequest rules stop ad requests before the browser fetches them. No request, no ad.

2. **CSS cosmetic filtering** — Ad containers that slip through network rules are hidden via injected CSS. Clean pages, no layout holes.

3. **Stealth anti-detection (Pro)** — This is where AdOff goes further. It spoofs the JavaScript variables that anti-adblock scripts look for, intercepts their detection requests, and replaces ad-related DOM properties with neutral values. Sites run their detection scripts and find... nothing.

**Built for MV3**

AdOff is native Manifest V3 — the new Chrome extension standard. No legacy workarounds. ultraleggera total size.

**Pricing**

- **Free** — Network blocking + CSS hiding on all sites
- **Pro** — Adds stealth anti-detection. €2.69/month, €29.59/year, or €67.90 lifetime
- **15-day free trial**, no credit card required

**Languages**

English, Italian, German, French, Spanish, Portuguese.

**Open filter rules**

The network rule set is open source on GitHub. Found an ad source that should be blocked? Open an issue.

Try AdOff free for 15 days — no card, no commitment.
```

---

### Product Hunt — First Comment by Maker

```
Hi Product Hunt! 👋

I built AdOff because I kept running into the same problem: I'd install an ad blocker, it would work for a week, then sites started detecting it and throwing up walls.

The interesting technical challenge in MV3 is that you can't inject scripts into the page's main JavaScript context the usual way — you have to use the `world: "MAIN"` manifest parameter. That's what makes the stealth layer possible: we run our spoofing code in the same JavaScript environment as the page, so when anti-adblock scripts check `window.adsbygoogle` or monitor XHR requests, they see exactly what they expect to see.

Happy to answer questions about:
- How the MV3 stealth layer works technically
- The difference between declarativeNetRequest and cosmetic filtering
- How I handle the whitelist / pause-site feature

What would you most want to see added next? More stealth rules? More languages? A Firefox port?

Thanks for checking it out 🙏
```

---

### AlternativeTo Description
> **~200 words**

```
AdOff is a Chrome extension that blocks ads using three complementary layers: network-level blocking via Chrome's declarativeNetRequest API (107+ rules), CSS cosmetic filtering that hides ad containers from the DOM, and a stealth anti-detection layer that prevents sites from identifying you as an ad blocker user.

The stealth layer — available in the Pro plan — runs in the browser's main JavaScript context, spoofing variables and intercepting requests that anti-adblock scripts use to detect blockers. This means sites run their detection code and find no evidence of ad blocking.

AdOff is native Manifest V3, weighs ultraleggera, and supports six languages: English, Italian, German, French, Spanish, and Portuguese. The filter rule set is open source.

Pricing: free plan covers network and CSS blocking. Pro (€2.69/month, €29.59/year, or €67.90 lifetime) adds stealth anti-detection. A 15-day free trial is available with no credit card required.

Good alternative to: uBlock Origin (for users who want active anti-detection), AdGuard (for users who want a lightweight MV3-native solution).
```

---

### Wikidata — Structured Data Fields

```
Label (en): AdOff
Label (it): AdOff
Description (en): Chrome browser extension for ad blocking with stealth anti-detection
Description (it): Estensione Chrome per il blocco degli annunci con anti-rilevamento stealth

Instance of (P31): browser extension (Q862305)
Platform (P400): Google Chrome (Q11841)
Operating system (P306): web browser (Q6368)
Website (P856): https://adoff.app
Source code repository (P1324): https://github.com/[org]/adoff-filter-rules
Programming language (P277): JavaScript (Q2005)
License (P275): Proprietary (free tier + paid Pro tier)
Publication date (P577): 2025
Genre (P136): privacy software (Q1769417), ad blocking software
Developer (P178): [AdOff]
Interface language (P407): English, Italian, German, French, Spanish, Portuguese
```

---

### Hacker News "Show HN" Post

**Title:**
```
Show HN: AdOff – MV3 ad blocker with stealth anti-detection layer
```
*(66 chars)*

**Body:**
```
I built AdOff, a Chrome extension (MV3) that blocks ads and hides from anti-adblock detection.

The stealth problem is interesting from a technical standpoint. In MV2 you could inject scripts via content_scripts with run_at: "document_start" into the main world easily. In MV3 you need to declare world: "MAIN" in your manifest content_scripts entry — this is what lets the script share the page's JavaScript context.

From that context we do three things:

1. Bait spoofing — we create the DOM elements anti-adblock scripts look for (e.g. `.ad-banner` divs) and make them appear normal (nonzero size, display:block, no forced hiding). Scripts that probe for hidden ad containers find nothing suspicious.

2. Variable spoofing — ad network JavaScript SDKs set globals on window (like adsbygoogle, googletag, etc.). We pre-define these with objects that pass truthiness checks but do nothing.

3. Fetch/XHR interception — we wrap the native fetch and XMLHttpRequest. Requests to known anti-adblock detection endpoints return 200 with neutral JSON instead of being blocked (which itself signals a blocker is present).

The network layer runs 107 declarativeNetRequest rules to stop most ad requests before they reach the page. The CSS layer hides containers for anything that slips through. The stealth layer is the third line.

Total extension size: ultraleggera. No remote code execution, no eval(), no dynamic imports from external sources.

Filter rules are open source on GitHub. Free plan covers layers 1 and 2. Pro (€2.69/mo) adds the stealth layer with a 15-day trial.

adoff.app — happy to answer questions about the MV3 implementation.
```

---

### G2 / Crunchbase Description
> **~150 words**

```
AdOff is a Chrome browser extension that blocks online advertisements using three layers of filtering: network-level request blocking (107+ rules using Chrome's declarativeNetRequest API), CSS cosmetic filtering to hide ad elements from page layouts, and a stealth anti-detection system that prevents websites from identifying the extension.

The stealth anti-detection layer — included in the Pro subscription — operates in the browser's main JavaScript context, spoofing variables and intercepting requests used by anti-adblock detection scripts. This allows AdOff to remain undetected on sites that would otherwise prompt users to disable their ad blocker.

AdOff is built natively for Chrome's Manifest V3 standard. It supports English, Italian, German, French, Spanish, and Portuguese. Pricing starts at €2.69/month for Pro, with annual and lifetime options available. A 15-day free trial requires no credit card.
```

---

## 2. LAUNCH THREAD (X/Twitter)

> Post as a numbered thread. Reply to Tweet 1 with each subsequent tweet.

---

**Tweet 1 — Hook (the problem)**
```
Ad blockers are losing.

Sites now detect uBlock, AdGuard, Brave — all of them. Then they throw a wall: "Disable your ad blocker."

The real problem isn't ads. It's that your blocker announces itself. 🧵
```
*(224 chars)*

---

**Tweet 2 — What AdOff does differently (1/2)**
```
Introducing AdOff.

It doesn't just block ads. It hides the fact that it's blocking them.

Sites run their anti-adblock scripts and find... nothing suspicious. No hidden elements. No blocked requests. No telltale variables. 🚫👻
```
*(232 chars)*

---

**Tweet 3 — What AdOff does differently (2/2)**
```
3 layers:

1️⃣ Network: 107+ rules block ad requests before the browser fetches them
2️⃣ CSS: hides ad containers that slip through
3️⃣ Stealth: spoofs JS variables + intercepts detection requests

All three, working together.
```
*(228 chars)*

---

**Tweet 4 — Technical details: stealth in MV3**
```
The hard part: MV3 changes how extensions can inject scripts.

AdOff runs in the browser's MAIN JavaScript world — same context as the page. That's how we spoof window globals and wrap fetch/XHR before anti-adblock scripts run. 🔧
```
*(232 chars)*

---

**Tweet 5 — Technical details: what gets spoofed**
```
What the stealth layer does:

• Creates decoy ad DOM elements that look normal (size, visibility)
• Pre-defines ad SDK window variables so they pass detection checks
• Returns neutral responses to detection endpoint requests

Sites find no evidence. ✅
```
*(254 chars)*

---

**Tweet 6 — Pricing transparency**
```
Pricing (no tricks):

🆓 Free — network blocking + CSS hiding, forever
💳 Pro — adds stealth anti-detection
  → €2.69/month
  → €29.59/year (~€2.47/mo)
  → €67.90 lifetime, one payment

15-day free trial. No credit card.
```
*(230 chars)*

---

**Tweet 7 — Stats / proof points**
```
By the numbers:

📦 ultraleggera total extension size
📋 107+ network blocking rules
🌍 6 languages (EN/IT/DE/FR/ES/PT)
⚡ MV3 native — no legacy workarounds
🔓 Filter rules open source on GitHub

Small. Fast. Transparent.
```
*(223 chars)*

---

**Tweet 8 — Free vs Pro**
```
What you get free:

✅ Blocks ads on all sites (network layer)
✅ Hides ad containers (CSS layer)
✅ Whitelist / pause per site
✅ 6 languages

What Pro adds:

🛡️ Stealth anti-detection
🛡️ Sites can't tell you're using a blocker

Try Pro free for 15 days. No card needed.
```
*(274 chars)*

---

**Tweet 9 — Call to action**
```
If you're tired of "Please disable your ad blocker" walls:

👉 adoff.app

Install free. Try Pro free for 15 days. If the stealth layer doesn't impress you, stay on free — it still blocks everything. No pressure. 🙏
```
*(214 chars)*

---

**Tweet 10 — Retweet ask**
```
If this thread was useful, a retweet helps people who are frustrated with anti-adblock walls find it.

And if you try AdOff — good or bad — I'd love to hear what you think. DMs open. 👇
```
*(188 chars)*

---

## 3. REDDIT LAUNCH POSTS

---

### r/chrome — "I built this" format

**Title:**
```
I built AdOff — a Chrome MV3 ad blocker with stealth anti-detection (sites can't detect it)
```

**Body:**
```
Hey r/chrome,

I've been building browser extensions for a few years and kept hitting the same wall: I'd get an ad blocker working, and within weeks sites started detecting it and blocking my access.

So I built AdOff to solve that.

**What it does**

AdOff blocks ads on three layers:

1. **Network blocking** — 107+ declarativeNetRequest rules stop requests to ad servers before they reach the page.
2. **CSS hiding** — Any ad container that slips through the network layer gets hidden via injected CSS.
3. **Stealth anti-detection (Pro)** — This is the interesting part. AdOff runs in the browser's main JavaScript context (via MV3's `world: "MAIN"` declaration) and spoofs the variables, DOM elements, and network requests that anti-adblock scripts use to detect blockers. Sites run their detection code and see nothing unusual.

**Why MV3?**

I know MV3 gets a bad reputation in the ad blocking community. I built AdOff natively for MV3 from the start rather than bolting MV3 support onto an MV2 codebase. The stealth layer actually uses a capability MV3 makes more reliable — explicit `world: "MAIN"` script injection.

**Technical details**

- ultraleggera total
- No remote code execution, no eval(), no external script loading
- Filter rules are open source on GitHub
- Works on all sites, not just specific ones

**Pricing**

Free plan covers layers 1 and 2 (network + CSS). Pro adds the stealth layer — €2.69/month, €29.59/year, or €67.90 lifetime. 15-day free trial, no credit card.

**Download:** adoff.app

Happy to answer questions about the MV3 implementation, the stealth technique, or anything else. I've been heads-down building this and would love feedback.
```

---

### r/privacy — Privacy-focused angle

**Title:**
```
AdOff: ad blocker for Chrome that also blocks the scripts sites use to detect your ad blocker
```

**Body:**
```
Privacy is usually framed as "block the trackers." AdOff approaches it from a different angle: also block the *detection* of your privacy tools.

Here's the privacy problem that motivated me to build this:

When you use an ad blocker, many sites now run anti-adblock scripts. These scripts don't just detect your blocker — they often send telemetry back to ad networks reporting that a user with a blocker visited. That data (your IP, timestamp, site, browser fingerprint) goes somewhere. The "please disable your ad blocker" wall is the user-facing part; the telemetry is the quieter part.

**What AdOff does about it**

- **Blocks ad network requests** at the HTTP layer (107+ rules) — trackers never receive a request
- **Intercepts anti-adblock detection requests** — instead of blocking them (which itself signals you have a blocker), AdOff returns neutral responses that make the detection endpoint think no blocker is present
- **Spoofs JavaScript variables** that ad SDKs and detection scripts look for

The result: from the ad network's perspective, you're a normal user. Nothing to flag. No telemetry spike.

**Technical note for the skeptical**

The stealth layer runs in the browser's main JavaScript context (MV3 `world: "MAIN"`). It does not make outbound connections, load remote code, or use eval(). The extension is ultraleggera. Filter rules are open source.

**Pricing**

Free plan covers network blocking and CSS hiding. Pro (€2.69/mo, 15-day trial, no card) adds the stealth anti-detection.

adoff.app — I'm genuinely interested in the privacy community's take on this approach. Does intercepting detection requests rather than blocking them feel like the right tradeoff?
```

---

### r/SideProject — Indie dev story

**Title:**
```
After 6 months of building nights and weekends, I launched AdOff — a stealth Chrome ad blocker
```

**Body:**
```
Six months ago I got annoyed enough at "please disable your ad blocker" walls that I decided to build something about it instead of just complaining.

**The side project journey**

- Month 1–2: Learning MV3 deeply. The `declarativeNetRequest` API is more constrained than MV2 but also more predictable. The real unlock was `world: "MAIN"` script injection for the stealth layer.
- Month 3–4: Building the stealth anti-detection system. Testing against real anti-adblock implementations. A lot of cat-and-mouse.
- Month 5: UI, options page, onboarding, i18n (6 languages — I wanted it accessible).
- Month 6: License system (built on Cloudflare Workers), Stripe integration, landing page, Chrome Web Store submission.

**What I shipped**

AdOff — a Chrome ad blocker that blocks ads AND hides from anti-adblock detection. Three layers: network (107+ rules), CSS hiding, and a stealth layer that spoofs the variables sites use to detect blockers.

ultraleggera. Free plan forever. Pro at €2.69/mo with a 15-day trial and no credit card.

**What I learned**

The hardest part wasn't the technical side — it was writing copy that explains "stealth anti-detection" to someone who just wants ads gone. Still working on that.

The best decision: making the filter rules open source on GitHub. Immediate credibility.

**Where it lives**

adoff.app — feedback genuinely welcome, especially from Chrome power users.
```

---

## 4. CONTENT CALENDAR (Week 1–4)

---

### WEEK 1 — LAUNCH WEEK

| Day | Platform | Content Type | Content | Best Time |
|-----|----------|-------------|---------|-----------|
| Mon | X/Twitter | 🚀 Promo | Post the full 10-tweet launch thread | 09:00 UTC |
| Mon | Reddit | 🚀 Promo | Post to r/chrome (I built this) | 12:00 UTC |
| Mon | Product Hunt | 🚀 Launch | Submit + post maker comment | 00:01 PT (midnight) |
| Tue | Reddit | 🚀 Promo | Post to r/privacy | 14:00 UTC |
| Tue | Mastodon | 📣 Promo | Share Product Hunt link + brief intro | 10:00 UTC |
| Wed | Reddit | 📖 Educational | Post to r/SideProject (dev story) | 13:00 UTC |
| Wed | X/Twitter | 📖 Educational | "How MV3 stealth injection works" — short thread (3 tweets) | 15:00 UTC |
| Thu | Discord | 💬 Engagement | Post in relevant privacy/dev servers (where rules allow) | 18:00 UTC |
| Thu | X/Twitter | 💬 Engagement | Reply to Product Hunt comments, thank voters | Throughout day |
| Fri | Mastodon | 📖 Educational | Explain the difference between network blocking and CSS hiding | 11:00 UTC |
| Fri | X/Twitter | 📣 Promo | "Week 1 recap" — stats, top feedback, what's coming | 16:00 UTC |
| Sat | GitHub | 🔧 Technical | Pin the filter-rules repo, write a good README | Anytime |
| Sun | X/Twitter | 💬 Engagement | Ask followers: "What site gives you the most 'disable your blocker' walls?" | 14:00 UTC |

---

### WEEK 2 — EDUCATION WEEK

| Day | Platform | Content Type | Content | Best Time |
|-----|----------|-------------|---------|-----------|
| Mon | X/Twitter | 📖 Educational | "How anti-adblock detection works" — demystify it for non-technical users | 09:00 UTC |
| Mon | Reddit | 💬 Engagement | Answer questions/comments from Week 1 posts | Throughout |
| Tue | Mastodon | 📖 Educational | "What is declarativeNetRequest and why MV3 matters for privacy" | 10:00 UTC |
| Tue | X/Twitter | 📖 Educational | "The 3 layers of ad blocking" — visual thread with text diagrams | 14:00 UTC |
| Wed | Reddit | 📖 Educational | Comment in r/privacy threads about anti-adblock (genuine contribution, no spam) | 13:00 UTC |
| Wed | Discord | 📖 Educational | Post a pinned explainer in #general about how the stealth layer works | 11:00 UTC |
| Thu | X/Twitter | 💬 Engagement | Poll: "What's your #1 frustration with current ad blockers?" | 12:00 UTC |
| Thu | Mastodon | 💬 Engagement | Share the poll, engage with federated replies | 13:00 UTC |
| Fri | X/Twitter | 📖 Educational | Share poll results + your take | 15:00 UTC |
| Sat | GitHub | 🔧 Technical | Publish first community-contributed filter rule (if any received) | Anytime |
| Sun | X/Twitter | 😄 Meme | Relatable meme: "Me vs the 'Please disable your ad blocker' wall" | 16:00 UTC |

---

### WEEK 3 — SOCIAL PROOF WEEK

| Day | Platform | Content Type | Content | Best Time |
|-----|----------|-------------|---------|-----------|
| Mon | X/Twitter | 📣 Promo | Share first user testimonials / positive reviews | 09:00 UTC |
| Mon | Reddit | 💬 Engagement | Post in r/uBlockOrigin — "For sites that detect uBO, here's what else works" (helpful, not spammy) | 12:00 UTC |
| Tue | Mastodon | 📣 Promo | Boost any positive user posts about AdOff | Throughout |
| Tue | X/Twitter | 📣 Promo | "X downloads in Y days" milestone tweet (use real numbers) | 14:00 UTC |
| Wed | X/Twitter | 📖 Educational | "Why I made the filter rules open source" — trust + community angle | 10:00 UTC |
| Wed | Reddit | 📖 Educational | Thread in r/privacy: "The hidden data collection behind 'disable your ad blocker' prompts" | 13:00 UTC |
| Thu | Mastodon | 💬 Engagement | Ask: "What feature should we add next?" — list 3 options | 12:00 UTC |
| Thu | X/Twitter | 💬 Engagement | Same question on X — aggregate responses | 13:00 UTC |
| Fri | Discord | 📣 Promo | Announce any new filter rules added this week | 17:00 UTC |
| Sat | X/Twitter | 😄 Meme | "Ad blocker tier list" meme — good-natured | 15:00 UTC |
| Sun | X/Twitter | 📣 Promo | Remind followers: 15-day trial, no card | 14:00 UTC |

---

### WEEK 4 — COMMUNITY & GROWTH WEEK

| Day | Platform | Content Type | Content | Best Time |
|-----|----------|-------------|---------|-----------|
| Mon | X/Twitter | 📖 Educational | "Month 1 in review" — what you learned from user feedback | 09:00 UTC |
| Mon | Hacker News | 🚀 Submit | Post the "Show HN" if not already done — aim for weekday morning US Eastern | 13:00 UTC |
| Tue | Mastodon | 📖 Educational | Privacy deep-dive: how ad networks track users even with cookies disabled | 10:00 UTC |
| Tue | Reddit | 💬 Engagement | AMA in r/SideProject or r/privacy | 15:00 UTC |
| Wed | X/Twitter | 📣 Promo | Referral program announcement — "Invite a friend, get extra Pro days" | 09:00 UTC |
| Wed | Discord | 📣 Promo | Announce referral program in server | 12:00 UTC |
| Thu | X/Twitter | 📖 Educational | "MV3 vs MV2 for ad blocking — the honest comparison" | 10:00 UTC |
| Thu | Mastodon | 💬 Engagement | Boost referral announcement | 13:00 UTC |
| Fri | Reddit | 📖 Educational | Post in r/chrome: "MV3 doesn't have to mean worse ad blocking — here's proof" | 14:00 UTC |
| Sat | GitHub | 🔧 Technical | Release filter rule update, post changelog | Anytime |
| Sun | X/Twitter | 💬 Engagement | "What should Week 5 content be about?" — community vote | 15:00 UTC |

---

**General posting principles:**
- **Best days overall**: Tuesday–Thursday for tech/privacy audiences
- **Best times for EU audience**: 08:00–10:00 UTC (morning) or 17:00–19:00 UTC (evening)
- **Best times for US audience**: 13:00–15:00 UTC (US morning) or 22:00–00:00 UTC (US evening)
- **Never post more than 2x/day** on any single platform — quality over quantity
- **Always reply to comments** within 24 hours during launch month

---

## 5. HASHTAG SETS

---

### Privacy Hashtags (10)

```
#Privacy
#DigitalPrivacy
#OnlinePrivacy
#DataPrivacy
#TrackingProtection
#PrivacyFirst
#NoTracking
#PrivacyMatters
#BrowserPrivacy
#AdTracking
```

---

### Tech/Chrome Hashtags (10)

```
#ChromeExtension
#ManifestV3
#MV3
#BrowserExtension
#WebDevelopment
#JavaScript
#AdBlocking
#OpenSource
#FilterRules
#DeclarativeNetRequest
```

---

### Indie Dev Hashtags (10)

```
#IndieHacker
#SideProject
#BuildInPublic
#SoloFounder
#IndieDevs
#MakerLife
#SaaS
#BootstrappedFounder
#IndieProduct
#SolopreneurLife
```

---

### General Engagement Hashtags (5)

```
#AdBlocker
#NoAds
#BlockAds
#CleanWeb
#AdFree
```

---

**Hashtag usage guidelines:**

- **X/Twitter**: 2–3 hashtags per tweet (more reduces engagement)
- **Mastodon**: 4–6 hashtags, place at the end of the post
- **Reddit**: Do not use hashtags — they are not supported and look out of place
- **Discord**: Not applicable
- **Recommended combos**:
  - Launch posts: `#IndieHacker #BuildInPublic #ChromeExtension`
  - Technical posts: `#MV3 #WebDevelopment #ChromeExtension`
  - Privacy posts: `#Privacy #AdBlocking #DigitalPrivacy`
  - Engagement: `#AdBlocker #NoAds #CleanWeb`

---

## 6. REFERRAL MESSAGE TEMPLATES

---

### WhatsApp / Telegram (casual, 2 lines)

```
Sto usando AdOff per bloccare la pubblicità nel browser — funziona anche sui siti che di solito ti forzano a disattivare il blocco. Prova gratis 15 giorni senza carta: adoff.app
```

*(Italian version)*

```
I've been using AdOff to block ads in Chrome — it works even on sites that usually force you to disable your blocker. Free 15-day trial, no card: adoff.app
```

*(English version)*

---

### Email Share

**Subject:**
```
This fixed the "disable your ad blocker" problem for me
```

**Body:**
```
Hey,

If you use an ad blocker and keep hitting "please disable your ad blocker" walls, this might help.

I've been using AdOff — a Chrome extension that blocks ads and also hides the fact that it's blocking them, so sites can't detect it. There's a free plan and a 15-day Pro trial with no credit card.

→ adoff.app

Worth checking out if you're tired of those walls.
```

---

*End of AdOff Social Media Launch Kit v1.0*
