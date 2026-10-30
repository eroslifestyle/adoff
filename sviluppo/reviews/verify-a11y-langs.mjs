import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const LANGS = ['en','it','de','fr','es','pt','ru','ar','zh','hi','ja','ko','tr','id','pl'];
const browser = await chromium.launch();
const page = await browser.newPage();
// 1) tutte le 15 versioni: status + lang attr
for (const l of LANGS) {
  const url = l === 'en' ? 'https://adoff.app/accessibility' : `https://adoff.app/${l}/accessibility`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const lang = await page.evaluate(() => document.documentElement.lang);
  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent.slice(0,30));
  console.log(`${l}: ${resp.status()} lang=${lang} h1="${h1}"`);
}
// 2) switch lingua: da /it/accessibility chiama switchLang('de')
await page.goto('https://adoff.app/it/accessibility', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.evaluate(() => switchLang('de'));
await page.waitForLoadState('domcontentloaded');
console.log('switch it->de:', page.url());
// 3) axe su de + ar
for (const path of ['/de/accessibility', '/ar/accessibility']) {
  await page.goto('https://adoff.app' + path, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.addScriptTag({ content: axeSrc });
  const res = await page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } }));
  console.log('axe', path, res.violations.length ? res.violations.map(v=>v.id).join(',') : 'CLEAN');
}
await browser.close();
