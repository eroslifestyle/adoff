#!/usr/bin/env node
/**
 * One-shot batch fixer for all remaining AdOff incongruities (audit 2026-05-29).
 *  P1 fixes: press.html version, es/pt terms.s2 English bleed, zh missing translations.
 *  P2 fixes: "130+ rules" -> "138 rules" everywhere, install.html browser count consistency.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { globSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin';
const SITE = path.join(ROOT, 'site');

/* ============================================================
   FIX 1: press.html version 3.4.0 → 3.4.4
   ============================================================ */
async function fixPressVersion() {
  const p = path.join(SITE, 'press.html');
  let s = await readFile(p, 'utf8');
  const before = s;
  s = s.replace(/>3\.4\.0</g, '>3.4.4<');
  if (s !== before) {
    await writeFile(p, s, 'utf8');
    console.log('[fix1] press.html: version 3.4.0 → 3.4.4');
  }
}

/* ============================================================
   FIX 2: "130+ regole/rules/etc" → "138 ..." in all site files
   Match: 130 (with optional +) followed by space and a rule-noun in any language.
   ============================================================ */
async function fixRulesCount() {
  const RULE_NOUN = '(?:regole|rules?|règles|reglas|regras|правил|قواعد|条规则|규칙|kurall(?:ı|a)|aturan|reguł|नियम|ルール|Regeln|규정)';
  const PAT = new RegExp(`\\b130\\+?(\\s+${RULE_NOUN})\\b`, 'g');
  const targets = [
    'site/*.html',
    'site/*/*.html',
    'site/*/vs/*.html',
    'site/blog/*.html',
    'site/*/blog/*.html',
    'site/i18n/*.json',
    'site/llms*.txt',
  ];
  let count = 0;
  for (const pat of targets) {
    for (const f of globSync(path.join(ROOT, pat))) {
      let s = await readFile(f, 'utf8');
      const before = s;
      s = s.replace(PAT, '138$1');
      if (s !== before) {
        await writeFile(f, s, 'utf8');
        const n = (before.match(PAT) || []).length;
        count += n;
      }
    }
  }
  console.log(`[fix2] rules count "130+" → "138": ${count} replacements`);
}

/* ============================================================
   FIX 3: es.json + pt.json "terms.s2" + es.json "support.desc.label" English bleed
   ============================================================ */
async function fixTermsTranslations() {
  const fixes = [
    { file: 'es.json', updates: {
        'terms.s2': '2. Descripción del Servicio',
        'support.desc.label': 'Descripción',
    } },
    { file: 'pt.json', updates: {
        'terms.s2': '2. Descrição do Serviço',
    } },
  ];
  for (const { file, updates } of fixes) {
    const p = path.join(SITE, 'i18n', file);
    const d = JSON.parse(await readFile(p, 'utf8'));
    let n = 0;
    for (const [k, v] of Object.entries(updates)) {
      if (d[k] !== v) { d[k] = v; n++; }
    }
    await writeFile(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
    console.log(`[fix3] ${file}: ${n} key(s) translated`);
  }
}

/* ============================================================
   FIX 4: install.html browser count consistency.
   The supported browser set is Chrome, Firefox, Safari, Edge, Opera, Brave (= 6).
   Audit found: title says 5, content says 6. Force 6 + universal list.
   ============================================================ */
async function fixInstallBrowserCount() {
  const p = path.join(SITE, 'install.html');
  let s = await readFile(p, 'utf8');
  const before = s;
  s = s.replace(
    /Download and install AdOff ad blocker on Chrome, Edge, Brave, Firefox, Safari, and Opera\./g,
    'Download and install AdOff ad blocker on Chrome, Firefox, Safari, Edge, Opera and Brave.'
  );
  s = s.replace(
    /Download AdOff for Chrome, Edge, Brave, Firefox, Safari\./g,
    'Download AdOff for Chrome, Firefox, Safari, Edge, Opera and Brave.'
  );
  if (s !== before) {
    await writeFile(p, s, 'utf8');
    console.log('[fix4] install.html: browser list normalized to Chrome/Firefox/Safari/Edge/Opera/Brave');
  } else {
    console.log('[fix4] install.html: no changes needed');
  }
}

/* ============================================================
   FIX 5: 49 missing zh.json translations (Chinese Simplified, professional tone).
   Source: it.json values; target: zh.json keys.
   ============================================================ */
async function fixZhTranslations() {
  const ZH = {
    // How it works
    'how.step1.desc': '下载 AdOff 并在 2 分钟内安装到浏览器。它非常轻量,不需要权限,也无需账户。',
    'how.step2.desc': '首次启动即可完整使用所有 Pro 功能,包括反检测 Stealth Mode 和视频广告中和。',
    'how.step3.desc': '试用结束后,继续使用 Pro 或保留 Free 版本。基础拦截始终免费,无时间限制。',
    // Referral
    'ref.step1.desc': '打开 AdOff > 选项 > 邀请好友。复制您的专属推荐链接并分享。',
    'ref.step2.desc': '好友下载 AdOff 并获得 30 天完整 Pro 试用。',
    'ref.step3.desc': '当好友升级到 Pro,您将获得 +15 天免费。好友也获得 +7 天奖励。',
    // Trust
    'trust.secure.desc': '所有付款由 Stripe(全球在线支付领导者)处理。我们不保存您的信用卡数据。',
    'trust.private.desc': '我们不追踪您的浏览。我们不出售您的数据,从不。您的邮箱仅用于服务通信。',
    'trust.guarantee.desc': '30 天试用 AdOff Pro。如果不满意,100% 全额退款。无需提问,无需说明。',
    // Meta
    'meta.description': 'AdOff 拦截 Chrome、Edge、Brave 和 Firefox 上的所有广告。Stealth Mode 反检测让网站发现不了。30 天免费 Pro 试用。',
    'meta.og.description': 'AdOff 拦截 Chrome、Edge、Brave 和 Firefox 上的所有广告。Stealth Mode 反检测让网站发现不了。30 天免费 Pro 试用。',
    // Support
    'support.desc.label': '描述',
    'support.desc.ph': '请详细描述问题。包括:\n- 您预期发生什么\n- 实际发生了什么\n- 复现步骤(可能的话)\n- 您使用的浏览器和版本',
    'support.quick1.desc': '尝试禁用并重新启用 AdOff。如果问题仍然存在,该网站可能使用了非常激进的反广告拦截系统。',
    'support.quick2.desc': '检查是否复制了完整的密钥,包括 "ADOFF-"。前往 选项 > 许可证 并粘贴密钥。',
    'support.quick3.desc': '当出现"跳过"按钮时,AdOff 会自动跳过广告。视频前置广告 5 秒内由 IMA stub 自动中和。',
    'support.quick4.desc': '我们提供 30 天无条件满意保证。在下方选择"退款",我们将在 24 小时内处理。',
    // Install: Chrome
    'install.chrome.s1.desc': '在下载文件夹中找到 <strong>adoff-chrome.zip</strong>。<br><br> <strong>Windows:</strong> 右键 → <strong>解压全部</strong>。<br> <strong>Mac:</strong> 双击 ZIP 文件即可解压。',
    'install.chrome.s2.desc': '打开 Chrome 并在地址栏输入 <code>chrome://extensions</code>,然后按 <strong>回车</strong>。',
    'install.chrome.s3.desc': '在页面右上角,找到 <strong>开发者模式</strong> 开关并启用。',
    'install.chrome.s5.desc': '导航到第 1 步解压的文件夹。<br><br> 选择 <strong>adoff-chrome</strong> 文件夹并点击 <strong>选择</strong>。',
    // Install: Edge
    'install.edge.s1.desc': '与 Chrome 相同:在下载中找到 <strong>adoff-chrome.zip</strong>,右键 → <strong>解压全部</strong>。',
    'install.edge.s2.desc': '在地址栏输入 <code>edge://extensions</code> 并按 <strong>回车</strong>。',
    'install.edge.s3.desc': '在页面左下方,启用 <strong>开发者模式</strong>。',
    'install.edge.s4.desc': '点击 <strong>加载解压缩的扩展</strong> 并选择步骤 1 中解压的文件夹。',
    // Install: Brave
    'install.brave.s1.desc': 'Brave 使用与 Chrome 相同的系统。请按相同步骤操作:<br><br> 1. 解压 ZIP<br> 2. 前往 <code>brave://extensions</code><br> 3. 启用开发者模式<br> 4. 加载解压缩的扩展',
    // Install: Firefox
    'install.firefox.s1.desc': '在下载中找到 <strong>adoff-firefox.zip</strong> 并解压。',
    'install.firefox.s2.desc': '在地址栏输入:<code>about:debugging#/runtime/this-firefox</code> 并按 <strong>回车</strong>。',
    'install.firefox.s3.desc': '点击 <strong>临时加载附加组件</strong>。<br><br> 选择解压文件夹中的 <strong>manifest.json</strong> 文件。',
    'install.firefox.note.desc': '请确保下载的是 Firefox 版本(adoff-firefox.zip),而不是 Chrome 版本。Firefox 需要不同的 manifest 结构。',
    // Install: Opera + Vivaldi
    'install.opera.s1.desc': 'Opera 使用 Chromium 内核。请按相同步骤操作:<br><br> 1. 解压 ZIP<br> 2. 前往 <code>opera://extensions</code><br> 3. 启用开发者模式<br> 4. 加载解压缩的扩展',
    'install.vivaldi.s1.desc': 'Vivaldi 使用 Chromium 内核。请按相同步骤操作:<br><br> 1. 解压 ZIP<br> 2. 前往 <code>vivaldi://extensions</code><br> 3. 启用开发者模式<br> 4. 加载解压缩的扩展',
    // Install: Safari
    'install.safari.note.desc': 'Safari 比其他浏览器更严格。需要 Xcode(Apple 的免费程序)安装扩展。这是 Apple 的官方流程。',
    'install.safari.s1.desc': '<strong>1.1</strong> 打开 <strong>Finder</strong>(底部 Dock 中的笑脸图标)。<br> <strong>1.2</strong> 在下载文件夹中找到 <strong>adoff-safari.zip</strong>,双击解压。',
    'install.safari.s2.desc': '<strong>2.1</strong> 打开 <strong>Mac App Store</strong>(Dock 中带白色 "A" 的蓝色图标)。<br> <strong>2.2</strong> 在搜索栏输入 <strong>Xcode</strong> 并安装(免费,约 10 GB)。',
    'install.safari.s3.desc': '<strong>3.1</strong> 同时按 <strong>Cmd + Space</strong>。打开搜索栏。<br> <strong>3.2</strong> 输入 <strong>Terminal</strong> 并按回车。',
    'install.safari.s4.desc': '<strong>4.1</strong> 打开 <strong>Safari</strong>(Dock 中的指南针图标)。<br> <strong>4.2</strong> 菜单栏 <strong>Safari > 设置 > 高级</strong>,勾选 <strong>在菜单栏中显示开发菜单</strong>。',
    'install.safari.s5.desc': '<strong>5.1</strong> 在 Safari 菜单栏,点击新的 <strong>开发</strong> 菜单。<br> <strong>5.2</strong> 进入 <strong>允许未签名的扩展</strong>(每次重启 Safari 时需要重新启用)。',
    // Install: Android (Kiwi)
    'install.android.note.desc': '在 Android 上,您需要支持扩展的浏览器。我们推荐 Kiwi Browser(免费,原生支持 Chrome 扩展)。',
    'install.android.s1.desc': '从 Play Store 下载 <strong>Kiwi Browser</strong>。它是免费的,原生支持 Chrome 扩展。',
    'install.android.s2.desc': '在 Kiwi Browser 中打开此页面并下载 <strong>adoff-chrome.zip</strong>。使用 RAR 或 ZArchiver 等应用解压。',
    'install.android.s3.desc': '在 Kiwi Browser 中,前往 <code>chrome://extensions</code><br><br> 启用 <strong>开发者模式</strong> 并加载解压的文件夹。',
    // Install trial
    'install.trial.desc': '无需信用卡。解锁 Stealth Mode、视频广告中和、定时暂停,所有 Pro 功能。30 天后选择继续或转到 Free 计划(仍可拦截网站广告)。',
    // Footer use cases
    'footer.uc1': '不可检测的广告拦截器',
    'footer.uc2': '轻量级广告拦截器',
    'footer.uc3': 'Manifest V3 广告拦截器',
    'footer.uc4': '拦截视频广告',
    'footer.uc5': '绕过反广告拦截',
    'footer.uc6': '私密广告拦截器',
  };
  const p = path.join(SITE, 'i18n', 'zh.json');
  const d = JSON.parse(await readFile(p, 'utf8'));
  let added = 0;
  for (const [k, v] of Object.entries(ZH)) {
    if (d[k] !== v) { d[k] = v; added++; }
  }
  await writeFile(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log(`[fix5] zh.json: ${added} translations added/updated (target ${Object.keys(ZH).length})`);
}

async function main() {
  await fixPressVersion();
  await fixRulesCount();
  await fixTermsTranslations();
  await fixInstallBrowserCount();
  await fixZhTranslations();
  console.log('\nAll incongruity fixes applied.');
}

main().catch(e => { console.error(e); process.exit(1); });
