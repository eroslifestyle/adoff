import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const PAGES = ['/src/popup.html', '/src/options.html', '/src/onboarding.html'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 720 } });
for (const path of PAGES) {
  try {
    await page.goto('http://localhost:8902' + path, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () =>
      await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
    );
    console.log('\n==', path);
    for (const v of res.violations) {
      console.log(` ${v.id} (${v.impact}, ${v.nodes.length})`);
      for (const n of v.nodes.slice(0, 6)) {
        const d = n.any[0]?.data || {};
        const extra = d.contrastRatio ? ` ${d.fgColor} su ${d.bgColor} r=${d.contrastRatio} ${d.fontSize}` : '';
        console.log(`   ${n.target[0].slice(0, 60)}${extra}`);
      }
    }
    if (!res.violations.length) console.log(' CLEAN');
  } catch (e) { console.log(path, 'ERROR', String(e).slice(0, 80)); }
}
await browser.close();
