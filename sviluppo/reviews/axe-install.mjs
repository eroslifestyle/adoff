import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8901/install.html', { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.addScriptTag({ content: axeSrc });
const res = await page.evaluate(async () => await axe.run(document, { runOnly: ['color-contrast'] }));
for (const v of res.violations) for (const n of v.nodes) {
  const d = n.any[0]?.data || {};
  console.log(`${d.fgColor} su ${d.bgColor} ratio=${d.contrastRatio} ${d.fontSize} -> ${n.target[0].slice(0,70)}`);
}
await browser.close();
