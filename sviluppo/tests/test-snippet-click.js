const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SNIPPET = fs.readFileSync(
  path.resolve(__dirname, 'snippet-diagnosi-click-player.js'),
  'utf-8'
);

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await context.newPage();

  const logs = [];
  page.on('pageerror', e => console.error('[pageerror]', String(e).slice(0, 300)));
  page.on('console', m => {
    console.log('[pagina]', m.text());
    logs.push(m.text());
  });

  const html = `<!DOCTYPE html>
<html>
<head><title>Test Click-Hijacking Player</title></head>
<body style="margin:0;padding:0">
<video id="v" width="640" height="360" muted></video>
<a id="overlay" href="https://esempio-pubblicita.xyz/promo" target="_blank"
   style="position:absolute;left:0;top:0;width:640px;height:360px;opacity:0;
          z-index:99;display:block;cursor:pointer"></a>
<script>
(function(){
  var started = false;
  document.getElementById('overlay').addEventListener('click', function(ev){
    ev.preventDefault();
    this.remove();
  });
  var v = document.getElementById('v');
  Object.defineProperty(v, 'paused', {
    get: function(){ return !started; },
    configurable: true
  });
  v.addEventListener('click', function(){
    if(!started){
      started = true;
      this.play && this.play();
    }
  });
})();
</script>
</body>
</html>`;

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
  } catch (e) {
    console.error('[setup] errore setContent:', e.message);
    await browser.close();
    return;
  }

  try {
    await page.addScriptTag({ content: SNIPPET });
    console.log('[test] snippet iniettato senza errori');
  } catch (e) {
    console.error('[test] errore iniezione snippet:', e.message);
    await browser.close();
    return;
  }

  const videoBox = await page.$('#v');
  if (!videoBox) {
    console.error('[test] impossibile trovare #v');
    await browser.close();
    return;
  }

  const bbox = await videoBox.boundingBox();
  if (!bbox) {
    console.error('[test] impossibile ottenere boundingBox del video');
    await browser.close();
    return;
  }

  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  console.log(`[test] click 1 al centro video (${cx}, ${cy})`);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(1200);

  console.log(`[test] click 2 al centro video (${cx}, ${cy})`);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(1200);

  let res;
  try {
    res = await page.evaluate(() =>
      typeof window.adoffPlayReport === 'function'
        ? window.adoffPlayReport()
        : null
    );
  } catch (e) {
    console.error('[test] errore valutazione adoffPlayReport:', e.message);
    res = null;
  }

  console.log('\n=== ESITO ===');
  if (
    Array.isArray(res) &&
    res.length >= 2 &&
    res[0].coversVideo === true &&
    res[0].hit &&
    res[0].hit.includes('overlay')
  ) {
    console.log('PASS');
  } else {
    console.log('FAIL');
    console.log('Dettaglio res:', JSON.stringify(res, null, 2));
  }

  if (Array.isArray(res)) {
    console.log('\n=== DETTAGLIO REPORT ===');
    res.forEach((elem, i) => {
      console.log(`Elemento ${i}:`);
      console.log(`  n:       ${elem.n}`);
      console.log(`  hit:     ${elem.hit}`);
      console.log(`  coversVideo: ${elem.coversVideo}`);
      console.log(`  partito: ${elem.partito}`);
    });
  }

  await browser.close();
})();
