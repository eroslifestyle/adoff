module.exports = { PAGINA_MANUALE: `<!DOCTYPE html>
<html lang='it'>
<head>
<meta charset='utf-8'>
<title>Prova AdOff - furto del clic</title>
<style>
body{background:#101018;color:#e8e8f0;font-family:sans-serif;padding:24px}
#lettore{width:640px;height:300px;background:#202030;position:relative}
button{width:130px;height:44px;font-size:16px;margin:12px}
#pannello{border:2px solid #7252f8;border-radius:10px;padding:16px;margin-top:20px;font-family:monospace;font-size:15px}
</style>
</head>
<body>
<h2 id='titolo'></h2>
<div id='lettore'>
<button id='btnPlay'>Play</button>
<button id='btnPausa'>Pausa</button>
<button id='btnVolume'>Volume</button>
</div>
<div id='pannello'>
<div><span class='lbl'>Clic fisici che hai fatto</span>: <span id='valClicFisici'>0</span></div>
<div><span class='lbl'>Comandi arrivati al lettore</span>: <span id='valComandi'>0</span></div>
<div><span class='lbl'>Stato del lettore</span>: <span id='valStato'>fermo</span></div>
<div><span class='lbl'>Volume</span>: <span id='valVolume'>1</span></div>
<div><span class='lbl'>Finestre pubblicitarie tentate</span>: <span id='valTentate'>0</span></div>
<div><span class='lbl'>Esito</span>: <span id='valEsito'>clicca Play per provare</span></div>
</div>
<script>
window.__stato={play:false,pausa:false,volume:1,clickRicevuti:0,adSparati:0,clicFisici:0};

window.addEventListener('click',function(e){
if(e.isTrusted){
window.__stato.clicFisici++;
}
},{capture:true,passive:true});

document.getElementById('btnPlay').addEventListener('click',function(){
window.__stato.clickRicevuti++;
window.__stato.play=true;
window.__stato.pausa=false;
});

document.getElementById('btnPausa').addEventListener('click',function(){
window.__stato.clickRicevuti++;
window.__stato.pausa=true;
window.__stato.play=false;
});

document.getElementById('btnVolume').addEventListener('click',function(){
window.__stato.clickRicevuti++;
window.__stato.volume=0.5;
});

function aggiorna(){
var s=window.__stato;
document.getElementById('valClicFisici').textContent=s.clicFisici;
document.getElementById('valComandi').textContent=s.clickRicevuti;
document.getElementById('valStato').textContent=s.play?'IN RIPRODUZIONE':'fermo';
document.getElementById('valVolume').textContent=s.volume;
document.getElementById('valTentate').textContent=s.adSparati;
var esitoEl=document.getElementById('valEsito');
if(s.clicFisici===0){
esitoEl.textContent='clicca Play per provare';
esitoEl.style.color='#e8e8f0';
}else if(s.clickRicevuti===s.clicFisici){
esitoEl.textContent='OK - ogni clic arriva al lettore';
esitoEl.style.color='#4ade80';
}else{
esitoEl.textContent='CLIC RUBATI: ne hai fatti '+s.clicFisici+' ma ne sono arrivati '+s.clickRicevuti;
esitoEl.style.color='#ff6b6b';
}
}

setInterval(aggiorna,200);

var tecnica=new URLSearchParams(location.search).get('tecnica')||'cattura';
document.getElementById('titolo').textContent='Tecnica attiva: '+tecnica;

if(tecnica==='cattura'){
document.addEventListener('click',function(e){
if(e.isTrusted&&window.__stato.adSparati<2){
window.__stato.adSparati++;
window.open('https://esempio-pubblicita-finta.test/pop?zoneid=9305180');
e.stopImmediatePropagation();
e.preventDefault();
return;
}
},true);
document.addEventListener('pointerdown',function(e){
if(e.isTrusted&&window.__stato.adSparati<2){
window.__stato.adSparati++;
window.open('https://esempio-pubblicita-finta.test/pop?zoneid=9305180');
e.stopImmediatePropagation();
e.preventDefault();
return;
}
},true);
}

if(tecnica==='ancora'){
var a=document.createElement('a');
a.href='https://esempio-pubblicita-finta.test/pop?zoneid=9305180';
a.target='_blank';
a.style.position='absolute';
a.style.left='0';
a.style.top='0';
a.style.width='100%';
a.style.height='100%';
a.style.opacity='0.01';
a.style.zIndex='99999';
document.getElementById('lettore').appendChild(a);
a.addEventListener('click',function(){
window.__stato.adSparati++;
a.remove();
});
}
</script>
</body>
</html>` };
