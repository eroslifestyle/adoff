// test-dnr-quota-live-firefox-rdp.js — Firefox reale: web-ext lancia FF con RDP, qui ci si
// connette, installa l'addon temporaneo via addonsActor, attach + evaluateJS nel contesto
// esteso (privilegi chrome.*) e misura le costanti DNR + prova di carico + cleanup.
// Uso: node test-dnr-quota-live-firefox-rdp.js   (richiede web-ext nel PATH e xvfb se headless)

const net = require('net');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXT_DIR = path.resolve(__dirname, '../../app-firefox');

// ---------- RDP mini client ----------
class RDP {
    constructor(port) {
        this.port = port; this.buf = ''; this.pending = [];
    }
    connect() {
        return new Promise((res, rej) => {
            this.sock = net.connect(this.port, '127.0.0.1', res);
            this.sock.on('data', (d) => this._onData(d));
            this.sock.on('error', rej);
            setTimeout(() => rej(new Error('RDP connect timeout')), 10000);
        });
    }
    _onData(d) {
        this.buf += d.toString();
        for (;;) {
            const m = this.buf.match(/^(\d+):/);
            if (!m) break;
            const need = parseInt(m[1]) + m[0].length;
            if (this.buf.length < need) break;
            const raw = this.buf.slice(m[0].length, need);
            this.buf = this.buf.slice(need);
            let pkt; try { pkt = JSON.parse(raw); } catch { continue; }
            // reply vs evento: le reply non hanno `type`, o hanno uno dei type-risposta noti.
            // Eventi (tabListChanged, consoleAPICall, ...) NON devono consumare una reply pending.
            const REPLY_TYPES = ['attached', 'evaluationResult', 'listAddons', 'target-style'];
            const isEvent = pkt.type === 'tabListChanged' || pkt.type === 'consoleAPICall' || pkt.type === 'newMutations' || pkt.type === 'networkEvent' || pkt.type === 'propertyIterator' || pkt.type === 'resource-available-form' || pkt.type === 'resources-available-array' || pkt.type === 'testcat-list';
            const isReply = pkt.type === undefined || (!isEvent && !pkt.isEvent);
            const key = pkt.from || null;
            const q = isReply ? (this.pending[key] || []) : [];
            if (q.length) q.shift()(pkt);
            else (this.events = this.events || []).push(pkt);
        }
    }
    send(obj) {
        return new Promise((res, rej) => {
            const j = JSON.stringify(obj);
            const key = obj.to || null;
            this.pending = this.pending || {};
            (this.pending[key] = this.pending[key] || []).push(res);
            this.sock.write(j.length + ':' + j);
            setTimeout(() => rej(new Error('RDP timeout su ' + obj.type)), 60000);
        });
    }
    close() { try { this.sock.destroy(); } catch {} }
}

const PROBE_SRC = `(async () => {
  const d = chrome.declarativeNetRequest;
  return {
    ua: navigator.userAgent,
    MAX_NUMBER_OF_DYNAMIC_RULES: (typeof d.MAX_NUMBER_OF_DYNAMIC_RULES !== "undefined") ? d.MAX_NUMBER_OF_DYNAMIC_RULES : null,
    MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: (typeof d.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES !== "undefined") ? d.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES : null,
    MAX_NUMBER_OF_STATIC_RULESETS: (typeof d.MAX_NUMBER_OF_STATIC_RULESETS !== "undefined") ? d.MAX_NUMBER_OF_STATIC_RULESETS : null,
    GUARANTEED_MINIMUM_STATIC_RULES: (typeof d.GUARANTEED_MINIMUM_STATIC_RULES !== "undefined") ? d.GUARANTEED_MINIMUM_STATIC_RULES : null,
    enabledRulesets: await d.getEnabledRulesets(),
    dynamicRulesCount: (await d.getDynamicRules()).length
  };
})()`;

const LOAD_SRC = `(async () => {
  const d = chrome.declarativeNetRequest;
  const mk = (id) => ({ id, priority: 1, action: { type: "block" },
    condition: { urlFilter: "dnr-quota-probe.invalid", resourceTypes: ["main_frame"] } });
  const add = async (ids) => { await d.updateDynamicRules({ addRules: ids }); };
  const del = async (ids) => { try { await d.updateDynamicRules({ removeRuleIds: ids }); } catch (e) {} };
  const count = async () => (await d.getDynamicRules()).length;
  const declared = d.MAX_NUMBER_OF_DYNAMIC_RULES || 0;
  const baseline = await count();
  const block = 5000;
  let nextId = 2000000;
  let lastGood = baseline, firstBlockError = null;
  const attempted = [];
  while (true) {
    const ids = []; for (let i = 0; i < block; i++) ids.push(nextId++);
    try { await add(ids); } catch (e) { firstBlockError = String(e && e.message || e); break; }
    attempted.push(...ids);
    lastGood = await count();
    if (lastGood >= declared) break;
  }
  let remaining = declared - lastGood;
  while (remaining > 0) {
    const ids = []; for (let i = 0; i < remaining; i++) ids.push(nextId++);
    let ok = true;
    try { await add(ids); } catch (e) { ok = false; }
    if (!ok) { del(ids); nextId -= ids.length; remaining = Math.floor(remaining / 2); continue; }
    attempted.push(...ids);
    lastGood = await count();
    break;
  }
  const oneMore = nextId++;
  let oneMoreOk = true, oneMoreMsg = null;
  try { await add([mk(oneMore)]); attempted.push(oneMore); }
  catch (e) { oneMoreOk = false; oneMoreMsg = String(e && e.message || e); }
  for (let i = 0; i < attempted.length; i += 10000) await del(attempted.slice(i, i + 10000));
  const after = await count();
  return { declaredMax: declared, baseline, maxCountReached: lastGood,
    firstBlockError, oneMoreCount: lastGood + 1, oneMoreErrorMessage: oneMoreMsg,
    oneMorePassed: oneMoreOk, dynamicAfterCleanup: after };
})()`;

function getRdpPort() {
    // la porta compare nella cmdline di firefox (--start-debugger-server NNNN)
    const out = execSync("ps -eo args | grep -o 'start-debugger-server [0-9]*' | head -1").toString();
    const m = out.match(/(\d+)/);
    return m ? parseInt(m[1]) : null;
}

async function main() {
    // Modalita' A: RDP_PORT env -> connetti a firefox gia' in esecuzione (web-ext lanciato a parte).
    // Modalita' B: lancia web-ext da qui.
    const externalPort = process.env.RDP_PORT ? parseInt(process.env.RDP_PORT) : null;
    if (externalPort) return runClientOnly(externalPort);
    const ffProfile = '/tmp/ffx-rdp-quota-profile-' + Date.now();
    fs.mkdirSync(ffProfile, { recursive: true }); // web-ext richiede che il path esista
    const webext = spawn('web-ext', [
        'run', '--source-dir', EXT_DIR,
        '--firefox-profile', ffProfile,
        '--start-url', 'about:blank', '--keep-profile-changes',
        '--pref', 'devtools.debugger.remote-enabled=true',
        '--pref', 'devtools.debugger.prompt-connection=false',
    ], { stdio: ['pipe', 'pipe', 'pipe'] }); // stdin pipe MAI chiuso: web-ext run esce alla chiusura di stdin
    webext.stdout.on('data', (d) => process.stdout.write('[web-ext] ' + d));
    webext.stderr.on('data', (d) => process.stdout.write('[web-ext!] ' + d));
    webext.on('exit', (c) => console.log('[web-ext] exit ' + c));
    let rdp = null;
    try {
        // aspetta che firefox sia su con la porta RDP
        let port = null;
        for (let i = 0; i < 30 && !port; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            port = getRdpPort();
        }
        if (!port) throw new Error('porta RDP non trovata nella cmdline di firefox');
        console.log('[rdp-port]', port);
        // firefox apre il socket solo a boot completato: retry su ECONNREFUSED
        rdp = new RDP(port);
        for (let i = 0; i < 30; i++) {
            try { await rdp.connect(); break; }
            catch (e) {
                if (i === 29) throw e;
                if (!/ECONNREFUSED|connect timeout/.test(e.message)) throw e;
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
        console.log('[rdp] connesso');

        const root = await rdp.send({ to: 'root', type: 'getRoot' });
        console.log('[root] ok, type=' + root.applicationType);

        // web-ext installa gia' l'addon da solo: aspetta che compaia in listAddons e attacca l'actor.
        let addon = null;
        for (let i = 0; i < 30 && !addon; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const addons = await rdp.send({ to: 'root', type: 'listAddons' });
            const list = addons.addons || [];
            addon = list.find((a) => /adoff/i.test(a.id || a.name || ''));
            if (i === 0) console.log('[listAddons] ' + JSON.stringify(list).slice(0, 300));
        }
        if (!addon) throw new Error('addon adoff non trovato in listAddons entro 30s');
        console.log('[addon] ' + JSON.stringify(addon).slice(0, 300));

        const attached = await rdp.send({ to: addon.actor, type: 'attach' });
        const consoleActor = attached.consoleActor;
        if (!consoleActor) throw new Error('consoleActor mancante: ' + JSON.stringify(attached).slice(0, 300));
        console.log('[attach] consoleActor ok');

        const ev = async (src) => {
            const r = await rdp.send({ to: consoleActor, type: 'evaluateJSAsync', text: src });
            if (r.exceptionMessage) throw new Error('JS exception: ' + r.exceptionMessage);
            // evaluateJSAsync ritorna un form; estrai il valore
            const f = r.result && r.result.type === 'object' ? r.result : r.result;
            // per oggetti ritorna grip: chiedi la forma json
            return { raw: r.result, gripType: r.result && r.result.type, gripValue: r.result && r.result.preview ? r.result.preview : null, gripOwn: r.result && (r.result.ownProperties || null), gripSafe: r.result && r.result.displayValue !== undefined ? r.result.displayValue : null };
        };

        // evaluateJSAsync su oggetti ritorna grip senza valori: uso evaluateJS con JSON.stringify
        const evJson = async (src) => {
            const wrapped = src.replace(/\}\)\(\)$/, ').then(x => JSON.stringify(x)).catch(e => { throw new Error("JSERR " + (e && e.message || e)); })()');
            const r = await rdp.send({ to: consoleActor, type: 'evaluateJSAsync', text: wrapped });
            if (r.exceptionMessage) throw new Error('JS exception: ' + r.exceptionMessage);
            return JSON.parse(r.result.value);
        };

        const probe = await evJson(PROBE_SRC);
        console.log('PROBE ' + JSON.stringify(probe, null, 2));

        const load = await evJson(LOAD_SRC);
        console.log('LOAD ' + JSON.stringify(load, null, 2));
    } finally {
        if (rdp) rdp.close();
        webext.kill();
        await new Promise((r) => setTimeout(r, 2000));
        try { execSync(`rm -rf ${JSON.stringify(ffProfile)}`); } catch {}
    }
}

async function runClientOnly(port) {
    // firefox + addon gia' in piedi (web-ext lanciato a parte): connetti e misura
    const rdp = new RDP(port);
    await rdp.connect();
    console.log('[rdp] connesso a porta ' + port);

    const root = await rdp.send({ to: 'root', type: 'getRoot' });
    console.log('[root] ok, type=' + root.applicationType);

    let addon = null;
    for (let i = 0; i < 15 && !addon; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1000));
        const addons = await rdp.send({ to: 'root', type: 'listAddons' });
        const list = addons.addons || [];
        if (i === 0) console.log('[listAddons] ' + JSON.stringify(list).slice(0, 400));
        addon = list.find((a) => /adoff/i.test(a.id || a.name || ''));
    }
    if (!addon) throw new Error('addon adoff non trovato in listAddons');
    console.log('[addon] id=' + (addon.id || addon.name));

    const attached = await rdp.send({ to: addon.actor, type: 'attach' });
    const consoleActor = attached.consoleActor;
    if (!consoleActor) throw new Error('consoleActor mancante: ' + JSON.stringify(attached).slice(0, 300));
    console.log('[attach] ok');

    const evJson = async (src) => {
        const wrapped = '(async () => { return ' + src + ' })().then(x => JSON.stringify(x)).catch(e => JSON.stringify({ JSError: String(e && e.message || e) }))';
        const r = await rdp.send({ to: consoleActor, type: 'evaluateJSAsync', text: wrapped });
        if (r.exceptionMessage) throw new Error('JS exception: ' + r.exceptionMessage);
        if (!r.result || typeof r.result.value !== 'string') {
            throw new Error('risposta inattesa: ' + JSON.stringify(r.result).slice(0, 200));
        }
        return JSON.parse(r.result.value);
    };

    const probe = await evJson(PROBE_SRC);
    console.log('PROBE ' + JSON.stringify(probe, null, 2));

    const load = await evJson(LOAD_SRC);
    console.log('LOAD ' + JSON.stringify(load, null, 2));
    rdp.close();
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
