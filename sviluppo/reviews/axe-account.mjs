import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://adoff.app/account', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1500);
await page.addScriptTag({ content: axeSrc });
const res = await page.evaluate(async () => await axe.run(document, { runOnly: ['color-contrast'] }));
for (const v of res.violations) for (const n of v.nodes) {
  const d = n.any[0]?.data || {};
  console.log(`${d.fgColor} su ${d.bgColor} r=${d.contrastRatio} ${d.fontSize} -> ${n.target[0].slice(0,80)}`);
}
await browser.close();
