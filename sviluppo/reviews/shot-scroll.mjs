import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('site');
const MIME = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2' };
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html'; let fp=path.join(ROOT,p); if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.statusCode=404;return res.end();} res.setHeader('Content-Type',MIME[path.extname(fp)]||'application/octet-stream'); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(8124,r));
const b = await chromium.launch({ executablePath: process.env.PW_CHROME, args:['--no-sandbox','--disable-gpu'] });
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
await page.goto('http://localhost:8124/index.html', { waitUntil:'networkidle', timeout:20000 });
// Scrolla tutta la pagina per triggerare gli IntersectionObserver
await page.evaluate(async () => {
  await new Promise(res => {
    let y=0; const step=()=>{ window.scrollTo(0,y); y+=600; if(y<document.body.scrollHeight){ setTimeout(step,60); } else { window.scrollTo(0,0); setTimeout(res,400);} }; step();
  });
});
await page.waitForTimeout(600);
await page.screenshot({ path:'sviluppo/reviews/shots/home-scrolled.png', fullPage:true });
// conta reveal non visibili
const notVisible = await page.evaluate(()=> [...document.querySelectorAll('.reveal')].filter(e=>!e.classList.contains('is-visible')).length);
console.log('reveal senza is-visible dopo scroll:', notVisible);
await b.close(); server.close(); console.log('DONE');
