import { chromium } from 'playwright';
const APP='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/app';
const EXE='/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const OUT='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/demo/out';
const W=720,H=1280;
function overlay(hookTop, after){
  return (args)=>{ const [hk, isAfter]=args;
    const t=document.createElement('div');t.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(180deg,#0a0a1af2,#0a0a1a00);padding:20px 16px 34px;color:#fff;font-family:Arial;font-weight:800;font-size:28px;text-align:center;text-shadow:0 2px 12px #000';t.textContent=hk;
    const b=document.createElement('div');b.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#0a0a1a;color:#fff;font-family:Arial;font-weight:700;font-size:23px;text-align:center;padding:15px';b.innerHTML='<span style="color:#b8a9ff">●</span> adoff.app';
    document.body.appendChild(t);document.body.appendChild(b);
    if(isAfter){const g=document.createElement('div');g.textContent='✓ Pubblicità bloccate';g.style.cssText='position:fixed;top:86px;left:50%;transform:translateX(-50%);z-index:99999;background:#4ade80;color:#0a0a1a;font-family:Arial;font-weight:800;font-size:20px;padding:9px 18px;border-radius:30px;box-shadow:0 6px 24px #0008';document.body.appendChild(g);}
  };
}
async function cap(page,file){ await page.screenshot({path:file}); }
async function run(url, slug, hookBefore, hookAfter, isVideo){
  const ctx=await chromium.launchPersistentContext('/tmp/pw-s-'+Date.now(),{headless:false,executablePath:EXE,viewport:{width:W,height:H},deviceScaleFactor:2,args:[`--disable-extensions-except=${APP}`,`--load-extension=${APP}`,'--no-first-run']});
  await new Promise(r=>setTimeout(r,2500));
  const page=await ctx.newPage();
  await page.goto(url,{waitUntil:'load'}).catch(()=>{});
  await new Promise(r=>setTimeout(r, isVideo?2500:1500));
  await page.evaluate(overlay(), [hookBefore,false]);
  await cap(page, `${OUT}/${slug}_before.png`);
  // after: rimuovi ad
  if(isVideo){ await page.evaluate(()=>{const a=document.getElementById('ad');if(a)a.style.display='none';const p=document.getElementById('prog');if(p)p.style.width='100%';}); }
  await page.addStyleTag({path:APP+'/src/ads-hide.css'});
  await page.addStyleTag({content:'.cookie,.video-ads,.ad-banner{display:none !important}'});
  // togli overlay before, metti after
  await page.evaluate(()=>{document.querySelectorAll('body>div[style*="z-index: 99999"]').forEach(e=>e.remove());});
  await page.evaluate(overlay(), [hookAfter,true]);
  await new Promise(r=>setTimeout(r,500));
  await cap(page, `${OUT}/${slug}_after.png`);
  await ctx.close();
  console.log('done',slug);
}
await run('http://127.0.0.1:8901/recipe-page.html','recipe','Volevi solo la ricetta.','Solo la ricetta. Zero pubblicità.',false);
await run('http://127.0.0.1:8901/video-page.html','video','Due pubblicità prima di ogni video…','Premi play. Parte e basta.',true);
console.log('ALL DONE');
