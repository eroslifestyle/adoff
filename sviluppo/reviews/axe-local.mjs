import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const PAGES = ['/', '/install.html', '/de/install.html', '/privacy.html', '/uninstall.html', '/accessibility.html', '/it/accessibility.html', '/en/index.html', '/support.html'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
for (const path of PAGES) {
  try {
    await page.goto('http://localhost:8901' + path, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () =>
      await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
    );
    const v = res.violations.map(x => `${x.id}(${x.impact},${x.nodes.length}: ${x.nodes[0]?.target?.[0]?.slice(0,50)})`).join(' | ') || 'CLEAN';
    console.log(path.padEnd(24), v);
  } catch (e) { console.log(path.padEnd(24), 'ERROR', String(e).slice(0, 80)); }
}
await browser.close();
