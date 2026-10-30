import { chromium } from 'playwright';
const APP='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/app';
const EXE='/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const OUT='/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/demo/out';
const BASE='http://127.0.0.1:8901/';
const SCN=[
 {slug:'recipe',url:'recipe-page.html',hb:'Volevi solo la ricetta.',ha:'Solo la ricetta. Zero pubblicità.',type:'css'},
 {slug:'video', url:'video-page.html', hb:'Due pubblicità prima di ogni video…',ha:'Premi play. Parte e basta.',type:'video'},
 {slug:'wall',  url:'wall-page.html',  hb:'«Disattiva l’adblock per continuare.»',ha:'Con AdOff il muro non appare. Mai più.',type:'wall'},
];
function ov(a){const hk=a.hk,after=a.after,land=a.land;
  const fs=land?34:30,bs=land?26:24,bd=land?24:21,pad=land?'18px 24px 30px':'20px 16px 34px';
  const t=document.createElement('div');t.className='ovl';t.style.cssText=`position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(180deg,#0a0a1af2,#0a0a1a00);padding:${pad};color:#fff;font-family:Arial;font-weight:800;font-size:${fs}px;text-align:center;text-shadow:0 2px 12px #000`;t.textContent=hk;
  const b=document.createElement('div');b.className='ovl';b.style.cssText=`position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#0a0a1a;color:#fff;font-family:Arial;font-weight:700;font-size:${bs}px;text-align:center;padding:14px`;b.innerHTML='<span style="color:#b8a9ff">●</span> adoff.app';
  document.body.appendChild(t);document.body.appendChild(b);
  if(after){const g=document.createElement('div');g.className='ovl';g.textContent='✓ Bloccato da AdOff';g.style.cssText=`position:fixed;top:${land?70:86}px;left:50%;transform:translateX(-50%);z-index:99999;background:#4ade80;color:#0a0a1a;font-family:Arial;font-weight:800;font-size:${bd}px;padding:9px 18px;border-radius:30px;box-shadow:0 6px 24px #0008`;document.body.appendChild(g);}
}
async function ctxFor(land,ext){
  const vp=land?{width:1280,height:720}:{width:720,height:1280};
  const args=['--no-first-run']; if(ext)args.push(`--disable-extensions-except=${APP}`,`--load-extension=${APP}`);
  const c=await chromium.launchPersistentContext('/tmp/pw-'+(ext?'e':'p')+Date.now()+Math.floor(Math.random()*999),{headless:false,executablePath:EXE,viewport:vp,deviceScaleFactor:2,args});
  if(ext)await new Promise(r=>setTimeout(r,2200));
  return c;
}
for(const land of [false,true]){
  const tag=land?'L':'P';
  // BEFORE (no extension): problema visibile
  let ctx=await ctxFor(land,false);
  for(const sc of SCN){
    const p=await ctx.newPage(); await p.goto(BASE+sc.url,{waitUntil:'load'}).catch(()=>{});
    await new Promise(r=>setTimeout(r, sc.type==='video'?2200:1200));
    await p.evaluate(ov,{hk:sc.hb,after:false,land});
    await p.screenshot({path:`${OUT}/${sc.slug}_${tag}_before.png`}); await p.close();
  }
  await ctx.close();
  // AFTER (con AdOff)
  ctx=await ctxFor(land,true);
  for(const sc of SCN){
    const p=await ctx.newPage(); await p.goto(BASE+sc.url,{waitUntil:'load'}).catch(()=>{});
    await new Promise(r=>setTimeout(r, sc.type==='video'?2500:1800));
    if(sc.type==='video')await p.evaluate(()=>{const a=document.getElementById('ad');if(a)a.style.display='none';const pr=document.getElementById('prog');if(pr)pr.style.width='100%';});
    if(sc.type==='wall') await p.evaluate(()=>{const w=document.getElementById('wall');if(w)w.style.display='none';});
    await p.addStyleTag({path:APP+'/src/ads-hide.css'}).catch(()=>{});
    await p.addStyleTag({content:'.cookie,.video-ads,.ad-banner,.adblock-wall{display:none !important}'});
    await p.evaluate(ov,{hk:sc.ha,after:true,land});
    await new Promise(r=>setTimeout(r,500));
    await p.screenshot({path:`${OUT}/${sc.slug}_${tag}_after.png`}); await p.close();
  }
  await ctx.close();
  console.log('orient',tag,'done');
}
console.log('ALL');
