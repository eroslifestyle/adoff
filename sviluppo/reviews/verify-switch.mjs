import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
// switch reale via UI: /it/accessibility -> dropdown -> Deutsch
await page.goto('https://adoff.app/it/accessibility', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('#site-nav .sn-lang-btn');
await page.waitForTimeout(300);
await page.click('#site-nav .sn-lang-dd button:has-text("Deutsch")');
await page.waitForLoadState('domcontentloaded');
console.log('switch it->de:', page.url());
const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent);
console.log('h1:', h1);
// e ritorno a English
await page.waitForTimeout(1000);
await page.click('#site-nav .sn-lang-btn');
await page.waitForTimeout(300);
await page.click('#site-nav .sn-lang-dd button:has-text("English")');
await page.waitForLoadState('domcontentloaded');
console.log('switch de->en:', page.url());
// axe su de + ar
for (const path of ['/de/accessibility', '/ar/accessibility']) {
  await page.goto('https://adoff.app' + path, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.addScriptTag({ content: axeSrc });
  const res = await page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } }));
  console.log('axe', path, res.violations.length ? res.violations.map(v=>`${v.id}(${v.nodes.length})`).join(',') : 'CLEAN');
}
// footer link da homepage tedesca
await page.goto('https://adoff.app/de/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
const fl = await page.evaluate(() => document.querySelector('.footer__bottom-links a[href*="accessibility"]')?.getAttribute('href'));
console.log('footer link su /de/:', fl);
await browser.close();
