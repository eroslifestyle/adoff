# AdOff Core MVP Launch — Editorial Calendar (SMM HULK, gg1–gg21)

> **Repurpose, never mirror.** One core idea → platform-native variants. Track by pillar + status.

## GG1 (Launch day, h0–h10 CORE MVP build + h10 teaser)

| Date | Platform | Pillar | Format | Hook | Asset | Status | Owner |
|------|----------|--------|--------|------|-------|--------|-------|
| gg1 h10 | IndieHackers | Pain-frame | Teaser carousel (3–4 img) | "You lose €X/year with ads. Here's the math." | 4 carousel cards (pain frame only, NO link) | READY | Staff A |
| gg1 h10+1h | IH comment | Proof | Link drop + POV | "We built a calculator to show you exactly. Try it→" [LINK] | Comment (pinned) | READY | Staff A |
| gg1 h12 | Reddit r/Entrepreneur | Pain-frame | Video + link | "Making a Chrome extension that shows real €€€ savings" | 15s video + comment link | DESIGN | Staff B |
| gg1 h14 | ProductHunt | Teaser | Launch prep | (scheduled for gg2 h0) | Headline + desc | DRAFT | Staff B |

**Gate gg1 h24**: ≥45 clicks → continue. <45 → switch `/benchmark` primary gg2.

---

## GG2 (Community seeding starts, n8n onboarding)

| Date | Platform | Pillar | Format | Hook | Asset | Status | Owner |
|------|----------|--------|--------|------|-------|--------|-------|
| gg2 h0 | ProductHunt | Launch | Launch post + demo | "AdOff: Know your real ad losses in 30s. No signup." | 1 demo video + PDF screenshot | DESIGN | Staff B |
| gg2 h2 | PH comment | POV | Thread (why we built it) | "AdSense lies about CPM; here's the real impact" | 3-part thread | COPY | Staff B |
| gg2 h6 | Reddit r/Entrepreneur | Proof | Post 2 (different angle) | "Updated: our calculator now shows savings per ad type" | Screenshot calc | DESIGN | Staff B |
| gg2 h10 | IH community | Follow-up | Post 2 (decay -50%) | "Day 2: 120 calculations run, here's the data" | Screenshot metrics | READY | Staff A |

**Gate gg2 h12**: <15 clicks last 12h → escalate Discord bot. ≥50 clicks → scale.

---

## GG3–GG7 (Linear growth, discovery pipeline)

| Date | Platform | Pillar | Format | Cadence | Asset | Notes |
|------|----------|--------|--------|---------|-------|-------|
| gg3 | IH (new community) | Pain-frame | Teaser + comment link | Day 3 new community | Carousel (repurposed) | -50% decay expected |
| gg4 | Reddit (new sub) | POV | Post 2 | Day 4 | Thread variant | niche differ (r/privacy, r/selfhosted) |
| gg5 | IndieHackers (Day 5 check) | Proof | Metrics screenshot | Day 5 | Stats image | KPI check: 4 actives? |
| gg6 | ProductHunt (follow-up) | Micro-promo | "Ask Me Anything" | Day 6 | Comment replies | Community engage |
| gg7 | All channels | Pain-frame | Weekly recap | Day 7 | Video montage | 3–4 attives target gate |

**Gate gg5**: <4 actives → escalate Discord bot. **Gate gg7**: target 4 attives → scale or pivot.

---

## GG8–GG21 (Community discovery pipeline + Discord bot + referral unlock)

| Phase | Action | Cadence | Tool | Notes |
|-------|--------|---------|------|-------|
| **gg8–gg14** | Discovery: find ≥3 new communities/day IT + EN (indie, growth, tools, privacy) | Daily | LLM (discovery-pipeline) | Check ban-policy per community |
| **gg9–gg14** | Discord bot seeding (fallback, max 6 attives) | 1 post/community/day, link comment | n8n + bot | Rate-limit, avoid ban |
| **gg14+** | Dashboard: funnel analytics (click→signup→attivo per sorgente) | Ongoing | Plausible | SEO support post-gg14 |
| **gg18+** | Referral activation (only ≥40 attives) | Post gg18 | system | Track k-factor |

---

## Asset Pipeline (what gets made, when)

### gg1 h0–h10 (MVP build — Asset A, B, C)
- [ ] **A1** — Teaser carousel (4 cards, Pillar: pain-frame, Platform: IH)
  - Card 1: Headline "€X/year persi con ads?" (img-max generated, pain-themed)
  - Card 2: "Calcolatore real-time per scoprire il costo reale"
  - Card 3: Formula semplice (screenshot calc UI)
  - Card 4: CTA "Scopri subito i tuoi €" (ma NO link h10, link ~h11 in commento)
  - Format: 1080×1350 (IG-native, ma IH carousel-friendly)
  - Status: DESIGN
- [ ] **A2** — IH comment (pinned, ~50 words)
  - Hook: "We built exactly what I asked for—here's the link"
  - Link: Calculator (UTM: `?utm_source=IndieHackers&utm_medium=comment&utm_campaign=gg1-launch`)
  - Status: COPY (use `brand-max`)
- [ ] **B1** — Reddit r/Entrepreneur video (15s, Pillar: pain-frame, no voice yet)
  - Script: "How much do you lose/month to ads? Real numbers."
  - Clip: 3–4 calc screenshots + Ken Burns zoom
  - Captions: burned word-by-word (stt-max + caption_burn.sh)
  - Status: DESIGN (stills ready; VO gg2+)
- [ ] **C1** — ProductHunt launch image + headline
  - Image: Quote card "€X/year. Calcolato." (FLUX.1-schnell, text-in-image)
  - Headline: "AdOff: Discover your real ad losses in 30 seconds" (English, PH audience)
  - Status: DRAFT

### gg2 (Demo video, onboarding email draft)
- [ ] **D1** — PDF demo screenshot (Pillar: proof)
  - Image: Actual PDF report output (from MVP)
  - Caption: "This is what you get after 1 click"
  - Status: READY (screencap from live MVP)
- [ ] **D2** — PH launch thread (3-part, Pillar: POV)
  - Part 1: "Why we built this"
  - Part 2: "The math no one talks about"
  - Part 3: "Join 100+ users discovering their real numbers" (social proof if >100 sign-ups)
  - Status: COPY (use `glm-max` for POV depth)
- [ ] **E1** — Onboarding email (n8n prep, gg2+)
  - Trigger: user signup via Calculator
  - Content: "Ecco i tuoi €X/anno persi. Ecco 3 azioni per ridurli."
  - Status: TEMPLATE (ready in gg2)

---

## Platform-native specs (repurpose guide)

### IndieHackers
- **Carousel**: 4–5 cards, hook in card 1, NO link in carousel body → link in top comment (h10+).
- **Comment link**: "Try it here → [link]" (pinned, visible 24h).
- **Timing**: gg1 h10 teaser, gg1 h11 link drop, gg2 follow-up gg1+24h (decay).

### Reddit r/Entrepreneur, r/SideProject, r/IndieHackers
- **Post 1**: Pain-frame video (15–30s) + comment link.
- **Post 2 (gg2/3)**: Different angle (Proof or POV variant).
- **Comment strategy**: Link in top comment, answer Q's in thread.
- **Timing**: Stagger across 3 communities, 1 post/community/day max (anti-spam).

### ProductHunt
- **Launch post**: Headline (hook) + 1–2 screenshots (demo) + 1 video (30s max, product in action).
- **AMA / community**: Replies to questions, social proof ("100+ calculations today").
- **Timing**: gg2 h0 (Wednesday ideal, 9am PT for US audience).

### n8n (automation, gg2+, not in core MVP)
- **Webhook trigger**: `/api/track` event=signup → send email "ecco i tuoi €X persi"
- **Templating**: use `brand-max` for personalized subject lines
- **Cadence**: email gg0 (instant), nudge email gg2 (follow-up).

---

## KPI checks & kill gates

| Gate | Condition | Action | Fallback |
|------|-----------|--------|----------|
| **gg1 h24** | ≥45 click/24h | Continue all 4 channels | <45 → switch `/benchmark` to primary gg2 |
| **gg2 h12** | <15 click last 12h | Escalate Discord bot, kill low-performer channels | ≥50 → scale 2 more communities |
| **gg5** | <4 attives | Escalate bot to primary, pause community seed | ≥4 → on track |
| **gg7** | <3 attives | Restart with different angle (check tone/pain-frame) | ≥3 → linear growth phase |
| **gg14** | <20 attives | KPI drops to 25 (not 30), reassess | ≥20 → on track to 25–30 |
| **gg21** | Target 25–30 attives | Ceiling hit; activate referral (k≤0.1) or pause | >30 → scale or optimize |

---

## Ownership & blockers

- **Staff A (dev)**: Core MVP build (gg1 h0–h10), IH seeding, asset A1–A2.
- **Staff B (growth)**: Community discovery, Reddit/PH/Discord, video asset B1, gg2+ onboarding + automation.
- **Blockers to resolve NOW**:
  1. ✓ LLM server uptime (stress-test before gg1 h10).
  2. ✓ `/benchmark` fallback ready (in case <45 clicks gg1).
  3. ? Discord bot code ready (needed if gg2 pivot triggered).
  4. ? n8n email template (for gg2+ onboarding).

---

Generated by SMM HULK Phase 2 (Editorial Calendar).
Repurpose guide: one idea → four native variants. Measure decay -50%/post per community (expected).
