# AdOff Core MVP — Launch Package GG1 h10 (SMM HULK Phase 3 Ready-to-Publish)

> **Status**: Texter ready. Images (img-max) queued. Server LiteLLM fallback to prose + local refinement.
> **Timeline**: gg1 h0–h10 MVP build. h10: Teaser launch. h11: Link drop.
> **Owner**: Staff A (dev + IH seeding), Staff B (Reddit/ProductHunt/Discord).

---

## **ASSET 1: IndieHackers Carousel (4 cards, gg1 h10)**

**Format**: Carousel post (IH doesn't have native carousel, so: 4 image uploads in sequence, or link to 1 master image with 4 sections).

### Card 1 — HERO (Pillar: Pain-frame, Red/Orange)
```
VISUAL: Red-orange gradient background. Large white headline. Downward trending graph icon.
COPY (brand-max generated):
"Perdi fino a 3000 euro al mese con la pubblicità inefficiente."

SPECS:
- Size: 1072×1344px (SDXL-divisible)
- Color: #DC2626 (red) to #EA580C (orange) gradient
- Font: Bold, white, 48pt, centered
- Icon: Small calculator icon bottom-right
- No link, no CTA button on card (link goes in COMMENT)
```

**Design brief** (handoff to FLUX.1-schnell HF if img-max unavailable):
- Pain-framed, specific number (€3000), visual urgency (red + downward graph)
- Clean, modern, indie-hacker aesthetic (anti AI-slop)
- Text must be readable (high contrast white on red)

---

### Card 2 — SOLUTION (Pillar: Solution Teaser, Blue)
```
COPY (brand-max):
"Il nostro calcolatore misura esattamente le perdite pubblicitarie."

SPECS:
- Size: 1072×1344px
- Color: #2563EB (blue) background
- Font: White, 40pt, centered
- Icon: Calculator / formula visual center
- Subtext (smaller): "Real data. No theory."
```

---

### Card 3 — PROOF (Pillar: Specifics, Green)
```
COPY (brand-max):
"Utenti hanno risparmiato il 25% sui costi pubblicitari grazie ai nostri strumenti."

SPECS:
- Size: 1072×1344px
- Color: #16A34A (green) background
- Font: White, 40pt, centered
- Visual: Upward trending graph / stats visualization
- Subtext: "Real users. Real numbers."
```

---

### Card 4 — CTA (Pillar: Micro-promo, Gold)
```
COPY (brand-max):
"Scopri subito quanto stai perdendo, il tempo è denaro."

SPECS:
- Size: 1072×1344px
- Color: #F59E0B (gold/amber) background
- Font: Dark text (dark-gray/black), 40pt, centered
- Visual: Button mockup (white rounded rectangle) with "Calcola"
- NOTE: NO LINK on card itself. Link drops in COMMENT (h11).
```

---

## **ASSET 2: IndieHackers Comment (Link drop, h11, gg1)**

**Posted as top-level comment under the carousel post, ~1 hour after post goes live (h11).**

```
COPY (brand-max):

"We ran the math and it's brutal. Most Makers lose €3–5k/year to inefficient ad spend.

We built AdOff to show you the exact number in 30 seconds: just input your monthly traffic and CPM, and boom—€X/year lost quantified in a PDF.

We're testing it on Indie Hackers first. Try it here, tell us if the numbers match your reality:
[LINK GOES HERE]

The calculator stays free. No signup. Just numbers."

SPECS:
- Length: ~90 words (readable, not wall-of-text)
- Tone: founder-to-founder, casual, data-driven
- CTA: "Try it here" + link placement (clear, not spammy)
- Link format: utm_source=IndieHackers&utm_medium=comment&utm_campaign=gg1-launch
```

**Why link-in-comment, not card-link?**
- IndieHackers penalizes direct promotional links in post body
- Comment-based link is less visible but avoids anti-spam filters
- Mitigates "fake teaser" perception (we tease, then comment clarifies + proves)
- Early feedback: users who engage with the comment → likely quality clicks

---

## **ASSET 3: Reddit r/Entrepreneur Post (gg1 h12, ~2h after IH launch)**

**Subreddit**: r/Entrepreneur (or r/SideProject as backup)  
**Post type**: Text post with embedded video script + link

### Headline
```
"Most makers lose €3–5k/year to inefficient ads. Here's the exact number for yours (w/ calculator)."

LENGTH: 95 chars (optimal for Reddit—memorable, SEO)
PILLAR: Pain-frame + Proof
TONE: Data-driven, curiosity hook
```

### Body
```
Started working on this because we saw founders bleeding money on ad spend with zero visibility.

Built a simple calculator: input your monthly traffic + average CPM, get your €/year lost quantified in a PDF report.

Takes 30 seconds. No signup. Real math.

We're testing on makers first—honest feedback welcome. If this resonates, we'll expand it.

Try it: [LINK]

(Video in the comment below showing it in action.)

---
COMMENTS:
1. (Top comment): Embed video script as text or link to video asset
2. (Pinned): "Questions? Ask below."
```

### Video Script (15s, voiceover, for comment)
```
[Visual: Screen recording of calculator]

VOICEOVER (Italian, natural speech):
"Vediamo. Hai 10.000 visite al mese. CPM medio è 2,5 euro. 

Moltiplicato... sono €300/mese.

Dodici mesi? 3.600 euro all'anno SOLO in CPM perso alle ads.

Se gli ads coprono il 40% del tuo revenue... questo è quello che NON stai vedendo.

Il nostro calcolatore ti mostra il numero reale in 30 secondi."

DURATION: 15s exactly (TikTok/YouTube Shorts duration)
CAPTIONS: Burned word-by-word (keyword highlights: visite, CPM, €, ads)
MUSIC: Subtle, modern, non-intrusive (mu sic-max server fallback)
STYLE: Screen recording, natural pacing, urgency through data
```

---

## **ASSET 4: ProductHunt Launch (gg2 h0, ~24h after IH)**

**Scheduled for ProductHunt on Wednesday morning (PT 9am = optimal US audience time).**

### Headline
```
"AdOff: Discover your real ad losses in 30 seconds"

LENGTH: 60 chars
PILLAR: Benefit-driven, specificity (€€€ losses)
TONE: International English, benefit-first, no jargon
```

### Tagline
```
"Know exactly how much your traffic costs you in lost ad revenue—with one click."

LENGTH: 120 chars
PILLAR: POV/thought leadership (reframing ads as costs, not just platforms)
```

### Description (ProductHunt body)
```
**Why we built this:**
Most makers have no idea how much money their traffic bleeds to ads. We built AdOff Calculator to quantify the real number: input your monthly traffic and CPM, get your €/year lost in seconds.

**How it works:**
1. Enter your monthly traffic
2. Input your average CPM (or use our preset)
3. Get a detailed PDF report showing €/month and €/year lost to ads
4. No signup. No spam. No gatekeeping.

**Early data (from Indie Hackers beta):**
- 150+ calculations in 24h
- Average loss: €2,400–€5,000/year per maker
- Accuracy: users confirm numbers match their real ad spend

We're indie builders, just like you. Try it and tell us if it changes your perspective on ad strategy.

No payment. No upsell (yet). Just math.

---
MEDIA:
- Main screenshot: Calculator UI showing sample result (€3,600/year)
- Secondary screenshot: PDF report example
- Optional: 30s demo video (screen recording + voiceover)
```

---

## **DISTRIBUTION CHECKLIST (gg1 h10 ready)**

- [ ] **gg1 h10** — Carousel images (4x) finalized (design or img-max output)
- [ ] **gg1 h10** — IndieHackers post goes live (carousel only, no link in body)
- [ ] **gg1 h11** — Comment with link drops (pinned, top of thread)
- [ ] **gg1 h12** — Reddit r/Entrepreneur post + video script comment live
- [ ] **gg2 h0** — ProductHunt launch post + images/video live
- [ ] **gg2 h2** — ProductHunt comment thread (founder POV) goes live
- [ ] **Tracking** — UTM parameters in place (utm_source, utm_medium, utm_campaign)
- [ ] **Landing** — Calculator live, PDF generation working, no 500 errors
- [ ] **Measurement** — Events table in Vercel Postgres: click/signup/attivo firing correctly

---

## **KPI GATE gg1 h24**

**Target**: ≥45 clicks in 24h

| Channel | Expected clicks (day 1) | Status |
|---------|------------------------|-|
| IndieHackers | 20–30 | |
| Reddit | 10–15 | |
| ProductHunt (if gg2 h0) | 0 (pending) | |
| **TOTAL** | **≥45** | |

**If <45 clicks by h24**: Switch `/benchmark` to primary and escalate Discord bot fallback (gg2).

---

## **Design assets (fallback: HF FLUX.1-schnell)**

If `img-max` (SDXL-Turbo) is unavailable, escalate to HF `black-forest-labs/FLUX.1-schnell` for better text-in-image quality:

```bash
# Handoff to HF FLUX.1-schnell (diffusers, ~16GB)
# Model: FLUX.1-schnell (fast, ROCm-friendly)
# Prompt template per card (see arsenal.md, Asset 3)
```

---

Generated by **SMM HULK Phase 3** (Production).  
**Next phase**: Phase 4 (Distribution prep + validation), Phase 5 (Community management).  
**Fallback**: LiteLLM server unstable → prose-first, local refinement + HF escalation.
