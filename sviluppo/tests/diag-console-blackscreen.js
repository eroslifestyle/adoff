(function() {
'use strict';
console.log('Diagnostica avviata: guarda il video normalmente per 120 secondi. Per fermarla prima: window.__stop()');
// Leggi i valori di diagnostica:
// - reqTotal: se è 0 il gate Pro non è arrivato o siamo in modalità compatibilità.
// - flagInjected: se è 0 mentre reqTotal > 0, il body non è stato riconosciuto; il server continua a cucire l'attesa nello stream (causa schermo nero).
// - adSeeks: se resta 0 durante un annuncio, una delle guardie sta bloccando il seek chirurgico.
const staticInfo={
versioneEstensione:document.documentElement.getAttribute('data-adoff-stealth')?'gate Pro attivo':'gate Pro NON attivo',
compatMode:(function(){try{return localStorage.getItem('__adoff_vc');}catch(e){return 'n/d';}})(),
adPlacementsPresenti:!!(window.ytInitialPlayerResponse&&window.ytInitialPlayerResponse.adPlacements),
playerAdsPresenti:!!(window.ytInitialPlayerResponse&&window.ytInitialPlayerResponse.playerAds),
formatiConUrlDiretto:(function(){const af=window.ytInitialPlayerResponse?.streamingData?.adaptiveFormats||[];return af.filter(f=>!!f.url).length+'/'+af.length;})(),
haServerAbr:!!(window.ytInitialPlayerResponse?.streamingData?.serverAbrStreamingUrl),
runtimeKillerAttivo:(function(){try{const fetchStr=window.fetch.toString();return fetchStr.includes('isProSync')?'hook fetch installato':'hook fetch NON installato';}catch(e){return 'hook fetch NON installato';}})(),
contatoriLayerA:(function(){try{return window.__adoffYtDiag;}catch(e){return 'n/d';}})(),
formaRichiestePlayer:(function(){try{const d=window.__adoffYtDiag;if(!d)return 'n/d';const n=d.reqFormRequest||0;const m=d.reqFormInit||0;return 'Request:'+n+' init:'+m;}catch(e){return 'n/d';}})(),
flagAntiAttesaIniettato:(function(){try{return window.__adoffYtDiag?.flagInjected??'n/d';}catch(e){return 'n/d';}})(),
seekEseguiti:(function(){try{return window.__adoffYtDiag?.adSeeks??'n/d';}catch(e){return 'n/d';}})()
};
let stallRecoveredCount=0;
window.addEventListener('adoff-stall-recovered',()=>stallRecoveredCount++);
let stuckAdEndedCount=0;
window.addEventListener('adoff-stuck-ad-ended',()=>stuckAdEndedCount++);
let lastCurrentTime=null;
let inBlackPeriod=false;
let currentBlackPeriod=null;
const periods=[];
let inAdPeriod=false;
let currentAdPeriod=null;
const adPeriods=[];
const startTs=performance.now();
let intervalId=null,timeoutId=null;
function sample(){
const t=performance.now()-startTs;
const player=document.getElementById('movie_player');
const video=player?.querySelector('video');
const currentTime=video?.currentTime??null;
const paused=video?.paused??true;
const readyState=video?.readyState??-1;
const buffered=video?.buffered;
const buffEnd=(buffered&&buffered.length)?buffered.end(buffered.length-1):0;
const adShowing=player&&(player.classList.contains('ad-showing')||player.classList.contains('ad-interrupting'));
const playbackRate=video?.playbackRate??0;
const delta=(currentTime!==null&&lastCurrentTime!==null)?currentTime-lastCurrentTime:null;
if(!inBlackPeriod){
if(!paused&&delta!==null&&delta<=0.05){
inBlackPeriod=true;
currentBlackPeriod={startMs:t,startCurrentTime:currentTime,minReadyState:readyState,maxReadyState:readyState,adShowingSeen:!!adShowing,bufferAheadSeen:(buffEnd-currentTime)>0.5};
}
}else{
if(!paused&&delta!==null&&delta<=0.05){
if(readyState<currentBlackPeriod.minReadyState)currentBlackPeriod.minReadyState=readyState;
if(readyState>currentBlackPeriod.maxReadyState)currentBlackPeriod.maxReadyState=readyState;
if(adShowing)currentBlackPeriod.adShowingSeen=true;
if((buffEnd-currentTime)>0.5)currentBlackPeriod.bufferAheadSeen=true;
}else{
currentBlackPeriod.durationMs=t-currentBlackPeriod.startMs;
currentBlackPeriod.stopCurrentTime=lastCurrentTime;
periods.push(currentBlackPeriod);
inBlackPeriod=false;
currentBlackPeriod=null;
}
}
if(!inAdPeriod){
if(adShowing){
inAdPeriod=true;
currentAdPeriod={startMs:t,ctIniziale:currentTime,maxRate:playbackRate};
}
}else{
if(adShowing){
if(playbackRate>currentAdPeriod.maxRate){
currentAdPeriod.maxRate=playbackRate;
}
}else{
currentAdPeriod.durationMs=t-currentAdPeriod.startMs;
currentAdPeriod.ctFinale=lastCurrentTime;
currentAdPeriod.avanzato=(currentAdPeriod.ctFinale-currentAdPeriod.ctIniziale)>0.5;
adPeriods.push(currentAdPeriod);
inAdPeriod=false;
currentAdPeriod=null;
}
}
lastCurrentTime=currentTime;
}
intervalId=setInterval(sample,250);
timeoutId=setTimeout(()=>{clearInterval(intervalId);printReport();},120000);
window.__stop=function(){clearInterval(intervalId);clearTimeout(timeoutId);printReport();};
function printReport(){
if(inBlackPeriod&&currentBlackPeriod){
currentBlackPeriod.durationMs=(performance.now()-startTs)-currentBlackPeriod.startMs;
currentBlackPeriod.stopCurrentTime=lastCurrentTime;
currentBlackPeriod.ancoraInCorso=true;
periods.push(currentBlackPeriod);
inBlackPeriod=false;currentBlackPeriod=null;
}
if(inAdPeriod&&currentAdPeriod){
currentAdPeriod.durationMs=(performance.now()-startTs)-currentAdPeriod.startMs;
currentAdPeriod.ctFinale=lastCurrentTime;
currentAdPeriod.avanzato=(currentAdPeriod.ctFinale-currentAdPeriod.ctIniziale)>0.5;
currentAdPeriod.ancoraInCorso=true;
adPeriods.push(currentAdPeriod);
inAdPeriod=false;currentAdPeriod=null;
}
console.log('COPIA DA QUI IN GIU');
console.log('Versione estensione: '+staticInfo.versioneEstensione);
console.log('compatMode: '+staticInfo.compatMode);
console.log('adPlacements presenti: '+staticInfo.adPlacementsPresenti);
console.log('playerAds presenti: '+staticInfo.playerAdsPresenti);
console.log('formati con URL diretto: '+staticInfo.formatiConUrlDiretto);
console.log('ha server ABR: '+staticInfo.haServerAbr);
console.log('runtimeKiller: '+staticInfo.runtimeKillerAttivo);
console.log('');
if(periods.length===0){
console.log('Nessun periodo di nero rilevato.');
}else{
periods.forEach((p,i)=>{
const num=i+1;
const durata=Math.round(p.durationMs);
const ct=p.startCurrentTime.toFixed(2);
const annuncio=p.adShowingSeen?'SI':'NO';
const readyMin=p.minReadyState;
const readyMax=p.maxReadyState;
const bufferAv=p.bufferAheadSeen?'SI':'NO';
console.log(`nero #${num}: ${durata}ms${p.ancoraInCorso?' (ANCORA IN CORSO)':''} a ct=${ct} | annuncio visibile: ${annuncio} | readyState ${readyMin}->${readyMax} | buffer avanti: ${bufferAv}`);
});
console.log('');
const totalMs=periods.reduce((s,p)=>s+p.durationMs,0);
console.log('Totale periodi neri: '+periods.length+', somma '+Math.round(totalMs)+'ms');
}
console.log('');
console.log('ANNUNCI A SCHERMO:');
if(adPeriods.length===0){
console.log('Nessun annuncio rilevato a schermo.');
}else{
adPeriods.forEach((p,i)=>{
const num=i+1;
const durata=Math.round(p.durationMs);
const ctIn=p.ctIniziale.toFixed(2);
const ctFin=(p.ctFinale!==undefined?p.ctFinale:p.ctIniziale).toFixed(2);
const maxRate=p.maxRate;
const scorso=p.avanzato?'SI':'NO';
console.log(`annuncio #${num}: ${durata}ms | ct ${ctIn} -> ${ctFin} | playbackRate max: ${maxRate} | scorso: ${scorso}${p.ancoraInCorso?' (ANCORA IN CORSO)':''}`);
});
console.log('');
const totalAdMs=adPeriods.reduce((s,p)=>s+p.durationMs,0);
console.log('Totale annunci: '+adPeriods.length+', somma '+Math.round(totalAdMs)+'ms');
}
console.log('');
console.log('Interventi watchdog (adoff-stall-recovered): '+stallRecoveredCount);
console.log('Annunci terminati dal fix (adoff-stuck-ad-ended): '+stuckAdEndedCount);
}
})();
