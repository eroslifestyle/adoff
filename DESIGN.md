# DESIGN.md — AdOff

> Single source of truth for the AdOff brand site (`adoff.app`). Authoritative for `site/style.css`, `site/adoff-nav.js`, `site/adoff-footer.js` and any inline overrides in pages under `site/`. The extension UI (`app*/src/popup.*`, `options.*`, `onboarding.*`) follows a separate product register and is **not** governed by this file.

## Direction (2026-05-20 final)

**Brand-faithful execution of the impeccable laws.** The visual identity follows `sviluppo/marketing/brand/brand-bible.json` (canonical): Shield Purple `#7c5cfc` on Deep Space `#0a0a1a`, Inter as the only sans, no decorative gradients on type, no glow halos, no metric-strip cliché in the hero. The "premium SaaS" look is preserved where it serves the brand; everything that smelled of "AI template" has been stripped (gradient text, identical pricing cards, side-stripe borders, emoji-in-every-CTA, hero metric cliché).

### Scene that forces the theme

> *"Someone who uses Chrome eight hours a day opens our page on a 27-inch monitor in the evening. The dark theme rests their eyes after a workday. They need to understand in three seconds: what is this, why is it different, what does it cost. The page must look like a serious privacy product, not a startup pitch."*

Forces dark, forces a single confident accent, forces editorial-fast scanability over decorative noise.

### Category-reflex check

- **First-order**: "ad blocker → dark + purple + gradient" → we **embrace** dark + purple as brand DNA, but we kill the gradient and the glow that mark the category as SaaS-template. The viola stays, the cheapness goes.
- **Second-order**: "ad blocker that's not SaaS → terminal-green-on-black" → rejected: we are a consumer product, not a hacker tool. We stay dark-purple but raise the typography quality and the hierarchy.

## Color strategy: Committed

A single accent — **Shield Purple `#7c5cfc`** — carries 30–50% of the brand identity. Pure white is reserved for headings and high-contrast surfaces; Steel Gray for secondary text; Soft Purple `#b8a9ff` for hover states and accent-light areas; danger/success only for semantic states, never decorative.

### Palette (canonical from brand-bible.json)

| Token | Hex | Use |
|---|---|---|
| `--deep-space` | `#0a0a1a` | Page background |
| `--midnight-blue` | `#12122a` | Cards, panels |
| `--surface-2` | `#1a1a36` | Hover surface, table rows |
| `--shield-purple` (`--accent`) | `#7c5cfc` | Primary CTA, brand wordmark "Off", eyebrows, key emphasis |
| `--shield-purple-light` (`--accent-light`) | `#b8a9ff` | Hover states, links, italic emphasis, light text on accent bg |
| `--shield-purple-dark` (`--accent-dim`) | `#4c3ad4` | Reserved for shadow / depth, NOT used as gradient stop on buttons |
| `--pure-white` | `#ffffff` | Headings, "Ad" in wordmark, body text emphasis |
| `--text` | `#e2e2f0` | Body text |
| `--steel-gray` (`--text-muted`) | `#8a8aaa` | Secondary text |
| `--text-dim` | `#5a5a72` | Tertiary, captions |
| `--success-green` (`--success`) | `#4ade80` | Confirmations, check marks |
| `--alert-red` (`--danger`) | `#f43f5e` | Pain points, "before" column |

### Forbidden

- `background-clip: text` on any element (gradient text)
- `linear-gradient()` on `.btn--primary` (solid Shield Purple instead)
- Glow halos > 4px on CTAs
- Side-stripe borders (left/right colored borders as decoration)
- Hero metric template ("X+ users · Y MB · Z% off")
- Identical pricing cards
- Emoji prefix on primary CTAs

## Typography

### Stack (brand-faithful)

- **All text**: **Inter** (Google Fonts, weights 400/500/600/700/800)
- **Monospace** (code blocks, version strings): **JetBrains Mono** (Google Fonts, weight 500)
- No Lexend. No Fraunces. No serif display. Brand-bible declares Inter as `primary_font`.

### Scale

- `h1` / hero headline — `clamp(2.5rem, 6vw, 4.4rem)`, weight 800, tight tracking `-0.03em`
- `h2` — `clamp(1.7rem, 3.8vw, 2.8rem)`, weight 800
- `h3` — `clamp(1.05rem, 2vw, 1.25rem)`, weight 700
- Body — 17px / 1.65 long-form, 16px / 1.65 general
- Section eyebrow — `0.78rem`, `letter-spacing: 0.14em`, uppercase, weight 600, color `--accent-light`

### Rules

- Body line length capped at **60ch** in long sections, **54ch** in hero sub
- Italic emphasis in headings uses `--accent` (Shield Purple) for one word per heading — never entire phrases
- Tabular numbers on pricing, statistics, comparison tables
- Hierarchy through scale + weight contrast ≥1.4 between steps

## Wordmark

The brand mark is **"AdOff."** rendered as text (no image asset needed). Defined in `style.css` under `.wordmark`:

- `Ad` — pure white
- `Off` — Shield Purple
- `.` — Shield Purple

Inter 800, letter-spacing `-0.04em`, no separator gap between letter groups. Three sizes:

- `.wordmark--hero` — `clamp(2.8rem, 7vw, 5rem)` above the hero eyebrow
- `.wordmark--nav` — 21px in the sticky nav (injected by `adoff-nav.js`)
- `.wordmark--foot` — 24px in the footer brand block (injected by `adoff-footer.js`)

Same construction across all three. The dot after "Off" is the closing punctuation of the brand promise *"Ads? Off."* — quiet, definitive, repeated everywhere.

## Layout

- Container: `min(64rem, 92vw)` for long-form, `min(72rem, 94vw)` for wide grids
- Section padding: `clamp(72px, 9vw, 116px) 0` — varies with viewport
- Adjacent sections deliberately differ in vertical density
- Hero is left-aligned on desktop (wordmark + eyebrow + headline + sub + CTAs + distribution), centered on mobile

## Components

### Buttons

- `.btn--primary` — solid `--accent` background, white foreground. Hover: shifts to `--accent-light` background with `--deep-space` foreground + 4px ring (`box-shadow: 0 0 0 4px var(--accent-soft)`). Lift `-1px`. **No gradient. No glow halo.**
- `.btn--outline` — transparent fill, `--border-strong` 1px outline, `--text` foreground. Hover: `--accent` outline + `--accent-light` foreground.
- `.btn--ghost` — text only, no border. Used for tertiary nav and secondary CTAs.
- Same comfortable `.btn--lg` size for hero. Legacy `.btn--xl` aliased to `.btn--lg`.

### Pricing cards (differentiated weight)

- 4 plans (Free · Monthly · Annual · Lifetime) in a 2×2 grid.
- **Annual** card: `.plan-card--popular` — Shield Purple border + soft purple background tint + inset ring + softened external shadow. Visually dominant.
- **Free** card: dashed border, 92% opacity. Visually de-emphasized (it's the install default, not a sales option).
- **Monthly** and **Lifetime**: standard surface + standard border. Distinguishable only by content (recurring vs one-time).

### Hero

- Wordmark "AdOff." top, large display size
- Eyebrow below with pulsing success-green dot ("trial available" signal)
- Headline H1 with one italic Shield Purple word emphasizing the brand promise (*Senza pubblicità*, *invisibile*, *adesso*)
- Sub-copy 56ch max, body text, one `<strong>` for the decisive phrase
- Primary CTA (`.btn--primary btn--lg`) + ghost CTA "Vedi i piani"
- Distribution row: "Disponibile su" + 4 store marks as pills (CWS, AMO, Edge, Safari). Replaces the metric-cliché trust strip.
- Subtle ambient radial gradient behind (10% Shield Purple alpha, no halo)

### Cards (Features, Testimonials, Trust)

- Surface `--surface` (`--midnight-blue`) on `--bg` page. Border `1px solid var(--border)`. Radius `18px`.
- Hover: border shifts to `--accent` (Shield Purple). No translate, no glow, no scale.
- Testimonial avatars are **monograms** (initial in Shield Purple on accent-soft circle), not emoji.

### FAQ accordion

- Flat list, separated by `1px solid var(--border-subtle)` rules. No cards.
- Open state: surface background, accent-line bottom border. Chevron rotates 180°.

### Section labels (eyebrow)

- Plain caps Inter text, `letter-spacing: 0.14em`, color `--accent-light`. No pill background.

### Tables (Free vs Pro)

- Striped via background tint, not lines. SVG check / dim cross marks (no emoji).

### Navigation (injected by `adoff-nav.js`)

- Sticky on top, blurred dark background `rgba(10,10,26,0.92)`
- Wordmark "AdOff." left, language dropdown + CTA right
- CTA solid Shield Purple (no gradient). Hover: shifts to Soft Purple bg with Deep Space foreground.

### Footer (injected by `adoff-footer.js`)

- Compact 4-column desktop, 2-column mobile
- Wordmark "AdOff." 24px in the brand column
- Description, 3 link columns, bottom row with copy + legal links

## Motion

- Single easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Durations: 150ms fast UI, 220ms standard, 420ms slow (scroll-reveal, accordion)
- `.reveal` elements: opacity + 20px translateY → 0
- Reduce-motion preference fully honored (no animations, instant state)

## Iconography

- SVG inline preferred (1.5px stroke, currentColor, 18–24px)
- Emoji allowed only as feature-card icons (🚫🎬👻⚡) and in compare table affordance (✓/✗)
- Avatar monograms in testimonials, never emoji

## What does NOT change

- All `data-i18n` keys in `index.html`, `install.html`, `support.html`, `salesletter.html`
- Stripe checkout flow (`API_URL`, `checkout(plan)`, `selectedDevices`, `PRICES`)
- Anchor IDs (`#pricing`, `#features`, `#stealth`, `#compare`, `#faq`)
- Price values (€2.69 / €29.59 / €67.90 for 3 devices)
- Structured data JSON-LD blocks
- 15-language hreflang and sitemap

## Asset references

- Brand bible (canonical): [sviluppo/marketing/brand/brand-bible.json](sviluppo/marketing/brand/brand-bible.json)
- Logo files (legacy, replaceable by wordmark): `site/assets/logo.svg`, `site/assets/icon128.png`
- Fonts: Google Fonts CDN (Inter + JetBrains Mono). Self-hosting recommended for production (kill the third-party request, fits zero-tracking promise).

## Open items for fase 2

1. **Other 14 languages** in `adoff-i18n.js`: copy currently uses old text in translations. Schedule a translation pass.
2. **Other 17 root pages** (`guide.html`, `how-it-works.html`, `unique-tech.html`, `best-ad-blocker-2026.html`, `community.html`, `press.html`, `license-guide.html`, `affiliati.html`, `account.html`, `success.html`, `privacy.html`, `terms.html`, `withdrawal.html`, `admin.html`, and 15 language subfolders) inherit the new design system from `style.css` but still hold old copy. Schedule per-page rewrite.
3. **Self-host fonts** with subsetted Latin + Latin-Extended.
4. **Compress `logo.png` (421KB) and `mockup.png` (444KB)** to WebP under 60KB each.
5. **Split `adoff-i18n.js` (724KB)** into `/i18n/{lang}.json` lazy-loaded per language.
6. **Decide on `logo.svg`** — current asset is a generic shield, not brand-faithful. Either replace with a wordmark-derived SVG or remove the favicon icon dependency.
