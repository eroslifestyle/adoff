/**
 * Test specifico: verifica che le aree ad vuote siano collassate
 * su siti come Aranzulla, Corriere, etc.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.resolve(__dirname, "../../");
const SCREENSHOT_DIR = path.resolve(__dirname, "../data-analisi/screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

(async () => {
  console.log("\n=== Test Aree Ad Vuote ===\n");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    channel: "chrome",
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
      "--mute-audio",
    ],
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  await new Promise((r) => setTimeout(r, 2000));

  const testSites = [
    { url: "https://www.aranzulla.it/programmi-per-organizzare-il-lavoro-1192498.html", name: "Aranzulla" },
    { url: "https://www.corriere.it", name: "Corriere" },
    { url: "https://www.ilfattoquotidiano.it", name: "IlFatto" },
    { url: "https://www.repubblica.it", name: "Repubblica" },
  ];

  for (const site of testSites) {
    console.log(`[${site.name}]`);
    const page = await context.newPage();

    try {
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 15000 });
      // Accetta cookies se presente
      await page.waitForTimeout(2000);
      const acceptBtn = await page.$('button:has-text("Accetta"), button:has-text("Accept"), #didomi-notice-agree-button, .iubenda-cs-accept-btn');
      if (acceptBtn) {
        await acceptBtn.click();
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(2000);

      // Analisi aree ad
      const analysis = await page.evaluate(() => {
        const results = {
          adsbyGoogle: { total: 0, visible: 0, hidden: 0 },
          gptAds: { total: 0, visible: 0, hidden: 0 },
          iframesAd: { total: 0, visible: 0, hidden: 0 },
          adLabels: { total: 0, visible: 0, hidden: 0 },
          emptyAdSpaces: [],
          ssHiddenCount: 0,
        };

        // ins.adsbygoogle
        document.querySelectorAll("ins.adsbygoogle").forEach((el) => {
          results.adsbyGoogle.total++;
          const style = getComputedStyle(el);
          if (style.display === "none" || el.hasAttribute("data-ss-hidden")) {
            results.adsbyGoogle.hidden++;
          } else {
            results.adsbyGoogle.visible++;
          }
        });

        // div-gpt-ad
        document.querySelectorAll('div[id^="div-gpt-ad"]').forEach((el) => {
          results.gptAds.total++;
          const style = getComputedStyle(el);
          if (style.display === "none" || el.hasAttribute("data-ss-hidden")) {
            results.gptAds.hidden++;
          } else {
            results.gptAds.visible++;
          }
        });

        // iframes ad
        document.querySelectorAll("iframe").forEach((el) => {
          const src = (el.src || "").toLowerCase();
          if (src.includes("doubleclick") || src.includes("googlesyndication") || src.includes("googleadservices")) {
            results.iframesAd.total++;
            const style = getComputedStyle(el);
            if (style.display === "none" || el.hasAttribute("data-ss-hidden")) {
              results.iframesAd.hidden++;
            } else {
              results.iframesAd.visible++;
            }
          }
        });

        // Elementi con testo "Ad" visibili
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent.trim();
          if (text === "Ad" || text === "Ads" || text === "Pubblicità" || text === "Advertisement") {
            const parent = walker.currentNode.parentElement;
            if (parent) {
              results.adLabels.total++;
              const style = getComputedStyle(parent);
              if (style.display === "none" || parent.hasAttribute("data-ss-hidden")) {
                results.adLabels.hidden++;
              } else {
                results.adLabels.visible++;
                const rect = parent.getBoundingClientRect();
                if (rect.width > 10 && rect.height > 10) {
                  results.emptyAdSpaces.push({
                    tag: parent.tagName,
                    text: text,
                    size: `${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`,
                    pos: `${rect.x.toFixed(0)},${rect.y.toFixed(0)}`,
                  });
                }
              }
            }
          }
        }

        results.ssHiddenCount = document.querySelectorAll("[data-ss-hidden]").length;
        return results;
      });

      console.log(`  AdsByGoogle: ${analysis.adsbyGoogle.total} trovati, ${analysis.adsbyGoogle.hidden} nascosti, ${analysis.adsbyGoogle.visible} visibili`);
      console.log(`  GPT Ads:     ${analysis.gptAds.total} trovati, ${analysis.gptAds.hidden} nascosti, ${analysis.gptAds.visible} visibili`);
      console.log(`  Iframe Ad:   ${analysis.iframesAd.total} trovati, ${analysis.iframesAd.hidden} nascosti, ${analysis.iframesAd.visible} visibili`);
      console.log(`  "Ad" labels: ${analysis.adLabels.total} trovati, ${analysis.adLabels.hidden} nascosti, ${analysis.adLabels.visible} visibili`);
      console.log(`  Plugin nascosti: ${analysis.ssHiddenCount} elementi`);

      if (analysis.emptyAdSpaces.length > 0) {
        console.log(`  ❌ Aree ad vuote ancora visibili:`);
        for (const space of analysis.emptyAdSpaces) {
          console.log(`     - <${space.tag}> "${space.text}" ${space.size} at (${space.pos})`);
        }
      } else {
        console.log(`  ✅ Nessuna area ad vuota visibile`);
      }

      const totalVisible = analysis.adsbyGoogle.visible + analysis.gptAds.visible + analysis.iframesAd.visible;
      console.log(`  ${totalVisible === 0 ? "✅ PASS" : "❌ FAIL"}: ${totalVisible} elementi ad ancora visibili`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${site.name.toLowerCase()}-adspaces.png`) });
      console.log(`  📸 Screenshot: ${site.name.toLowerCase()}-adspaces.png`);

    } catch (e) {
      console.log(`  ❌ Errore: ${e.message}`);
    }

    await page.close();
    console.log();
  }

  await context.close();
  console.log("=== Test completati ===\n");
})();
