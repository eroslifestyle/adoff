import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('site');
const MIME = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2' };
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html'; let fp=path.join(ROOT,p); if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.statusCode=404;return res.end();} res.setHeader('Content-Type',MIME[path.extname(fp)]||'application/octet-stream'); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(8125,r));
const b = await chromium.launch({ executablePath: process.env.PW_CHROME, args:['--no-sandbox','--disable-gpu'] });
async function shot(name, vp, theme){
  const ctx = await b.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(t=>{ try{ localStorage.setItem('adoff_theme',t);}catch(e){} }, theme);
  await page.goto('http://localhost:8125/index.html',{waitUntil:'networkidle',timeout:20000});
  await page.evaluate(async()=>{ await new Promise(res=>{ let y=0; const s=()=>{ window.scrollTo(0,y); y+=600; if(y<document.body.scrollHeight){setTimeout(s,50);}else{window.scrollTo(0,0);setTimeout(res,400);} }; s(); }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path:`sviluppo/reviews/shots/${name}.png`, fullPage:true });
  await ctx.close(); console.log('shot',name);
}
await shot('v-dark-desktop', {width:1280,height:900}, 'dark');
await shot('v-light-mobile', {width:390,height:844}, 'light');
await b.close(); server.close(); console.log('DONE');
