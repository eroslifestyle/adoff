const b = $('Build Copy Agent prompt').first().json;
const raw = $input.first().json.response || '';

function brandSanitize(s) {
  if (!s || typeof s !== 'string') return s;
  const MAP = [
    ['You ?Tube', 'video platforms'],
    ['Google', 'search engines'],
    ['Facebook', 'social media'],
    ['Instagram', 'social media'],
    ['TikTok', 'social media'],
    ['Twitch', 'live streaming platforms'],
    ['Reddit', 'forums'],
    ['Twitter', 'social media'],
    ['LinkedIn', 'professional networks'],
    ['Amazon', 'e-commerce sites'],
    ['GitHub', 'code platforms'],
    ['Meta', 'social media']
  ];
  let out = s;
  for (let i = 0; i < MAP.length; i++) {
    const re = new RegExp('\\b' + MAP[i][0] + '\\b', 'gi');
    out = out.replace(re, MAP[i][1]);
  }
  return out.replace(/[ \t]{2,}/g, ' ');
}

let cleaned = raw
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/^```(?:json|markdown)?\s*/i, '')
  .replace(/\s*```\s*$/i, '')
  .replace(/^(Problem|Agitate|Solution|Attention|Interest|Desire|Action|Hook|Story|Offer|Feature|Advantage|Benefit)\s*:\s*/gim, '')
  .trim();

let output = { copy: cleaned, variants: null };

if (b.variants > 1) {
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.variants) output = { copy: parsed.variants[0].text, variants: parsed.variants };
  } catch (e) { output = { copy: cleaned, variants: null, parse_error: e.message }; }
}

output.copy = brandSanitize(output.copy);
if (Array.isArray(output.variants)) {
  output.variants = output.variants.map(function (v) {
    return Object.assign({}, v, { text: brandSanitize(v.text) });
  });
}

const limit = b.platform_rules.max_chars;
if (output.copy.length > limit) {
  let t = output.copy.slice(0, limit);
  const lastDot = Math.max(t.lastIndexOf('. '), t.lastIndexOf('! '), t.lastIndexOf('? '), t.lastIndexOf('\n'));
  if (lastDot > limit * 0.5) t = t.slice(0, lastDot + 1);
  output.copy = t.trim();
  output.truncated = true;
}

const banned = ['100% ad-free', 'guarantee', 'best in the world', 'kill ads'];
const lower = output.copy.toLowerCase();
const violations = banned.filter(p => lower.includes(p.toLowerCase()));

const brandRe = /\b(you ?tube|google|facebook|instagram|tiktok|twitch|reddit|twitter|linkedin|amazon|github)\b/i;
const brand_leak = brandRe.test(output.copy);

// Empty-generation guard: copy-max timed out / returned nothing.
// Flag so the dispatcher skips this item instead of posting blank.
const generation_failed = output.copy.trim().length < 12;

return [{ json: {
  brief: { platform: b.platform, persona: b.persona, framework: b.framework, language: b.language },
  output,
  compliance: {
    banned_phrases_found: violations,
    brand_leak: brand_leak,
    generation_failed: generation_failed,
    char_count: output.copy.length,
    char_limit: limit,
    within_limit: output.copy.length <= limit,
    truncated: output.truncated || false
  },
  generated_at: new Date().toISOString()
} }];
