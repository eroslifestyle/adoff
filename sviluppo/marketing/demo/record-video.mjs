import { chromium } from 'playwright';
import fs from 'fs';
const APP='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/app';
const EXE='/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const URL='http://127.0.0.1:8901/video-page.html';
const VID='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/demo/video';
const W=720,H=1280;
const ctx=await chromium.launchPersistentContext('/tmp/pw-recv-'+Date.now(),{headless:false,executablePath:EXE,viewport:{width:W,height:H},recordVideo:{dir:VID,size:{width:W,height:H}},args:[`--disable-extensions-except=${APP}`,`--load-extension=${APP}`,'--no-first-run']});
await new Promise(r=>setTimeout(r,2500));
const page=await ctx.newPage();
await page.goto(URL,{waitUntil:'load'}).catch(()=>{});
// overlay hook
await page.evaluate(()=>{
  const top=document.createElement('div');top.id='hk';
  top.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(180deg,#0a0a1aee,#0a0a1a00);padding:18px 16px 30px;color:#fff;font-family:Arial;font-weight:800;font-size:27px;text-align:center;text-shadow:0 2px 12px #000';
  top.textContent='Due pubblicità prima di ogni video…';
  const bot=document.createElement('div');bot.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#0a0a1a;color:#fff;font-family:Arial;font-weight:700;font-size:24px;text-align:center;padding:16px';bot.innerHTML='<span style="color:#b8a9ff">●</span> adoff.app';
  document.body.appendChild(top);document.body.appendChild(bot);
});
await new Promise(r=>setTimeout(r,3000)); // mostra il pre-roll che blocca
// MAGIA: AdOff neutralizza il pre-roll
await page.addStyleTag({content:'.video-ads{transition:opacity .4s ease !important;opacity:0 !important;} .ad-banner{transition:opacity .4s !important;opacity:0 !important;}'});
await new Promise(r=>setTimeout(r,450));
await page.addStyleTag({path:APP+'/src/ads-hide.css'});
await page.evaluate(()=>{
  const ad=document.getElementById('ad');if(ad)ad.style.display='none';
  document.getElementById('hk').textContent='Premi play. Parte e basta.';
  const p=document.getElementById('prog');if(p){p.style.width='100%';}
  const b=document.createElement('div');b.textContent='✓ Video senza pubblicità';b.style.cssText='position:fixed;top:84px;left:50%;transform:translateX(-50%);z-index:99999;background:#4ade80;color:#0a0a1a;font-family:Arial;font-weight:800;font-size:21px;padding:10px 18px;border-radius:30px;box-shadow:0 6px 24px #0008';document.body.appendChild(b);
});
await new Promise(r=>setTimeout(r,3000));
await ctx.close();
const files=fs.readdirSync(VID).filter(f=>f.endsWith('.webm')).map(f=>VID+'/'+f);
const latest=files.sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
fs.renameSync(latest,VID+'/video-raw.webm');
console.log('OK',VID+'/video-raw.webm');
