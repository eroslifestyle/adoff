/**
 * Test specifico per layout YouTube — verifica che il plugin
 * non tagli/nasconda elementi legittimi della pagina
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.resolve(__dirname, "../../");
const SCREENSHOT_DIR = path.resolve(__dirname, "../data-analisi/screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

(async () => {
  console.log("\n=== YouTube Layout Test ===\n");

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
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  await new Promise((r) => setTimeout(r, 2000));

  // TEST 1: Pagina canale — video grid non tagliata
  console.log("[1] Pagina canale YouTube...");
  const channelPage = await context.newPage();
  await channelPage.goto("https://www.youtube.com/@leonvanzyl/videos", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await channelPage.waitForTimeout(3000);

  // Clicca su "Video" tab se presente
  const videoTab = await channelPage.$('yt-tab-shape[tab-title="Video"], yt-tab-shape[tab-title="Videos"]');
  if (videoTab) {
    await videoTab.click();
    await channelPage.waitForTimeout(2000);
  }

  // Verifica che il primo video thumbnail sia completamente visibile
  const firstThumb = await channelPage.$("ytd-rich-item-renderer ytd-thumbnail a");
  if (firstThumb) {
    const box = await firstThumb.boundingBox();
    if (box) {
      const isVisible = box.y >= 0 && box.height > 100;
      console.log(`  Primo thumbnail: y=${box.y.toFixed(0)}, h=${box.height.toFixed(0)}, visible=${isVisible}`);
      if (box.y < 50) {
        console.log("  ❌ FAIL: Thumbnail tagliato in alto (y troppo basso)");
      } else {
        console.log("  ✅ PASS: Thumbnail visibile correttamente");
      }
    }
  } else {
    console.log("  ⚠️ Nessun thumbnail trovato");
  }

  // Verifica elementi layout non nascosti
  const layoutCheck = await channelPage.evaluate(() => {
    const checks = {};

    // Channel header
    const header = document.querySelector("ytd-c4-tabbed-header-renderer, #channel-header");
    checks.channelHeader = header ? getComputedStyle(header).display !== "none" : false;

    // Tabs bar
    const tabs = document.querySelector("yt-tab-group-shape, #tabsContainer, paper-tabs");
    checks.tabsBar = tabs ? getComputedStyle(tabs).display !== "none" : false;

    // Video grid container
    const grid = document.querySelector("ytd-rich-grid-renderer, ytd-section-list-renderer");
    checks.videoGrid = grid ? getComputedStyle(grid).display !== "none" : false;

    // Conta video visibili
    const videos = document.querySelectorAll("ytd-rich-item-renderer");
    let visibleCount = 0;
    for (const v of videos) {
      if (getComputedStyle(v).display !== "none") visibleCount++;
    }
    checks.visibleVideos = visibleCount;

    // Controlla se qualche elemento ha data-ss-hidden che non dovrebbe
    const ssHidden = document.querySelectorAll("[data-ss-hidden]");
    checks.hiddenByPlugin = [];
    for (const el of ssHidden) {
      checks.hiddenByPlugin.push(el.tagName + (el.id ? "#" + el.id : "") + (el.className ? "." + el.className.split(" ")[0] : ""));
    }

    return checks;
  });

  console.log(`  Channel header visibile: ${layoutCheck.channelHeader ? "✅" : "❌"}`);
  console.log(`  Tabs bar visibile: ${layoutCheck.tabsBar ? "✅" : "❌"}`);
  console.log(`  Video grid visibile: ${layoutCheck.videoGrid ? "✅" : "❌"}`);
  console.log(`  Video visibili: ${layoutCheck.visibleVideos}`);
  if (layoutCheck.hiddenByPlugin.length > 0) {
    console.log(`  ⚠️ Elementi nascosti dal plugin: ${layoutCheck.hiddenByPlugin.join(", ")}`);
  } else {
    console.log(`  ✅ Nessun elemento legittimo nascosto dal plugin`);
  }

  await channelPage.screenshot({ path: path.join(SCREENSHOT_DIR, "yt-channel-layout.png") });
  console.log("  📸 Screenshot: yt-channel-layout.png");

  // TEST 2: Watch page — video full size
  console.log("\n[2] Watch page YouTube...");
  const watchPage = await context.newPage();
  await watchPage.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await watchPage.waitForTimeout(3000);

  const videoBox = await watchPage.evaluate(() => {
    const v = document.querySelector("video.html5-main-video, video.video-stream");
    if (!v) return null;
    const rect = v.getBoundingClientRect();
    return { width: rect.width, height: rect.height, top: rect.top };
  });

  if (videoBox) {
    const ok = videoBox.width > 600 && videoBox.height > 300;
    console.log(`  Video: ${videoBox.width.toFixed(0)}x${videoBox.height.toFixed(0)}, top=${videoBox.top.toFixed(0)}`);
    console.log(`  ${ok ? "✅ PASS" : "❌ FAIL"}: dimensione video ${ok ? "corretta" : "troppo piccola"}`);
  } else {
    console.log("  ❌ Video element non trovato");
  }

  // Verifica sidebar suggeriti
  const sidebarCheck = await watchPage.evaluate(() => {
    const related = document.querySelector("#related, ytd-watch-next-secondary-results-renderer");
    if (!related) return { visible: false, videos: 0 };
    const items = related.querySelectorAll("ytd-compact-video-renderer");
    return {
      visible: getComputedStyle(related).display !== "none",
      videos: items.length,
    };
  });

  console.log(`  Sidebar suggeriti: ${sidebarCheck.visible ? "✅" : "❌"} (${sidebarCheck.videos} video)`);

  await watchPage.screenshot({ path: path.join(SCREENSHOT_DIR, "yt-watch-layout.png") });
  console.log("  📸 Screenshot: yt-watch-layout.png");

  // TEST 3: Navigazione SPA — cambia video
  console.log("\n[3] Navigazione SPA...");
  const navLink = await watchPage.$("ytd-compact-video-renderer a");
  if (navLink) {
    await navLink.click();
    await watchPage.waitForTimeout(4000);

    const afterNav = await watchPage.evaluate(() => {
      const v = document.querySelector("video.html5-main-video, video.video-stream");
      if (!v) return null;
      const rect = v.getBoundingClientRect();
      return { width: rect.width, height: rect.height, readyState: v.readyState };
    });

    if (afterNav && afterNav.width > 600) {
      console.log(`  ✅ PASS: Video dopo navigazione ${afterNav.width.toFixed(0)}x${afterNav.height.toFixed(0)}, readyState=${afterNav.readyState}`);
    } else {
      console.log(`  ❌ FAIL: Video dopo navigazione — ${afterNav ? `${afterNav.width}x${afterNav.height}` : "non trovato"}`);
    }

    await watchPage.screenshot({ path: path.join(SCREENSHOT_DIR, "yt-after-spa-nav.png") });
    console.log("  📸 Screenshot: yt-after-spa-nav.png");
  } else {
    console.log("  ⚠️ Nessun link suggerito per test navigazione");
  }

  // TEST 4: Homepage
  console.log("\n[4] YouTube Homepage...");
  const homePage = await context.newPage();
  await homePage.goto("https://www.youtube.com", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await homePage.waitForTimeout(3000);

  const homeCheck = await homePage.evaluate(() => {
    const videos = document.querySelectorAll("ytd-rich-item-renderer");
    let visible = 0;
    let hidden = 0;
    for (const v of videos) {
      if (getComputedStyle(v).display === "none" || v.hasAttribute("data-ss-hidden")) {
        hidden++;
      } else {
        visible++;
      }
    }
    return { visible, hidden, total: videos.length };
  });

  console.log(`  Video in homepage: ${homeCheck.visible} visibili, ${homeCheck.hidden} nascosti (totale ${homeCheck.total})`);
  if (homeCheck.visible > 10) {
    console.log("  ✅ PASS: Homepage mostra video correttamente");
  } else {
    console.log("  ❌ FAIL: Troppo pochi video visibili in homepage");
  }

  await homePage.screenshot({ path: path.join(SCREENSHOT_DIR, "yt-homepage.png") });
  console.log("  📸 Screenshot: yt-homepage.png");

  console.log("\n=== Test completati ===\n");
  await context.close();
})();
