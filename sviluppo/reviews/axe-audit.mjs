import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const axeSrc = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
const PAGES = ['/', '/install', '/support', '/privacy', '/en/', '/uninstall'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const summary = {};
for (const path of PAGES) {
  try {
    await page.goto('https://adoff.app' + path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () =>
      await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
    );
    summary[path] = res.violations.map(v => ({
      id: v.id, impact: v.impact, n: v.nodes.length,
      sample: v.nodes[0]?.target?.[0]?.slice(0, 80) || ''
    }));
  } catch (e) { summary[path] = [{ id: 'ERROR', sample: String(e).slice(0, 100) }]; }
}
await browser.close();
console.log(JSON.stringify(summary, null, 1));
