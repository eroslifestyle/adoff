// Theme boot: applica il tema salvato PRIMA del render per evitare flash. Serve a entrambe le pagine admin.
(function(){try{var t=localStorage.getItem("adoff_theme");if(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)t="dark";if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();
