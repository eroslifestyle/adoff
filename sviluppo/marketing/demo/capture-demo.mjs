import { chromium } from 'playwright';
const APP='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/app';
const EXE='/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const URL='http://127.0.0.1:8901/recipe-page.html';
const OUT='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/demo';
async function shot(useExt,file){
  const args=['--no-first-run','--no-default-browser-check'];
  if(useExt) args.push(`--disable-extensions-except=${APP}`,`--load-extension=${APP}`);
  const ctx=await chromium.launchPersistentContext('/tmp/pw-'+(useExt?'e':'p')+'-'+Date.now(),{headless:false,executablePath:EXE,viewport:{width:430,height:932},deviceScaleFactor:2,args});
  if(useExt) await new Promise(r=>setTimeout(r,2500));
  const page=await ctx.newPage();
  await page.goto(URL,{waitUntil:'load'}).catch(()=>{});
  if(useExt){ await new Promise(r=>setTimeout(r,3500)); await page.addStyleTag({path:APP+'/src/ads-hide.css'}).catch(()=>{}); await new Promise(r=>setTimeout(r,600)); }
  else await new Promise(r=>setTimeout(r,1000));
  await page.screenshot({path:file});
  await ctx.close(); console.log('saved',file);
}
await shot(false,OUT+'/before.png');
await shot(true,OUT+'/after.png');
console.log('DONE');
