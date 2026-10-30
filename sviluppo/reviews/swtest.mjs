// Verifica meccanismo gating: updateStaticRules + getDisabledRuleIds sul ruleset reale.
import { chromium } from 'playwright';
const PORT = process.argv[2] || '9224';
const b = await chromium.connectOverCDP('http://localhost:' + PORT);
const ctx = b.contexts()[0];
let sw = ctx.serviceWorkers()[0];
for (let i = 0; i < 24 && !sw; i++) { await new Promise(r => setTimeout(r, 500)); sw = ctx.serviceWorkers()[0]; }
if (!sw) { console.log('NO_SW (service worker non trovato)'); await b.close(); process.exit(0); }
const IDS = [170, 171, 172, 173, 174, 175, 176, 179];
const res = await sw.evaluate(async (IDS) => {
  const has = !!chrome.declarativeNetRequest.updateStaticRules;
  if (!has) return { has: false };
  await chrome.declarativeNetRequest.updateStaticRules({ rulesetId: 'adblock_rules', disableRuleIds: IDS });
  const dis = await chrome.declarativeNetRequest.getDisabledRuleIds({ rulesetId: 'adblock_rules' });
  await chrome.declarativeNetRequest.updateStaticRules({ rulesetId: 'adblock_rules', enableRuleIds: IDS });
  const dis2 = await chrome.declarativeNetRequest.getDisabledRuleIds({ rulesetId: 'adblock_rules' });
  return { has: true, disabled_after_disable: dis, disabled_after_enable: dis2 };
}, IDS);
console.log(JSON.stringify(res));
await b.close();
process.exit(0);
