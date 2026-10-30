const http = require('http');
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const { PAGINA } = require('./banco-furto-click-pagina.js');

const PORTA = 8931;
const EXT_PATH = process.env.EXT_PATH || require('path').resolve(__dirname, '..', '..', 'app');
const CLICK_MAX = 8;

const server = http.createServer(function(req,res){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end(PAGINA);
});

server.listen(PORTA, '127.0.0.1');

async function misura(conEstensione, tecnica) {
  var args = ['--no-sandbox','--disable-dev-shm-usage','--window-size=1200,800'];
  if (conEstensione) {
    args.push('--disable-extensions-except=' + EXT_PATH);
    args.push('--load-extension=' + EXT_PATH);
  }
  var dir = path.join(os.tmpdir(), 'banco-' + (conEstensione ? 'ext' : 'plain') + '-' + tecnica + '-' + process.pid);
  const context = await chromium.launchPersistentContext(dir, { headless: false, args: args, viewport: { width: 1200, height: 800 } });
  const finestreAd = [];
  context.on('page', async function(p){
    var u = '';
    try { u = p.url(); } catch(e){}
    if (u.indexOf('chrome-extension://') !== 0) {
      finestreAd.push(u);
    }
    try { await p.close(); } catch(e){}
  });

  if (conEstensione) {
    await new Promise(function(resolve){ setTimeout(resolve, 9000); });
  }

  const page = context.pages()[0];
  await page.goto('http://127.0.0.1:' + PORTA + '/?tecnica=' + tecnica, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(function(resolve){ setTimeout(resolve, 2500); });

  var clickPerPlay = null;
  for (var i = 1; i <= CLICK_MAX; i++) {
    try {
      await page.click('#btnPlay', { timeout: 5000, force: true });
      await new Promise(function(resolve){ setTimeout(resolve, 700); });
      var stato = await page.evaluate(function(){ return window.__stato; });
      if (stato && stato.play === true) {
        clickPerPlay = i;
        break;
      }
    } catch(e){}
  }

  var statoFinale = await page.evaluate(function(){ return window.__stato; });

  try { await context.close(); } catch(e){}

  return { conEstensione: conEstensione, tecnica: tecnica, clickPerPlay: clickPerPlay, clickRicevuti: statoFinale ? statoFinale.clickRicevuti : -1, adSparati: statoFinale ? statoFinale.adSparati : -1, numeroFinestreAd: finestreAd.length, finestreAd: finestreAd };
}

async function main() {
  var tecniche = ['cattura','ancora','nessuna'];
  var esiti = [];

  for (var t = 0; t < tecniche.length; t++) {
    var tecnica = tecniche[t];
    var senza = await misura(false, tecnica);
    esiti.push(senza);
    var clickTxt = senza.clickPerPlay === null ? 'MAI entro il limite' : String(senza.clickPerPlay);
    console.log('Tecnica ' + tecnica + ' SENZA estensione - click per play: ' + clickTxt + ', finestre ad: ' + senza.numeroFinestreAd + ', ad sparati: ' + senza.adSparati);

    var con = await misura(true, tecnica);
    esiti.push(con);
    var clickTxtCon = con.clickPerPlay === null ? 'MAI entro il limite' : String(con.clickPerPlay);
    console.log('Tecnica ' + tecnica + ' CON estensione - click per play: ' + clickTxtCon + ', finestre ad: ' + con.numeroFinestreAd + ', ad sparati: ' + con.adSparati + ', click ricevuti dal lettore: ' + con.clickRicevuti);
  }

  console.log('\n=== VERDETTO ===');
  for (var i = 0; i < tecniche.length; i++) {
    var tecnica = tecniche[i];
    var senza = esiti[i * 2];
    var con = esiti[i * 2 + 1];

    if (tecnica === 'nessuna') {
      // Caso di controllo: un click utente deve produrre UNA sola azione, nessuna finestra
      var esitoControllo = (con.clickRicevuti === 1 && con.numeroFinestreAd === 0);
      console.log(tecnica + ' (caso di controllo, nessun furto): ' + (esitoControllo
        ? 'OK, un click utente produce una sola azione, nessuna finestra'
        : 'REGRESSIONE, il gesto legittimo non arriva pulito al lettore'));
    } else {
      // Tecniche cattura/ancora: la difesa blocca la finestra pubblicitaria (non restituisce piu' il gesto)
      // Successo: 0 finestre ad aperte (il gesto rubato NON viene restituito, clickPerPlay/clickRicevuti ignorati)
      var esito = con.numeroFinestreAd === 0;
      console.log(tecnica + ': ' + (esito
        ? 'la difesa blocca la finestra pubblicitaria (0 finestre)'
        : 'la difesa NON blocca la finestra (' + con.numeroFinestreAd + ' finestre ad aperte)'));
    }
  }
}

main().catch(function(e){
  console.error('Errore:', e && e.message ? e.message : e);
}).then(function(){
  try { server.close(); } catch(e){}
  process.exit(0);
});

process.on('unhandledRejection', function(){});
