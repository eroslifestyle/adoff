// =============================================
// STEALTH INJECTOR — Firefox MAIN world workaround
// Firefox MV3 does not support world:"MAIN" in content_scripts.
// This script runs in ISOLATED world and injects stealth.js
// into the page's MAIN world via a <script> tag.
// =============================================
(function () {
  "use strict";

  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("src/stealth.js");
    script.onload = function () {
      this.remove();
    };
    (document.documentElement || document.head || document.body).appendChild(script);
  } catch (_) {
    // CSP may block script injection on some pages — stealth silently disabled
  }
})();
