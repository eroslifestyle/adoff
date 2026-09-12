// Registrazione service worker (estratta dall'HTML per CSP script-src 'self')
if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{})});}
