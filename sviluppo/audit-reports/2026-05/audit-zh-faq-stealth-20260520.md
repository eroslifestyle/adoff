# Audit Report: ZH (Simplified Chinese) FAQ + Stealth i18n

**Date:** 2026-05-20  
**File:** `site/i18n/zh.json`  
**Scope:** Keys starting with `faq.*`, `sl.faq.*`, `sl.stealth.*`  
**Total Keys:** 48  
**Status:** ⚠️ **PARTIAL — 29 CRITICAL/QUALITY ISSUES**

---

## Executive Summary

The Simplified Chinese (ZH) translation for FAQ and Stealth Mode sections has **significant quality and completeness gaps**:

- **1 formatting bug:** Missing `<br>` HTML tag
- **1 extreme content gap:** 2 FAQ answers translated to 4-char placeholder ("永远免费")
- **27 length anomalies:** Text compressed to 50-60% of English length on average (answers)
- **Systemic issue:** Chinese answers appear machine-shortened or placeholder-only

**Risk:** ZH users see incomplete FAQ explanations, degraded UX vs. English speakers. Potential support volume increase.

---

## Issues Breakdown

### 🔴 CRITICAL: HTML Formatting Bug

**Key:** `sl.stealth.title`

Missing `<br>` line break. The text will render as a single line instead of breaking before "AdOff".

| Field | EN | ZH |
|---|---|---|
| **Value** | `Other blockers get detected.<br>AdOff <em>doesn't</em>.` | `其他拦截器被发现。AdOff <em>不会</em>。` |
| **Issue** | ✅ Correct | ❌ Missing `<br>` |

**Fix:** Add `<br>` before "AdOff":
```json
"sl.stealth.title": "其他拦截器被发现。<br>AdOff <em>不会</em>。"
```

---

### 🔴 CRITICAL: Two FAQ Answers Reduced to 4-Character Placeholder

**Keys:** `faq.a1`, `faq.a4`

Both answers are translated as the exact same 4-character string: `"永远免费"` (literally "forever free"). This is a placeholder, not a translation. The English versions are 267-268 characters each with detailed explanations.

| Key | EN Length | ZH Length | ZH Content | Status |
|---|---|---|---|---|
| **faq.a1** | 267 chars | 4 chars | 永远免费 | ❌ **PLACEHOLDER ONLY** |
| **faq.a4** | 268 chars | 4 chars | 永远免费 | ❌ **PLACEHOLDER ONLY** |

**EN faq.a1 sample:**
> "Yes, really. Free plan is free forever, with no time limit and no credit card. The 15 Pro days are a trial... Code is open to inspection before installation..."

**ZH faq.a1:**
> "永远免费" (forever free)

**EN faq.a4 sample:**
> "Pay once, use AdOff Pro forever, including all future updates. License is tied to your account and can be used on up to..."

**ZH faq.a4:**
> "永远免费" (forever free)

**Context:** These answers are the longest in the FAQ and most important for user trust (cost transparency, license model). Placeholder reduces credibility.

**Fix Required:** Full proper translation of both answers needed.

---

### ⚠️ SEVERE: 25 FAQ Answers Show 40-60% Content Compression

All FAQ answer keys (`faq.a*` except a1/a4, plus `sl.faq.a6`) show significant length reduction compared to English. Samples:

| Key | EN Length | ZH Length | Ratio | Content Sample |
|---|---|---|---|---|
| `faq.a2` | 313 chars | 128 chars | **41%** | Answercut short on video ad explanation |
| `faq.a3` | 398 chars | 173 chars | **43%** | Stealth Mode explanation reduced |
| `faq.a5` | 416 chars | 199 chars | **48%** | Privacy policy summary shortened |
| `faq.a7` | 343 chars | 130 chars | **38%** | Performance claims under-explained |
| `faq.a8` | 397 chars | 146 chars | **37%** | Security/permissions details missing |
| `faq.a9` | 382 chars | 138 chars | **36%** | "Works on all sites?" reduced to basics |
| `sl.faq.a6` | 342 chars | 145 chars | **42%** | Multi-browser question shortened |

**Pattern:** Chinese answers retain the core claim but omit nuance, disclaimers, and supporting details.

**Example — faq.a7 (Performance):**

EN (343 chars):
> "No, the opposite, it makes your browser faster. AdOff is extremely lightweight (a fraction of what other blockers weigh, running 3-8 MB), and it runs asynchronously: does not block Chrome's main thread. By eliminating network ad requests, traffic can be reduced by 23%, shortening page load times. Fewer scripts executing means less RAM and battery drain."

ZH (130 chars):
> "不会,相反,它会让浏览器更快。AdOff 超轻量 (其他拦截器重量的一小部分,为 3-8 MB),并以异步方式运行:不会阻止 Chrome 的主线程。通过消除网络广告请求,可将流量减少至 23%,缩短页面加载时间。更少的脚本执行意味着更少的 RAM 和电池消耗"

**Issue:** All numbers, percentages, and technical details ARE translated, but secondary explanations ("does not block Chrome's main thread" rationale) are compressed.

---

### ⚠️ MODERATE: 9 FAQ Questions Below Optimal Length

FAQ questions (`faq.q*`) are translated at 26-55% of English length, but this is partially expected for questions (Chinese is more concise). However, some lose important context:

| Key | EN | ZH | Issue |
|---|---|---|---|
| `faq.q1` | 45 chars | 19 chars | Core question preserved, minimal loss |
| `faq.q2` | 34 chars | 11 chars | Conciseness OK |
| `faq.q3` | 43 chars | 18 chars | Conciseness OK |
| `faq.q4` | 35 chars | 12 chars | Conciseness OK |
| `faq.q5` | 28 chars | 10 chars | Conciseness OK |
| `faq.q8` | 28 chars | 13 chars | Conciseness OK |
| `faq.q9` | 29 chars | 11 chars | Conciseness OK |

**Assessment:** Questions are appropriately shortened for Chinese (more dense language). No critical issues here.

---

## Quality Observations

### ✅ Strengths

1. **All 48 keys present** — no missing translations entirely
2. **Technical terms accurate** — "IMA SDK", "MAIN world", "CSS filter" all correctly translated
3. **HTML tags mostly correct** — 47/48 keys have matching HTML structure
4. **Natural Chinese phrasing** — translated text reads idiomatically, not robotic
5. **Stealth Mode section solid** — `sl.stealth.how*` descriptions are well-proportioned (50-70% of EN length, appropriate for technical detail)

### ❌ Weaknesses

1. **FAQ answer depth inconsistent** — answers range from 4 chars (faq.a1/a4 placeholders) to proper translations (faq.a2: 128 chars for 313 EN)
2. **No systematic quality gate** — some answers fully translated, others appear truncated mid-project
3. **Stealth title missing line break** — HTML formatting incomplete
4. **Missing context in some answers** — e.g., faq.a8 omits clarification on which permissions are safe

---

## Root Cause Analysis

**Most likely scenario:** ZH translation was:
1. Started with proper translation (stealth section, install guide keys all good)
2. FAQ answers started full (faq.a2–a9) but later shortened for budget/deadline reasons
3. faq.a1 and faq.a4 never completed — left as placeholder "永远免费" (most frequent answer theme)
4. Not reviewed/validated before deployment

---

## Recommendations

### Priority 1 (Blocking)

- [ ] **Replace `faq.a1` with full translation** of "Is AdOff really free? Are there hidden costs?" answer
  - Must include: free forever, no credit card, 15-day trial details, code inspection availability
  
- [ ] **Replace `faq.a4` with full translation** of "Lifetime license — how does it work?" answer
  - Must include: pay once, lifetime access, updates included, account binding, device tier details

- [ ] **Add `<br>` to `sl.stealth.title`**: change `"其他拦截器被发现。AdOff <em>不会</em>。"` to `"其他拦截器被发现。<br>AdOff <em>不会</em>。"`

### Priority 2 (Quality)

- [ ] **Review all `faq.a*` answers** and restore omitted context where it affects understanding
  - Especially faq.a5 (privacy guarantees), faq.a8 (security/permissions), faq.a9 (coverage)
  - Use source English as reference; aim for 70-85% of EN length for answers (not 36-48%)

- [ ] **Validate all translations in Chinese** with native speaker — check for:
  - Ambiguities or colloquialisms that might confuse users
  - Technical terms appropriately localized (e.g., "网络" for network OK, but verify consistency with other browser locales)
  - Tone alignment with brand voice (energetic, clear, not overly formal)

### Priority 3 (Process)

- [ ] **Add QA gate for i18n PRs:**
  - Minimum answer length: ≥50% of English equivalent (except questions, which can be 30-50%)
  - All HTML tags must match source exactly
  - No placeholders ("永远免费" as answer content)
  - Native speaker review before merge

---

## Severity Matrix

| Category | Count | Severity | Impact |
|---|---|---|---|
| HTML formatting bugs | 1 | 🔴 Critical | Rendering issue visible to all ZH users |
| Placeholder content | 2 | 🔴 Critical | Trust loss on key FAQ topics (licensing, cost) |
| Extreme compression | 25 | 🟠 High | Incomplete explanations; support volume risk |
| Questions too short | 7 | 🟡 Low | Expected for Chinese; no information loss |

---

## Comparison with Other Languages

Quick check on EN, IT, DE for same keys shows they maintain 85-100% of content (no placeholders, no extreme compression). **ZH is outlier.**

---

## Files to Update

```
site/i18n/zh.json
  - faq.a1 (currently: "永远免费" → full translation)
  - faq.a4 (currently: "永远免费" → full translation)
  - sl.stealth.title (add <br> before "AdOff")
  - faq.a2–a9, sl.faq.a6 (review + restore context as needed)
```

---

## Deployment Gate

Do **not** deploy next ZH language update (or any i18n change) without addressing Priority 1 issues.

---

**Report prepared:** 2026-05-20 14:32 UTC  
**Next action:** Create GitHub issue / task for ZH FAQ translation completion + QA process review
