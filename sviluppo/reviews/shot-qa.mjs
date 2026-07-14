import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('site');
const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';let fp=path.join(ROOT,p);if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.statusCode=404;return res.end();}res.setHeader('Content-Type',MIME[path.extname(fp)]||'application/octet-stream');fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(8127,r));
const b=await chromium.launch({executablePath:process.env.PW_CHROME,args:['--no-sandbox','--disable-gpu']});
const pages = process.argv.slice(2);
for (const url of pages) {
  const name = url.replace(/[\/.]/g,'_');
  const ctx=await b.newContext({viewport:{width:1280,height:850}});
  const page=await ctx.newPage();
  await page.goto('http://localhost:8127'+url,{waitUntil:'networkidle',timeout:20000}).catch(e=>console.log('err',url,e.message));
  await page.waitForTimeout(500);
  await page.screenshot({path:`sviluppo/reviews/shots/qa${name}.png`,fullPage:false});
  await ctx.close();
  console.log('shot',url);
}
await b.close();server.close();console.log('DONE');
