import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('site');
const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';let fp=path.join(ROOT,p);if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.statusCode=404;return res.end();}res.setHeader('Content-Type',MIME[path.extname(fp)]||'application/octet-stream');fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(8130,r));
const b=await chromium.launch({executablePath:process.env.PW_CHROME,args:['--no-sandbox','--disable-gpu']});
const urls = ['/pricing.html','/premium.html','/vs/ublock-origin.html','/best-ad-blocker-2026.html','/how-it-works.html','/community.html','/terms.html','/press.html'];
for (const url of urls) {
  for (const theme of ['light','dark']) {
    const name = 'b_'+url.replace(/[\/.]/g,'_')+'_'+theme;
    const ctx=await b.newContext({viewport:{width:1280,height:780}});
    const page=await ctx.newPage();
    await page.addInitScript(t=>{try{localStorage.setItem('adoff_theme',t);}catch(e){}}, theme);
    await page.goto('http://localhost:8130'+url,{waitUntil:'networkidle',timeout:20000}).catch(e=>console.log('err',url,e.message));
    await page.waitForTimeout(400);
    await page.screenshot({path:`sviluppo/reviews/shots/${name}.png`,fullPage:false});
    await ctx.close();
  }
  console.log('shot',url);
}
await b.close();server.close();console.log('DONE');
