import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// Dettaglio contrast homepage: raggruppa per coppia colori
await page.goto('https://adoff.app/', { waitUntil: 'networkidle', timeout: 30000 });
await page.addScriptTag({ content: axeSrc });
const res = await page.evaluate(async () => await axe.run(document, { runOnly: ['color-contrast'] }));
const groups = {};
for (const v of res.violations) for (const node of v.nodes) {
  const d = node.any[0]?.data || {};
  const key = `${d.fgColor} su ${d.bgColor} (ratio ${d.contrastRatio}, ${d.fontSize}/${d.fontWeight})`;
  (groups[key] ??= []).push(node.target[0].slice(0, 60));
}
for (const [k, v] of Object.entries(groups)) console.log(`\n${v.length}x  ${k}\n   es: ${v.slice(0,3).join(' | ')}`);
// /support con domcontentloaded
const p2 = await browser.newPage();
await p2.goto('https://adoff.app/support', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p2.waitForTimeout(3000);
await p2.addScriptTag({ content: axeSrc });
const r2 = await p2.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } }));
console.log('\n== /support:', JSON.stringify(r2.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.[0]?.slice(0,70) }))));
await browser.close();
