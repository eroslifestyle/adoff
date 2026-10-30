import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const PAGES = ['/account'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
for (const path of PAGES) {
  try {
    await page.goto('https://adoff.app' + path, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () =>
      await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
    );
    const v = res.violations.map(x => `${x.id}(${x.impact},${x.nodes.length})`).join(' | ') || 'CLEAN';
    console.log(path.padEnd(20), v);
  } catch (e) { console.log(path.padEnd(20), 'ERROR', String(e).slice(0, 70)); }
}
// footer link check
await page.goto('https://adoff.app/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
const a11yLink = await page.evaluate(() => {
  const a = document.querySelector('.footer__bottom-links a[href*="accessibility"]');
  return a ? a.textContent + ' -> ' + a.getAttribute('href') : 'MANCANTE';
});
console.log('footer link:', a11yLink);
await browser.close();
