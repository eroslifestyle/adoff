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

const t = "AdOff works great on YouTube videos, Facebook feed, Instagram, Reddit threads, Twitch streams, TikTok and even Google search. Metadata is fine. #YouTube";
const o = brandSanitize(t);
console.log("IN :", t);
console.log("OUT:", o);
console.log("LEAK:", /\b(you ?tube|google|facebook|instagram|tiktok|twitch|reddit|twitter|linkedin|amazon|github)\b/i.test(o));
