import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://localhost:9222');
const ctx = b.contexts()[0];
for (const p of ctx.pages()) { try { await p.close(); } catch {} }
const page = await ctx.newPage();
await page.goto('https://www.youtube.com/watch?v=U1mKZIxis6A', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await page.bringToFront();
console.log('aperto il video nella Chrome pilotata (display :0) — verifica a mano');
await b.close();
process.exit(0);
