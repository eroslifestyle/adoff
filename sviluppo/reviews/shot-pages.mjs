import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('site');
const MIME = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2' };
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';let fp=path.join(ROOT,p);if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.statusCode=404;return res.end();}res.setHeader('Content-Type',MIME[path.extname(fp)]||'application/octet-stream');fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(8126,r));
const b=await chromium.launch({executablePath:process.env.PW_CHROME,args:['--no-sandbox','--disable-gpu']});
async function shot(url,name){const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage();await page.goto('http://localhost:8126'+url,{waitUntil:'networkidle',timeout:20000}).catch(e=>console.log('goto err',name,e.message));await page.evaluate(async()=>{await new Promise(r=>{let y=0;const s=()=>{window.scrollTo(0,y);y+=700;if(y<document.body.scrollHeight){setTimeout(s,45);}else{window.scrollTo(0,0);setTimeout(r,300);}};s();});});await page.waitForTimeout(400);await page.screenshot({path:`sviluppo/reviews/shots/${name}.png`,fullPage:true});await ctx.close();console.log('shot',name);}
await shot('/pricing.html','pg-pricing');
await shot('/vs/ublock-origin.html','pg-vs-ubo');
await b.close();server.close();console.log('DONE');
