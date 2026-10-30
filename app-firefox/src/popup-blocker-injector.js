/* ============================================================
   POPUP BLOCKER INJECTOR — Firefox MAIN world workaround
   Firefox MV3 does not support 'world: MAIN' in content_scripts.
   This script runs in ISOLATED world in EVERY frame (all_frames: true)
   and injects popup-blocker.js into the page's MAIN world via a script tag.
   ============================================================ */

(function() {
  'use strict';

  try {
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/popup-blocker.js');
    script.onload = function() {
      this.remove();
    };
    (document.documentElement || document.head || document.body).appendChild(script);
  } catch (e) {
    // CSP may block injection on some pages; in that case the popup blocker
    // remains silently disabled.
  }
})();
