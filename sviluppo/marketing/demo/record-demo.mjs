import { chromium } from 'playwright';
import fs from 'fs';
const APP='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/app';
const EXE='/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const URL='http://127.0.0.1:8901/recipe-page.html';
const VID='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/demo/video';
const HOOK=process.env.HOOK||'Volevi solo la ricetta.';
const W=720,H=1280;
const ctx=await chromium.launchPersistentContext('/tmp/pw-rec-'+Date.now(),{
  headless:false, executablePath:EXE, viewport:{width:W,height:H},
  recordVideo:{dir:VID,size:{width:W,height:H}},
  args:[`--disable-extensions-except=${APP}`,`--load-extension=${APP}`,'--no-first-run']});
await new Promise(r=>setTimeout(r,2500));
const page=await ctx.newPage();
await page.goto(URL,{waitUntil:'load'}).catch(()=>{});
// overlay brand (hook alto + adoff.app basso)
await page.evaluate((hook)=>{
  const top=document.createElement('div');
  top.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(180deg,#0a0a1aee,#0a0a1a00);padding:22px 18px 34px;color:#fff;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:30px;text-align:center;text-shadow:0 2px 12px #000';
  top.textContent=hook;
  const bot=document.createElement('div');
  bot.id='adoffbar';
  bot.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#0a0a1a;color:#fff;font-family:Arial;font-weight:700;font-size:24px;text-align:center;padding:16px;letter-spacing:.5px;transition:opacity .3s';
  bot.innerHTML='<span style="color:#b8a9ff">●</span> adoff.app';
  document.body.appendChild(top); document.body.appendChild(bot);
},HOOK);
await new Promise(r=>setTimeout(r,2300));
// FASE MAGIA: fade + collapse degli ad
await page.addStyleTag({content:`.ad-banner,.ad-container,.ad-wrapper,.sponsored-content,ins.adsbygoogle,.taboola,.native-ad,.promoted-content,.cookie{transition:opacity .45s ease, transform .45s ease !important;opacity:0 !important;transform:scale(.95) !important;}`});
await new Promise(r=>setTimeout(r,500));
await page.addStyleTag({path:APP+'/src/ads-hide.css'});
await page.addStyleTag({content:`.cookie{display:none !important}`});
// badge ✓
await page.evaluate(()=>{const b=document.createElement('div');b.textContent='✓ Pubblicità bloccate';b.style.cssText='position:fixed;top:90px;left:50%;transform:translateX(-50%);z-index:99999;background:#4ade80;color:#0a0a1a;font-family:Arial;font-weight:800;font-size:22px;padding:10px 20px;border-radius:30px;box-shadow:0 6px 24px #0008;opacity:0;transition:opacity .4s';document.body.appendChild(b);requestAnimationFrame(()=>b.style.opacity='1');});
await new Promise(r=>setTimeout(r,3000));
await ctx.close();
// trova il webm
const files=fs.readdirSync(VID).filter(f=>f.endsWith('.webm')).map(f=>VID+'/'+f);
const latest=files.sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
fs.renameSync(latest, VID+'/recipe-raw.webm');
console.log('VIDEO:',VID+'/recipe-raw.webm');
