"use strict";

// Same-origin /api (served by worker route adoff.app/api/*) — avoids cross-subdomain CORS.
const API = (location.hostname === "adoff.app" || location.hostname.endsWith(".adoff.app"))
  ? "/api"
  : "https://api.adoff.app";
// Token admin SOLO in memoria (mai sessionStorage/localStorage): si perde al refresh → re-login.
// Timeout inattivita': dopo ADMIN_SESSION_TIMEOUT_MS senza azioni il token e' invalidato.
let token = "";
const ADMIN_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minuti
let _adminIdleTimer = null;
function _resetAdminIdleTimer() {
  clearTimeout(_adminIdleTimer);
  if (!token) return;
  _adminIdleTimer = setTimeout(() => { doLogout(); }, ADMIN_SESSION_TIMEOUT_MS);
}
["click", "keydown", "mousemove", "touchstart"].forEach(ev =>
  document.addEventListener(ev, () => { if (token) _resetAdminIdleTimer(); }, { passive: true }));
let currentPage = "stats";
let licData = [];
const charts = {};

// ── API HELPER ──────────────────────────────────────────────
let _logoutScheduled = false;
// Anti-loop client-side: dedup delle GET identiche ravvicinate. Un tab lasciato
// aperto pollava /admin/seo a ~82 req/min saturando la quota KV → login+admin down.
// Qui le GET uguali entro GET_DEDUP_MS riusano la stessa Promise in volo o l'ultima
// risposta recente, senza rifare la fetch. TTL breve → i refresh manuali restano vivi.
const GET_DEDUP_MS = 3000;
const _getInflight = new Map();  // path -> Promise
const _getRecent = new Map();    // path -> { at, data }
// Circuit breaker: se un path viene chiamato in modo anomalo (loop runtime), lo
// frena e lo rende VISIBILE in console invece di lasciarlo bruciare quota in silenzio.
const _callTimes = new Map();    // path -> [timestamps]
const CB_WINDOW_MS = 10000;      // finestra 10s
const CB_MAX_CALLS = 15;         // > 15 chiamate/10s = loop sospetto
function _circuitOpen(path, now) {
  let arr = _callTimes.get(path) || [];
  arr = arr.filter(t => now - t < CB_WINDOW_MS);
  arr.push(now);
  _callTimes.set(path, arr);
  if (arr.length > CB_MAX_CALLS) {
    console.warn(`[AdOff admin] Loop rilevato su ${path} (${arr.length} chiamate/10s) — richiesta frenata. Chiudi/ricarica il tab.`);
    return true;
  }
  return false;
}
async function api(path, opts = {}) {
  const method = (opts.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const now = Date.now();

  if (isGet) {
    const inflight = _getInflight.get(path);
    if (inflight) return inflight;                       // stessa GET gia' in volo
    const recent = _getRecent.get(path);
    if (recent && (now - recent.at) < GET_DEDUP_MS) return recent.data; // risposta fresca
    // Tab nascosto: non pollare (riduce burn quota quando la dashboard e' in background).
    if (document.hidden && recent) return recent.data;
    if (_circuitOpen(path, now)) {
      return recent ? recent.data : { ok: false, error: "rate-limited-client" };
    }
  }

  const h = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) h["X-Admin-Token"] = token;

  const run = (async () => {
    try {
      const r = await fetch(API + path, { ...opts, headers: h });
      const data = await r.json();
      if (r.status === 401) {
        // Schedule logout once — avoid duplicate doLogout() from parallel requests
        if (!_logoutScheduled) {
          _logoutScheduled = true;
          setTimeout(() => { _logoutScheduled = false; doLogout(); }, 50);
        }
        return { ok: false, error: "Sessione scaduta" };
      }
      if (isGet) _getRecent.set(path, { at: Date.now(), data });
      return data;
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      if (isGet) _getInflight.delete(path);
    }
  })();

  if (isGet) _getInflight.set(path, run);
  return run;
}

// ── TOAST ───────────────────────────────────────────────────
function toast(msg, type = "success") {
  const wrap = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = type === "success" ? "✓" : "✕";
  const body = document.createElement("span");
  body.textContent = msg; // mai innerHTML: i messaggi possono contenere errori API
  el.append(icon, body);
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; el.style.transition = ".3s"; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── AUTH ─────────────────────────────────────────────────────
function showPanel(name) {
  document.getElementById("loginBox").style.display = name === "login" ? "" : "none";
  document.getElementById("forgotBox").style.display = name === "forgot" ? "" : "none";
  document.getElementById("resetBox").style.display = name === "reset" ? "" : "none";
}

async function doLogin() {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value;
  const err = document.getElementById("loginErr");
  err.className = "err";
  if (!u || !p) { err.textContent = "Inserisci username e password"; err.className = "err show"; return; }
  const btn = event.target;
  btn.disabled = true; btn.textContent = "Accesso...";
  const d = await api("/admin/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
  btn.disabled = false; btn.textContent = "Accedi";
  if (!d.ok) { err.textContent = d.error || "Credenziali non valide"; err.className = "err show"; return; }
  token = d.token;
  _resetAdminIdleTimer();
  document.getElementById("adminName").textContent = d.username || "Admin";
  startApp();
}

// Login super-admin via Google: solo l'email ADMIN_GOOGLE_EMAIL ottiene la sessione admin
// (gli account Google degli utenti normali vengono respinti lato worker).
function loginGoogle() {
  window.location.href = API + "/oauth/google-admin/start";
}

async function doForgot() {
  const email = document.getElementById("forgotEmail").value.trim();
  const err = document.getElementById("forgotErr");
  const ok = document.getElementById("forgotOk");
  err.className = "err"; ok.className = "ok-msg";
  if (!email) { err.textContent = "Inserisci l'email"; err.className = "err show"; return; }
  const btn = event.target; btn.disabled = true;
  const d = await api("/admin/reset-password", { method: "POST", body: JSON.stringify({ email }) });
  btn.disabled = false;
  if (!d.ok) { err.textContent = d.error || "Errore"; err.className = "err show"; return; }
  ok.textContent = "Email inviata! Controlla la tua casella."; ok.className = "ok-msg show";
}

async function doReset() {
  const resetToken = new URLSearchParams(location.search).get("reset");
  const p1 = document.getElementById("resetPass").value;
  const p2 = document.getElementById("resetPass2").value;
  const err = document.getElementById("resetErr");
  const ok = document.getElementById("resetOk");
  err.className = "err"; ok.className = "ok-msg";
  if (p1.length < 8) { err.textContent = "Minimo 8 caratteri"; err.className = "err show"; return; }
  if (p1 !== p2) { err.textContent = "Le password non coincidono"; err.className = "err show"; return; }
  const btn = event.target; btn.disabled = true;
  const d = await api("/admin/reset-confirm", { method: "POST", body: JSON.stringify({ token: resetToken, newPassword: p1 }) });
  btn.disabled = false;
  if (!d.ok) { err.textContent = d.error || "Errore"; err.className = "err show"; return; }
  ok.textContent = "Password aggiornata! Reindirizzamento..."; ok.className = "ok-msg show";
  setTimeout(() => { history.replaceState({}, "", "/admin"); showPanel("login"); }, 2000);
}

function doLogout() {
  token = "";
  clearTimeout(_adminIdleTimer);
  document.getElementById("app").className = "app";
  document.getElementById("loginWrap").style.display = "";
  showPanel("login");
}

// ── APP START ────────────────────────────────────────────────
function startApp() {
  document.getElementById("loginWrap").style.display = "none";
  document.getElementById("app").className = "app show";
  document.getElementById("apiEndpoint").textContent = location.origin || "same-origin";
  navTo("stats");
}

async function init() {
  // Callback login Google: il worker reindirizza con #token=... (successo) o #error=... (negato)
  if (location.hash && location.hash.length > 1) {
    const hp = new URLSearchParams(location.hash.slice(1));
    const ht = hp.get("token"), he = hp.get("error");
    if (ht || he) {
      history.replaceState({}, "", location.pathname); // rimuovi subito il token dall'URL
      if (ht) {
        token = ht;
        _resetAdminIdleTimer();
      } else {
        showPanel("login");
        const el = document.getElementById("loginErr");
        el.textContent = he === "not_authorized"
          ? "Questo account Google non è autorizzato come amministratore."
          : "Login Google non riuscito. Riprova.";
        el.className = "err show";
      }
    }
  }
  const resetToken = new URLSearchParams(location.search).get("reset");
  if (resetToken) { showPanel("reset"); return; }
  if (token) {
    // Verify token is still valid before showing dashboard
    const check = await api("/admin/stats");
    if (!check.ok) {
      // Token expired or invalid — clear and show login
      token = "";
      clearTimeout(_adminIdleTimer);
      showPanel("login");
    } else {
      _resetAdminIdleTimer();
      document.getElementById("loginWrap").style.display = "none";
      document.getElementById("app").className = "app show";
      document.getElementById("apiEndpoint").textContent = location.origin || "same-origin";
      navTo("stats");
    }
  }
  // Enter key on login
  document.getElementById("loginPass").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  document.getElementById("loginUser").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("loginPass").focus(); });

  // Auto-refresh: un solo interval globale, ricarica solo la pagina attiva se il tab è visibile
  setInterval(() => {
    if (token && document.visibilityState === "visible") refreshCurrentPage();
  }, 60000);
}

// ── NAVIGATION ───────────────────────────────────────────────
const PAGE_TITLES = { stats:"Statistiche", efficacia:"Efficacia", registrazioni:"Registrazioni", seoagent:"Agente SEO", licenses:"Licenze", finance:"Finanza", outreach:"Outreach", support:"Supporto", suggestions:"Suggerimenti", messages:"Messaggi", chat:"Chat AI", settings:"Impostazioni" };

function navTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add("active");
  document.getElementById("topbarTitle").textContent = PAGE_TITLES[page] || page;
  currentPage = page;
  closeSidebar();
  loadPage(page);
}

function refreshCurrentPage() { loadPage(currentPage, true); }

// Cambio tab nel pool Statistiche (KPI restano fissi sopra).
function switchStatsTab(name) {
  document.querySelectorAll("#page-stats .stat-tab").forEach(t => t.classList.toggle("active", t.getAttribute("data-tab") === name));
  document.querySelectorAll("#page-stats .stat-panel").forEach(p => p.classList.toggle("active", p.getAttribute("data-panel") === name));
  // Chart.js non calcola le dimensioni quando il canvas è in display:none → ridimensiona ora che è visibile
  ["stNetChart", "stRevenueChart", "stPlanChart"].forEach(id => { if (charts[id] && charts[id].resize) charts[id].resize(); });
  if (name === "seo") { loadSeo(); return; }
  if (name === "autofix") { loadAutofix(); return; }
}

// ponytail: TTL a livello router — invalida i flag *Loaded delle singole sezioni
// (one-shot, mai disarmati) senza doverli toccare uno per uno. Senza questo, una
// dashboard lasciata aperta mostra per sempre i dati del primo caricamento.
const _pageLoadedAt = {};
const PAGE_TTL_MS = 60000;

function loadPage(page, force = false) {
  if (!force && Date.now() - (_pageLoadedAt[page] || 0) > PAGE_TTL_MS) force = true;
  // il timestamp segna l'ultimo CARICAMENTO, non l'ultima visita: aggiornarlo
  // sempre slitta il TTL in avanti a ogni rientro e la pagina non si ricarica mai piu'
  if (force) _pageLoadedAt[page] = Date.now();
  if (page === "dashboard") loadDashboard(force);
  else if (page === "licenses") loadLicenses(force);
  else if (page === "finance") loadFinance(force);
  else if (page === "analytics") loadAnalytics(force);
  else if (page === "stats") { loadStats(force); loadSeo(); }
  else if (page === "efficacia") loadEfficacia(force);
  else if (page === "registrazioni") loadRegistrazioni(force);
  else if (page === "seoagent") loadSeoAgent(force);
  else if (page === "outreach") loadOutreach(force);
  else if (page === "support") loadTickets(force);
  else if (page === "suggestions") loadSuggestions(force);
  else if (page === "messages") loadMessages(force);
  else if (page === "chat") loadChats(force);
}

// ── OUTREACH TRACKER (integrato nell'admin) ──────────────────
let _outState = { records:{}, refCounts:{} };
let _outLoaded = false;
const OUT_TIERS = { p1:"Priorità 1 · review site", p2:"Priorità 2 · privacy authority", p3:"Priorità 3 · creator FOSS" };
const OUT_ITEMS = [
  {id:"o1",pri:"p1",t:"Cybernews",c:"Form contatto (footer cybernews.com)"},
  {id:"o2",pri:"p1",t:"TechRadar Pro",c:"PR/contact form"},
  {id:"o3",pri:"p1",t:"PCRisk",c:"press@pcrisk.com"},
  {id:"o4",pri:"p1",t:"ProPrivacy",c:"Contact / affiliate inquiry"},
  {id:"o5",pri:"p1",t:"Restore Privacy",c:"Contact form"},
  {id:"o6",pri:"p1",t:"All About Cookies",c:"Contact form"},
  {id:"o7",pri:"p1",t:"Ad Block Tester",c:"Contact form"},
  {id:"o8",pri:"p1",t:"Privacy Guides (forum)",c:"discuss.privacyguides.net — NO payment"},
  {id:"o9",pri:"p2",t:"Naomi Brockwell (NBTV)",c:"contact@nbtv.media"},
  {id:"o10",pri:"p2",t:"Techlore",c:"contact@techlore.tech"},
  {id:"o11",pri:"p2",t:"The Hated One",c:"Patreon / community post"},
  {id:"o12",pri:"p2",t:"Rob Braxman",c:"brax.me secure contact"},
  {id:"o13",pri:"p3",t:"DistroTube (Derek)",c:"derek@distrotube.com"},
  {id:"o14",pri:"p3",t:"Luke Smith",c:"luke@lukesmith.xyz"},
  {id:"o15",pri:"p3",t:"It's FOSS (Abhishek)",c:"hello@itsfoss.com"},
];
function _outBorder(s){ return s==="won"?"#4ade80":s==="reply"?"#fbbf24":s==="lost"?"#444":s?"var(--accent)":"var(--border)"; }
async function loadOutreach(force=false){
  if(_outLoaded && !force) return;
  const wrap=document.getElementById("outreachList");
  wrap.innerHTML='<div class="loading-center"><div class="loader"></div></div>';
  const d=await api("/admin/outreach");
  if(!d.ok){ wrap.innerHTML='<div class="loading-center" style="color:var(--danger)">Errore: '+(d.error||"")+'</div>'; return; }
  _outState={records:d.records||{}, refCounts:d.refCounts||{}}; _outLoaded=true;
  renderOutreach();
}
function renderOutreach(){
  const wrap=document.getElementById("outreachList"); wrap.innerHTML=""; let lastPri="";
  OUT_ITEMS.forEach(it=>{
    if(it.pri!==lastPri){ const h=document.createElement("div"); h.className="card-title"; h.style.margin="18px 0 6px"; h.textContent=OUT_TIERS[it.pri]; wrap.appendChild(h); lastPri=it.pri; }
    const rec=_outState.records[it.id]||{}; const rc=rec.refCode||"";
    const conv=rc&&_outState.refCounts[rc.toUpperCase()];
    const convTxt=rc?(conv?conv.count+" conversioni · €"+(conv.revenueCents/100).toFixed(2):"0 conversioni"):"—";
    const card=document.createElement("div"); card.className="card"; card.style.marginBottom="10px"; card.id="oc-"+it.id;
    card.style.borderColor=_outBorder(rec.status);
    card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px"><b>'+it.t+'</b><span style="font-size:11px;color:var(--muted)">'+it.c+'</span></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">'
      +'<select data-oid="'+it.id+'" data-f="status" style="background:var(--input);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 8px;font-size:12px"><option value="">Da inviare</option><option value="sent">Inviato</option><option value="reply">Risposta</option><option value="won">Esito +</option><option value="lost">Esito −</option></select>'
      +'<input data-oid="'+it.id+'" data-f="note" placeholder="note / data" style="flex:1;min-width:140px;background:var(--input);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 8px;font-size:12px">'
      +'<input data-oid="'+it.id+'" data-f="refCode" placeholder="referral code" style="max-width:190px;background:var(--input);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 8px;font-size:12px"></div>'
      +'<div style="font-size:12px;color:'+(conv?"#4ade80":"var(--muted)")+';margin-top:6px">Conversioni: '+convTxt+'</div>';
    wrap.appendChild(card);
    card.querySelector('[data-f="status"]').value=rec.status||"";
    card.querySelector('[data-f="note"]').value=rec.note||"";
    card.querySelector('[data-f="refCode"]').value=rc;
  });
  wrap.querySelectorAll("[data-oid]").forEach(el=>{
    const ev=el.tagName==="SELECT"?"change":"input"; let t;
    el.addEventListener(ev,()=>{ clearTimeout(t); t=setTimeout(()=>saveOutreach(el.dataset.oid), el.tagName==="SELECT"?0:600); });
  });
  updateOutreachSum();
}
async function saveOutreach(id){
  const card=document.getElementById("oc-"+id);
  const body={ id, status:card.querySelector('[data-f="status"]').value, note:card.querySelector('[data-f="note"]').value, refCode:card.querySelector('[data-f="refCode"]').value };
  const d=await api("/admin/outreach-update",{method:"POST",body:JSON.stringify(body)});
  if(d.ok){ _outState.records[id]=d.record; card.style.borderColor=_outBorder(body.status); updateOutreachSum(); }
  else toast(d.error||"Errore salvataggio","error");
}
function updateOutreachSum(){
  const recs=OUT_ITEMS.map(i=>_outState.records[i.id]||{});
  const sent=recs.filter(r=>r.status).length, reply=recs.filter(r=>["reply","won","lost"].includes(r.status)).length, won=recs.filter(r=>r.status==="won").length;
  let conv=0,rev=0; for(const k in _outState.refCounts){conv+=_outState.refCounts[k].count;rev+=_outState.refCounts[k].revenueCents;}
  const el=document.getElementById("outreachSum");
  if(el)el.innerHTML='📊 <b style="color:var(--text)">'+sent+'/'+OUT_ITEMS.length+'</b> contattati · <b style="color:var(--text)">'+reply+'</b> risposte · <b style="color:var(--text)">'+won+'</b> esiti + · 💶 <b style="color:var(--text)">'+conv+'</b> conversioni (€'+(rev/100).toFixed(2)+')';
}
function genOutreachCode(){
  const n=(document.getElementById("orefname").value||"").trim();
  const out=document.getElementById("orefout"), reg=document.getElementById("orefreg");
  if(!n){ out.textContent=""; reg.style.display="none"; return; }
  const code=n.toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-+|-+$/g,"")+"-Q2-2026";
  out.textContent=code; reg.style.display=""; reg.dataset.code=code;
}
async function registerOutreachCode(){
  const code=document.getElementById("orefreg").dataset.code; const msg=document.getElementById("orefmsg");
  const d=await api("/admin/outreach-code",{method:"POST",body:JSON.stringify({code})});
  if(d.ok){ msg.innerHTML='✓ Codice <b>'+code+'</b> '+(d.already?"già registrato":"registrato")+'. Link creator: <b>https://adoff.app/r/'+code+'</b>'; toast("Codice registrato"); }
  else { msg.innerHTML='<span style="color:var(--danger)">Errore: '+(d.error||"")+'</span>'; }
}

// ── CHAT AI (storico conversazioni chatbot) ──────────────────
let chatsLoaded = false;
async function loadChats(force = false) {
  if (chatsLoaded && !force) return;
  document.getElementById("chatTableWrap").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const d = await api("/admin/chats");
  if (!d.ok) {
    document.getElementById("chatTableWrap").innerHTML = `<div class="loading-center" style="color:var(--danger)">Errore: ${esc(d.error || "Impossibile caricare le chat")}</div>`;
    return;
  }
  const chats = d.chats || [];
  chatsLoaded = true;
  if (!chats.length) {
    document.getElementById("chatTableWrap").innerHTML = `<div class="empty"><div class="empty-icon">🤖</div><p>Nessuna conversazione registrata</p></div>`;
    return;
  }
  document.getElementById("chatTableWrap").innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Inizio</th><th>Lingua</th><th>Messaggi</th><th>Escalation</th><th>Email</th><th>Anteprima</th><th></th>
      </tr></thead>
      <tbody>
        ${chats.map(c => `<tr>
          <td style="color:var(--muted)">${c.updatedAt ? new Date(c.updatedAt).toLocaleString("it-IT") : "–"}</td>
          <td><span class="mono">${esc((c.lang || "–").toUpperCase())}</span></td>
          <td>${Number(c.msgCount) || 0}</td>
          <td>${c.escalated ? `<span class="badge badge-open">sì${c.ticketId ? " · " + esc(c.ticketId) : ""}</span>` : `<span style="color:var(--muted)">no</span>`}</td>
          <td style="color:var(--muted)">${esc(c.email || "–")}</td>
          <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.preview || "")}</td>
          <td><button class="btn btn-sm btn-outline" data-chat-sid="${esc(c.sessionId)}">Apri</button></td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-chat-sid]");
  if (btn) openChat(btn.dataset.chatSid);
});

async function openChat(sid) {
  document.getElementById("ticketModalTitle").textContent = `Conversazione ${sid.slice(0,8)}…`;
  document.getElementById("ticketDetail").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  openModal("ticketModal");
  const d = await api(`/admin/chat/${sid}`);
  if (!d.ok) { document.getElementById("ticketDetail").innerHTML = `<p style="color:var(--danger)">Errore: ${esc(d.error)}</p>`; return; }
  const c = d.chat || {};
  const msgs = c.messages || [];
  const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  document.getElementById("ticketDetail").innerHTML = `
    <div style="margin-bottom:12px;color:var(--muted);font-size:12px">
      ${esc((c.lang||"").toUpperCase())} · ${Number(msgs.length) || 0} messaggi · ${esc(c.email || "nessuna email")}
      ${c.escalated ? ` · <span class="badge badge-open">escalata${c.ticketId ? " " + esc(c.ticketId) : ""}</span>` : ""}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow-y:auto">
      ${msgs.map(m => `
        <div style="align-self:${m.role==="user"?"flex-end":"flex-start"};max-width:80%;padding:9px 13px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;background:${m.role==="user"?"var(--accent)":"var(--input)"};color:${m.role==="user"?"#fff":"var(--text)"}">${esc(m.content)}</div>
      `).join("")}
    </div>`;
}

// ── SIDEBAR (MOBILE) ─────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// ── MODAL ────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add("show"); }
function closeModal(id) { document.getElementById(id).classList.remove("show"); }

// ── CHART DEFAULTS ───────────────────────────────────────────
Chart.defaults.color = "#6a6a8a";
Chart.defaults.borderColor = "#2a2a4a";
Chart.defaults.font.family = "system-ui,-apple-system,sans-serif";
Chart.defaults.font.size = 11;

function mkChart(id, type, labels, datasets, opts = {}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id)?.getContext("2d");
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: opts.legend ?? false, labels: { color: "#9a9ab0", boxWidth: 12, padding: 16 } } },
      scales: type === "doughnut" ? {} : {
        x: { grid: { color: "#1e1e3a" }, ticks: { color: "#6a6a8a" } },
        y: { grid: { color: "#1e1e3a" }, ticks: { color: "#6a6a8a" } }
      },
      ...opts
    }
  });
}

// ── FLAG ─────────────────────────────────────────────────────
function flag(code) {
  if (!code || code.length !== 2) return "🌍";
  try { return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); }
  catch { return "🌍"; }
}

// ── TIME ─────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s fa`;
  if (s < 3600) return `${Math.floor(s/60)}m fa`;
  if (s < 86400) return `${Math.floor(s/3600)}h fa`;
  return `${Math.floor(s/86400)}g fa`;
}

function fmtDate(ts) {
  if (!ts) return "–";
  return new Date(ts * 1000).toLocaleDateString("it-IT", { day:"2-digit", month:"short", year:"numeric" });
}

function fmtMoney(cents) {
  return (cents / 100).toFixed(2) + " €";
}

// ── COPY ─────────────────────────────────────────────────────
function copyKey(text) {
  navigator.clipboard?.writeText(text).then(() => toast("Key copiata!")).catch(() => toast("Errore copia", "error"));
}

// ── DASHBOARD ────────────────────────────────────────────────
let dashLoaded = false;

async function loadDashboard(force = false) {
  if (dashLoaded && !force) return;
  dashLoaded = false;
  // Show spinner immediately (replaces static HTML spinner)
  document.getElementById("dash-stats").innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="loader"></div></div>`;
  document.getElementById("recentInstalls").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const [stats, rev, ana] = await Promise.all([
    api("/admin/stats"),
    api("/admin/revenue"),
    api("/admin/analytics")
  ]);

  if (!stats.ok) {
    document.getElementById("dash-stats").innerHTML = `<div class="loading-center" style="grid-column:1/-1;color:var(--danger)">Errore: ${stats.error || "Impossibile caricare dati"}</div>`;
    document.getElementById("recentInstalls").innerHTML = "";
    toast("Errore caricamento stats", "error");
    return;
  }

  // Stat cards
  const lic = stats.licenses || {};
  const sales = stats.sales || {};
  const devs = stats.devices || {};
  const revData = rev.revenue || {};
  const anaData = ana.installs || {};
  const dlData = ana.downloads || {};

  document.getElementById("dash-stats").innerHTML = `
    ${sc("Licenze Totali", lic.total ?? 0, "")}
    ${sc("Attive", lic.active ?? 0, "green")}
    ${sc("Lifetime", lic.lifetime ?? 0, "gold")}
    ${sc("Scadute", lic.expired ?? 0, "red")}
    ${sc("Dispositivi", devs.total ?? 0, "")}
    ${sc("Vendute totali", sales.totalSold ?? 0, "")}
    ${sc("Installazioni", anaData.total ?? 0, "")}
    ${sc("Download totali", dlData.total ?? 0, "")}
  `;

  // Revenue chart (last 7 of last 30 days)
  const last30 = revData.last30days || [];
  const last7 = last30.slice(-7);
  const rlabels = last7.map(d => d.date?.slice(5) || "");
  const rvals = last7.map(d => (d.amount || 0) / 100);
  mkChart("dashRevenueChart", "bar", rlabels, [{
    data: rvals, backgroundColor: "rgba(124,92,252,.7)", borderRadius: 6, borderSkipped: false
  }]);

  // Plan distribution chart
  const plans = stats.plans || {};
  const planKeys = Object.keys(plans);
  const planVals = planKeys.map(k => plans[k]);
  const planColors = { monthly: "#7c5cfc", annual: "#4ade80", lifetime: "#fbbf24", unknown: "#6a6a8a" };
  mkChart("dashPlanChart", "doughnut", planKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), [{
    data: planVals,
    backgroundColor: planKeys.map(k => planColors[k] || "#6a6a8a"),
    borderWidth: 0
  }], { legend: true });

  // Recent installs
  const log = anaData.recentLog || [];
  const instWrap = document.getElementById("recentInstalls");
  if (!log.length) {
    instWrap.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>Nessuna installazione registrata</p></div>`;
  } else {
    instWrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Paese</th><th>Città</th><th>Browser</th><th>Sorgente</th><th>Quando</th></tr></thead>
      <tbody>${log.slice(0,10).map(e => `<tr>
        <td>${flag(e.country)} ${e.country || "?"}</td>
        <td>${e.city || "–"}</td>
        <td>${browserBadge(e.browser)}</td>
        <td><span style="color:var(--muted)">${e.source || "–"}</span></td>
        <td style="color:var(--muted)">${timeAgo(e.ts)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  }

  dashLoaded = true;
}

function sc(label, value, cls) {
  return `<div class="stat-card"><div class="stat-val ${cls}">${value.toLocaleString()}</div><div class="stat-label">${label}</div></div>`;
}

function browserBadge(b) {
  const icons = { chrome:"🌐", firefox:"🦊", edge:"🔷", opera:"🔴", other:"❔", unknown:"❔" };
  return `<span style="font-size:13px">${icons[b] || "❔"} ${b || "?"}</span>`;
}

// ── LICENSES ─────────────────────────────────────────────────
let licLoaded = false;

// Pending newly-created licenses, kept until server's KV list catches up.
// Map<key, {license, expiresAt}> — auto-expire after 90s as safety
const pendingNewLicenses = new Map();
const PENDING_TTL_MS = 90000;

async function loadLicenses(force = false) {
  if (licLoaded && !force) return;
  document.getElementById("licTableWrap").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const plan = document.getElementById("licPlan").value;
  const status = document.getElementById("licStatus").value;
  let url = "/admin/licenses?limit=100";
  if (plan) url += `&plan=${plan}`;
  if (status) url += `&status=${status}`;
  const d = await api(url);
  if (!d.ok) { toast("Errore caricamento licenze", "error"); return; }
  let merged = d.licenses || [];

  // Re-inject pending licenses that the server hasn't surfaced yet (KV eventual consistency)
  const now = Date.now();
  for (const [pk, entry] of [...pendingNewLicenses]) {
    if (entry.expiresAt < now) { pendingNewLicenses.delete(pk); continue; }
    const lic = entry.license;
    const seenByServer = merged.some(l => l.key === lic.key || l.raw === lic.raw);
    if (seenByServer) { pendingNewLicenses.delete(pk); continue; }
    // Respect active filters
    if (plan && lic.plan !== plan) continue;
    if (status && lic.status !== status) continue;
    merged = [lic, ...merged];
  }

  licData = merged;
  renderLicTable(licData);
  licLoaded = true;
}

function filterLicenses() {
  const search = document.getElementById("licSearch").value.toLowerCase();
  const plan = document.getElementById("licPlan").value;
  const status = document.getElementById("licStatus").value;
  let filtered = licData;
  if (search) filtered = filtered.filter(l => (l.email || "").toLowerCase().includes(search) || (l.key || l.raw || "").toLowerCase().includes(search));
  if (plan) filtered = filtered.filter(l => l.plan === plan);
  if (status) filtered = filtered.filter(l => l.status === status);
  renderLicTable(filtered);
}

function renderLicTable(data) {
  if (!data.length) {
    document.getElementById("licTableWrap").innerHTML = `<div class="empty"><div class="empty-icon">🔑</div><p>Nessuna licenza trovata</p></div>`;
    updateBulkBar();
    return;
  }
  document.getElementById("licTableWrap").innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="width:36px"><input type="checkbox" id="licSelectAll" style="accent-color:var(--accent);cursor:pointer"></th>
        <th>Key</th><th>Email</th><th>Piano</th><th>Scadenza</th>
        <th>Dispositivi</th><th>Stato</th><th>Azioni</th>
      </tr></thead>
      <tbody id="licTbody">
        ${data.map((l, i) => licRow(l, i)).join("")}
      </tbody>
    </table></div>`;
  updateBulkBar();
}

function licRow(l, i) {
  // Dati API mai in innerHTML: textContent-safe via esc(); azioni via dataset + listener delegato
  const key = l.key || l.raw || "–";
  const keyShort = key.length > 24 ? key.slice(0, 24) + "…" : key;
  const checked = selectedKeys.has(key) ? "checked" : "";
  const planCls = ["monthly","annual","lifetime"].includes(l.plan) ? `badge-${l.plan}` : "badge-active";
  const statCls = l.status === "revoked" ? "badge-revoked" : l.status === "expired" ? "badge-expired" : "badge-active";
  const pct = Math.round((l.devices || 0) / Math.max(l.maxDevices || 1, 1) * 100);
  return `
    <tr id="licRow_${i}">
      <td><input type="checkbox" ${checked} style="accent-color:var(--accent);cursor:pointer" data-lic-key="${esc(key)}" data-role="select"></td>
      <td><span class="mono" title="${esc(key)}">${esc(keyShort)}</span></td>
      <td>${l.email ? esc(l.email) : '<span style="color:var(--muted)">–</span>'}</td>
      <td><span class="badge ${planCls}">${esc(l.plan)}</span></td>
      <td>${esc(l.expiresHuman || "–")}</td>
      <td>
        <span style="font-size:13px">${Number(l.devices) || 0}/${Number(l.maxDevices) || 1}</span>
        <div class="progress" style="width:60px"><div class="progress-fill" style="width:${pct}%"></div></div>
      </td>
      <td><span class="badge ${statCls}">${esc(l.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" title="Copia key" data-lic-action="copy" data-lic-key="${esc(key)}">📋</button>
          <button class="btn-icon" title="Modifica" data-lic-action="edit" data-lic-index="${i}">✏️</button>
          ${l.status !== "revoked" ? `<button class="btn-icon" title="Revoca" style="color:var(--danger)" data-lic-action="revoke" data-lic-key="${esc(key)}" data-lic-index="${i}">⏸</button>` : ""}
          <button class="btn-icon" title="Elimina definitivamente" style="color:var(--danger)" data-lic-action="delete" data-lic-key="${esc(key)}">🗑️</button>
        </div>
      </td>
    </tr>`;
}

// Delegazione click/change tabella licenze (zero inline handler, CSP-safe)
// Delega unica azioni Security-Audit / Autofix (dataset-based, CSP-safe)
document.addEventListener("click", e => {
  const ig = e.target.closest("[data-sa-ignore]");
  if (ig) { saIgnore(ig.dataset.saIgnore); return; }
  const bd = e.target.closest("[data-bulk-decide]");
  if (bd) { const i = bd.dataset.bulkDecide.indexOf(":"); batchDecide(bd.dataset.bulkDecide.slice(0, i), bd.dataset.bulkDecide.slice(i + 1)); return; }
  if (e.target.closest("[data-req-apply]")) { requestApply(); return; }
  const fs = e.target.closest("[data-fetch-shot]");
  if (fs) { fetchShot(fs.dataset.fetchShot); return; }
  const dl = e.target.closest("[data-decide-leak]");
  if (dl) { const i = dl.dataset.decideLeak.indexOf(":"); decideLeak(dl.dataset.decideLeak.slice(0, i), dl.dataset.decideLeak.slice(i + 1)); return; }
  const btn = e.target.closest("[data-lic-action]");
  if (!btn) return;
  const { licAction, licKey, licIndex } = btn.dataset;
  if (licAction === "copy") copyKey(licKey);
  else if (licAction === "edit") openEditModal(Number(licIndex));
  else if (licAction === "revoke") revokeLic(licKey, Number(licIndex));
  else if (licAction === "delete") deleteLic(licKey);
});
document.addEventListener("change", e => {
  if (e.target.dataset && e.target.dataset.role === "select") {
    if (e.target.checked) selectedKeys.add(e.target.dataset.licKey);
    else selectedKeys.delete(e.target.dataset.licKey);
    updateBulkBar();
  }
});

function openEditModal(i) {
  const l = licData[i];
  if (!l) return;
  document.getElementById("editKey").value = l.key || l.raw;
  document.getElementById("editPlan").value = l.plan;
  document.getElementById("editEmail").value = l.email || "";
  document.getElementById("editDevices").value = l.maxDevices || 3;
  document.getElementById("editExpires").value = l.expiresHuman === "LIFETIME" ? "" : (l.expiresHuman || "");
  openModal("editModal");
}

async function saveLicense() {
  const key = document.getElementById("editKey").value;
  const plan = document.getElementById("editPlan").value;
  const email = document.getElementById("editEmail").value;
  const deviceLimit = parseInt(document.getElementById("editDevices").value);
  const expiresStr = document.getElementById("editExpires").value;
  const expires = expiresStr ? Math.floor(new Date(expiresStr).getTime() / 1000) : null;
  const body = { key, plan, email, deviceLimit };
  if (expires) body.expires = expires;
  const btn = event.target; btn.disabled = true; btn.textContent = "Salvando...";
  const d = await api("/admin/license-update", { method: "POST", body: JSON.stringify(body) });
  btn.disabled = false; btn.textContent = "Salva modifiche";
  if (!d.ok) { toast(d.error || "Errore salvataggio", "error"); return; }
  toast("Licenza aggiornata");
  closeModal("editModal");
  licLoaded = false;
  loadLicenses(true);
}

async function revokeLic(key, i) {
  if (!confirm("Revocare questa licenza? L'azione è irreversibile.")) return;
  const d = await api("/revoke", { method: "POST", body: JSON.stringify({ key }) });
  if (!d.ok) { toast(d.error || "Errore revoca", "error"); return; }
  toast("Licenza revocata");
  licData[i].status = "revoked";
  filterLicenses();
}

function toggleNewLicForm() {
  const f = document.getElementById("newLicForm");
  f.style.display = f.style.display === "none" ? "" : "none";
}

async function generateKey() {
  const plan = document.getElementById("nlPlan").value;
  const months = parseInt(document.getElementById("nlMonths").value) || 1;
  const email = document.getElementById("nlEmail").value;
  const deviceLimit = parseInt(document.getElementById("nlDevices").value) || 3;
  const btn = event.target; btn.disabled = true; btn.textContent = "Generando...";
  // Server expects 'devices' (not 'deviceLimit'); send both for safety
  const body = { plan, months, devices: deviceLimit, deviceLimit };
  if (email) body.email = email;
  const d = await api("/admin/generate-key", { method: "POST", body: JSON.stringify(body) });
  btn.disabled = false; btn.textContent = "Genera Key";
  if (!d.ok) { toast(d.error || "Errore generazione", "error"); return; }
  const keyEl = document.getElementById("newKeyText");
  const resEl = document.getElementById("newKeyResult");
  keyEl.textContent = d.key;
  resEl.style.display = "flex";
  toast("Key generata!");

  // Add new license to local cache immediately (KV list has eventual consistency)
  const newLic = {
    raw: d.raw,
    key: d.key,
    email: email || "",
    plan: d.plan || plan,
    status: "active",
    expires: null,
    expiresHuman: d.expiresHuman || (plan === "lifetime" ? "LIFETIME" : "—"),
    devices: 0,
    maxDevices: deviceLimit,
    createdAt: Date.now(),
  };
  // Track as pending so subsequent refreshes don't remove it until server catches up
  pendingNewLicenses.set(d.key, { license: newLic, expiresAt: Date.now() + PENDING_TTL_MS });
  if (Array.isArray(licData)) {
    licData = [newLic, ...licData];
    renderLicTable(licData);
  }
  // Refresh from server with retries (KV eventual consistency); merge keeps pending visible
  licLoaded = false;
  setTimeout(() => loadLicenses(true), 1500);
  setTimeout(() => loadLicenses(true), 5000);
  setTimeout(() => loadLicenses(true), 15000);
}

// ── SELECTION & BULK ─────────────────────────────────────────
const selectedKeys = new Set();

function updateBulkBar() {
  const bar = document.getElementById("bulkBar");
  document.getElementById("bulkCount").textContent = selectedKeys.size;
  bar.style.display = selectedKeys.size > 0 ? "flex" : "none";
}

function toggleSelect(key) {
  if (selectedKeys.has(key)) selectedKeys.delete(key); else selectedKeys.add(key);
  updateBulkBar();
}

function toggleSelectAll(cb) {
  const filtered = licData;
  if (cb.checked) {
    filtered.forEach(l => { const k = l.key || l.raw || ""; if (k) selectedKeys.add(k); });
  } else {
    selectedKeys.clear();
  }
  filterLicenses();
  updateBulkBar();
}

function clearSelection() {
  selectedKeys.clear();
  filterLicenses();
  updateBulkBar();
}

async function bulkAction(action) {
  if (!selectedKeys.size) return;
  const keys = [...selectedKeys];
  const label = action === "delete" ? "ELIMINARE DEFINITIVAMENTE" : "REVOCARE";
  if (!confirm(`${label} ${keys.length} licenze?`)) return;
  if (action === "delete" && !confirm("Conferma: le licenze verranno cancellate per sempre.")) return;

  const endpoint = action === "delete" ? "/admin/delete-license" : "/revoke";
  let ok = 0, fail = 0;
  for (const key of keys) {
    const d = await api(endpoint, { method: "POST", body: JSON.stringify({ key }) });
    if (d.ok) ok++; else fail++;
  }
  selectedKeys.clear();
  updateBulkBar();
  toast(`${ok} ${action === "delete" ? "eliminate" : "revocate"}${fail ? ", " + fail + " errori" : ""}`);
  licLoaded = false;
  loadLicenses(true);
}

async function deleteLic(key) {
  if (!confirm("ELIMINARE DEFINITIVAMENTE questa licenza?\nL'azione e' irreversibile!")) return;
  const d = await api("/admin/delete-license", { method: "POST", body: JSON.stringify({ key }) });
  if (!d.ok) { toast(d.error || "Errore eliminazione", "error"); return; }
  toast("Licenza eliminata definitivamente");
  licLoaded = false;
  loadLicenses(true);
}

// ── FINANCE ──────────────────────────────────────────────────
let finLoaded = false;

async function loadFinance(force = false) {
  if (finLoaded && !force) return;
  document.getElementById("fin-stats").innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="loader"></div></div>`;
  const d = await api("/admin/revenue");
  if (!d.ok) {
    document.getElementById("fin-stats").innerHTML = `<div class="loading-center" style="grid-column:1/-1;color:var(--danger)">Errore: ${d.error || "Impossibile caricare dati"}</div>`;
    toast("Errore caricamento dati finanziari", "error");
    return;
  }
  const rev = d.revenue || {};
  const byPlan = rev.byPlan || {};

  // Revenue today (last item in last30)
  const last30 = rev.last30days || [];
  const todayRev = last30.length ? last30[last30.length - 1] : { amount: 0, count: 0 };
  const totalRevCents = last30.reduce((s, x) => s + (x.amount || 0), 0);
  const mrr = rev.mrr || 0;

  document.getElementById("fin-stats").innerHTML = `
    ${sc("MRR", fmtMoney(mrr), "")}
    ${sc("Revenue 30gg", fmtMoney(totalRevCents), "green")}
    ${sc("Revenue oggi", fmtMoney(todayRev.amount || 0), "gold")}
    ${sc("Vendite oggi", todayRev.count || 0, "")}
  `;

  // Revenue chart
  const labels = last30.map(d => d.date?.slice(5) || "");
  const vals = last30.map(d => (d.amount || 0) / 100);
  mkChart("finRevenueChart", "line", labels, [{
    data: vals, borderColor: "#7c5cfc", backgroundColor: "rgba(124,92,252,.15)",
    fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5
  }]);

  // Plan breakdown chart
  const pKeys = Object.keys(byPlan);
  const pVals = pKeys.map(k => byPlan[k] / 100);
  const planColors2 = { monthly: "#7c5cfc", annual: "#4ade80", lifetime: "#fbbf24" };
  mkChart("finPlanChart", "doughnut",
    pKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)),
    [{ data: pVals, backgroundColor: pKeys.map(k => planColors2[k] || "#6a6a8a"), borderWidth: 0 }],
    { legend: true }
  );

  finLoaded = true;
}

// ── ANALYTICS ────────────────────────────────────────────────
let anaLoaded = false;

async function loadAnalytics(force = false) {
  if (anaLoaded && !force) return;
  document.getElementById("ana-stats").innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="loader"></div></div>`;
  const d = await api("/admin/analytics");
  if (!d.ok) {
    document.getElementById("ana-stats").innerHTML = `<div class="loading-center" style="grid-column:1/-1;color:var(--danger)">Errore: ${d.error || "Impossibile caricare dati"}</div>`;
    toast("Errore caricamento analytics", "error");
    return;
  }
  const inst = d.installs || {};
  const dl = d.downloads || {};

  document.getElementById("ana-stats").innerHTML = `
    ${sc("Installazioni totali", inst.total ?? 0, "")}
    ${sc("Oggi", inst.today ?? 0, "green")}
    ${sc("Download totali", dl.total ?? 0, "")}
    ${sc("Download oggi", dl.today ?? 0, "gold")}
  `;

  // Installs chart
  const i7 = inst.last7days || [];
  mkChart("anaInstallChart", "bar",
    i7.map(x => x.date?.slice(5) || ""),
    [{ data: i7.map(x => x.count), backgroundColor: "rgba(74,222,128,.7)", borderRadius: 5, borderSkipped: false }]
  );

  // Top countries
  const countries = (inst.byCountry || []).slice(0, 10);
  const maxCnt = countries[0]?.count || 1;
  document.getElementById("topCountries").innerHTML = countries.length
    ? countries.map(c => `
        <div class="country-row">
          <span style="font-size:18px">${flag(c.country)}</span>
          <span style="width:32px;color:var(--muted);font-size:12px">${esc(c.country)}</span>
          <div class="country-bar progress"><div class="progress-fill" style="width:${Math.round(c.count/maxCnt*100)}%"></div></div>
          <span style="font-size:13px;font-weight:600;min-width:32px;text-align:right">${c.count}</span>
        </div>`).join("")
    : `<div class="empty"><div class="empty-icon">🌍</div><p>Nessun dato geografico</p></div>`;

  // Browser downloads
  const bData = dl.byBrowser || {};
  const bNames = ["chrome", "firefox", "edge", "opera", "other"];
  const bIcons = { chrome:"🌐", firefox:"🦊", edge:"🔷", opera:"🔴", other:"❔" };
  const bMax = Math.max(1, ...bNames.map(b => bData[b] || 0));
  document.getElementById("browserStats").innerHTML = bNames.map(b => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span>${bIcons[b]} ${b.charAt(0).toUpperCase()+b.slice(1)}</span>
        <span style="font-weight:600">${bData[b] || 0}</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${Math.round((bData[b]||0)/bMax*100)}%"></div></div>
    </div>`).join("");

  // Install log
  const log = (inst.recentLog || []).slice(0, 20);
  document.getElementById("installLog").innerHTML = log.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Quando</th><th>Paese</th><th>Città</th><th>Browser</th></tr></thead>
        <tbody>${log.map(e => `<tr>
          <td style="color:var(--muted)">${timeAgo(e.ts)}</td>
          <td>${flag(e.country)} ${e.country||"?"}</td>
          <td>${e.city||"–"}</td>
          <td>${browserBadge(e.browser)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`
    : `<div class="empty"><div class="empty-icon">📭</div><p>Nessun log</p></div>`;

  anaLoaded = true;
}

// ── STATISTICHE DETTAGLIATE ──────────────────────────────────
let statsLoaded = false;
const REASON_LABELS = {
  broken_site: "🧩 Sito non funzionava",
  ads_visible: "👀 Ads ancora visibili",
  confusing: "😕 Troppo complicato (confusione)",
  performance: "🐌 Rallentava il browser",
  found_better: "🔀 Alternativa migliore",
  other: "❔ Altro motivo",
};
const SOURCE_LABELS = { chrome:"🌐 Chrome", firefox:"🦊 Firefox", edge:"🔷 Edge", opera:"🔴 Opera", direct:"🔗 Diretto (sito)" };

// Lista a barre orizzontali (label → valore) riusabile.
function barList(rows, opts = {}) {
  const data = rows.filter(r => opts.keepZero || r.value > 0);
  if (!data.length) return `<div class="empty"><div class="empty-icon">${opts.icon || "📭"}</div><p>${opts.empty || "Nessun dato"}</p></div>`;
  const max = Math.max(1, ...data.map(r => r.value));
  const color = opts.color || "var(--accent)";
  return data.map(r => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
        <span>${esc(r.label)}</span>
        <span style="font-weight:600">${r.value.toLocaleString()}${opts.suffix || ""}</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${Math.round(r.value/max*100)}%;background:${color}"></div></div>
    </div>`).join("");
}

async function loadStats(force = false) {
  if (statsLoaded && !force) return;
  document.getElementById("st-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="loader"></div></div>`;

  // Pool unico: business (stats) + revenue + telemetria (analytics) + retention (protezione ON/OFF)
  const [stats, rev, ana, ret] = await Promise.all([
    api("/admin/stats"),
    api("/admin/revenue"),
    api("/admin/analytics"),
    api("/admin/retention"),
  ]);
  if (!ana.ok && !stats.ok) {
    document.getElementById("st-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1;color:var(--danger)">Errore: ${ana.error || stats.error || "Impossibile caricare dati"}</div>`;
    toast("Errore caricamento statistiche", "error");
    return;
  }

  const lic = stats.licenses || {};
  const sales = stats.sales || {};
  const devs = stats.devices || {};
  const plans = stats.plans || {};
  const revData = rev.revenue || {};
  const inst = ana.installs || {};
  const dl = ana.downloads || {};
  const un = ana.uninstalls || {};

  const i7 = inst.last7days || [];
  const u7 = un.last7days || [];
  const sum = a => (a || []).reduce((s, x) => s + (x.count || 0), 0);
  const net7 = sum(i7) - sum(u7);
  const churn = un.ratePercent ?? 0;

  // KPI cards (business + crescita) + protezione ON/OFF (da /admin/retention)
  const retSummary = ret?.summary || {};
  document.getElementById("st-kpis").innerHTML = `
    ${sc("Licenze attive", lic.active ?? 0, "green")}
    ${sc("Vendute totali", sales.totalSold ?? 0, "")}
    ${sc("Dispositivi", devs.total ?? 0, "")}
    ${sc("Installazioni totali", inst.total ?? 0, "")}
    ${sc("Download totali", dl.total ?? 0, "")}
    ${sc("Disinstallazioni", un.total ?? 0, "red")}
    ${sc("Attivi con protezione ON", retSummary.activeEnabled ?? 0, "green")}
    ${sc("Attivi con protezione OFF", retSummary.activeDisabled ?? 0, "red")}
    ${`<div class="stat-card"><div class="stat-val ${churn > 30 ? "red" : "gold"}">${churn}%</div><div class="stat-label">Tasso disinstallazione</div></div>`}
    ${`<div class="stat-card"><div class="stat-val ${net7 >= 0 ? "green" : "red"}">${net7 >= 0 ? "+" : ""}${net7.toLocaleString()}</div><div class="stat-label">Crescita netta 7g</div></div>`}
  `;

  // Chart installs vs uninstalls (7 giorni)
  const labels = i7.map(x => x.date?.slice(5) || "");
  mkChart("stNetChart", "bar", labels, [
    { label: "Installazioni", data: i7.map(x => x.count), backgroundColor: "rgba(74,222,128,.75)", borderRadius: 5, borderSkipped: false },
    { label: "Disinstallazioni", data: u7.map(x => x.count), backgroundColor: "rgba(244,63,94,.75)", borderRadius: 5, borderSkipped: false },
  ], { legend: true });

  // Top Paesi
  const countries = (inst.byCountry || []).slice(0, 10);
  const maxCnt = countries[0]?.count || 1;
  document.getElementById("stCountries").innerHTML = countries.length
    ? countries.map(c => `
        <div class="country-row">
          <span style="font-size:18px">${flag(c.country)}</span>
          <span style="width:32px;color:var(--muted);font-size:12px">${esc(c.country)}</span>
          <div class="country-bar progress"><div class="progress-fill" style="width:${Math.round(c.count/maxCnt*100)}%"></div></div>
          <span style="font-size:13px;font-weight:600;min-width:32px;text-align:right">${c.count}</span>
        </div>`).join("")
    : `<div class="empty"><div class="empty-icon">🌍</div><p>Nessun dato geografico</p></div>`;

  // Revenue ultimi 7 giorni
  const last7 = (revData.last30days || []).slice(-7);
  mkChart("stRevenueChart", "bar", last7.map(d => d.date?.slice(5) || ""), [{
    data: last7.map(d => (d.amount || 0) / 100), backgroundColor: "rgba(124,92,252,.7)", borderRadius: 6, borderSkipped: false,
  }]);

  // Distribuzione piani
  const planKeys = Object.keys(plans);
  const planColors = { monthly:"#7c5cfc", annual:"#4ade80", lifetime:"#fbbf24", unknown:"#6a6a8a" };
  mkChart("stPlanChart", "doughnut", planKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), [{
    data: planKeys.map(k => plans[k]), backgroundColor: planKeys.map(k => planColors[k] || "#6a6a8a"), borderWidth: 0,
  }], { legend: true });

  // Sorgenti installazione
  const src = Object.entries(inst.bySource || {})
    .map(([k, v]) => ({ label: SOURCE_LABELS[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);
  document.getElementById("stSources").innerHTML = barList(src, { color: "var(--success)", icon: "📥", empty: "Nessun dato sorgenti" });

  // Download per browser
  const bIcons = { chrome:"🌐 Chrome", firefox:"🦊 Firefox", edge:"🔷 Edge", opera:"🔴 Opera", other:"❔ Altro" };
  const dlRows = Object.entries(dl.byBrowser || {}).map(([k, v]) => ({ label: bIcons[k] || k, value: v })).sort((a, b) => b.value - a.value);
  document.getElementById("stDlBrowser").innerHTML = barList(dlRows, { color: "var(--accent)", icon: "🧭", empty: "Nessun dato download" });

  // Motivi disinstallazione
  const reasons = Object.entries(un.byReason || {})
    .map(([k, v]) => ({ label: REASON_LABELS[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);
  document.getElementById("stReasons").innerHTML = barList(reasons, { color: "var(--danger)", icon: "🙋", empty: "Ancora nessuna disinstallazione tracciata" });

  // Disinstallazioni per browser
  const ubRows = Object.entries(un.byBrowser || {}).map(([k, v]) => ({ label: bIcons[k] || k, value: v })).sort((a, b) => b.value - a.value);
  document.getElementById("stUninstBrowser").innerHTML = barList(ubRows, { color: "var(--danger)", icon: "🧭", empty: "Nessun dato browser" });

  // Installazioni recenti
  const ilog = (inst.recentLog || []).slice(0, 15);
  document.getElementById("stInstallLog").innerHTML = ilog.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Quando</th><th>Paese</th><th>Città</th><th>Browser</th></tr></thead>
        <tbody>${ilog.map(e => `<tr>
          <td style="color:var(--muted)">${timeAgo(e.ts)}</td>
          <td>${flag(e.country)} ${e.country||"?"}</td>
          <td>${e.city||"–"}</td>
          <td>${browserBadge(e.browser)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`
    : `<div class="empty"><div class="empty-icon">📭</div><p>Nessuna installazione registrata</p></div>`;

  // Disinstallazioni recenti
  const ulog = (un.recentLog || []).slice(0, 15);
  document.getElementById("stUninstLog").innerHTML = ulog.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Quando</th><th>Motivo</th><th>Commento</th><th>Browser</th><th>Paese</th><th>Pro</th></tr></thead>
        <tbody>${ulog.map(e => `<tr>
          <td style="color:var(--muted)">${timeAgo(e.ts)}</td>
          <td>${(REASON_LABELS[e.reason] || e.reason || "?")}</td>
          <td style="max-width:240px;${e.comment ? "" : "color:var(--muted)"}">${e.comment ? esc(e.comment) : "–"}</td>
          <td>${browserBadge(e.browser)}</td>
          <td>${flag(e.country)} ${e.country || "?"}</td>
          <td>${e.wasPro ? "⭐" : "–"}</td>
        </tr>`).join("")}</tbody>
      </table></div>`
    : `<div class="empty"><div class="empty-icon">📭</div><p>Nessuna disinstallazione registrata (l'estensione v3.5.3 inizia a raccoglierle dopo l'approvazione store)</p></div>`;

  statsLoaded = true;
}

// ── EFFICACIA ────────────────────────────────────────────────
let effLoaded = false;

function effEmpty(icon, msg) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><p>${msg}</p></div>`;
}

const EFF_ENDPOINT_PENDING = "Endpoint non ancora disponibile: il dato apparirà qui appena attivo.";

async function loadEfficacia(force = false) {
  if (effLoaded && !force) return;
  document.getElementById("eff-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="loader"></div></div>`;

  const [ops, unan, ret, leak, runs] = await Promise.all([
    api("/admin/ops-stats"),
    api("/admin/uninstall-analytics"),
    api("/admin/retention"),
    api("/admin/adleak-latest"),
    api("/admin/adleak-runs?limit=20"),
  ]);

  // KPI: dai soli endpoint storici (ops-stats/retention), che esistono già.
  const rs = ret.summary || {};
  document.getElementById("eff-kpis").innerHTML = `
    ${sc("Dispositivi attivi", ops.activeTotal ?? 0, "green")}
    ${sc("Adozione telemetria opt-in", (ops.optInAdoption ?? 0) + "%", "")}
    ${sc("Tasso disinstallazione", (rs.uninstallRate ?? 0) + "%", "red")}
    ${rs.avgDaysToUninstall != null ? sc("Giorni medi prima della disinstallazione", Math.round(rs.avgDaysToUninstall), "gold") : ""}
  `;

  // Trend install vs uninstall (30 giorni)
  const iT = (ops.installTrend || []).slice(-30);
  const uT = (ops.uninstallTrend || []).slice(-30);
  const dayMap = m => Object.fromEntries((m || []).map(x => [x.day, x.count]));
  const uByDay = dayMap(uT);
  const labels = iT.map(x => x.day?.slice(5) || "");
  if (labels.length) {
    mkChart("effTrendChart", "line", labels, [
      { label: "Installazioni", data: iT.map(x => x.count), borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.15)", fill: true, tension: .35, pointRadius: 2 },
      { label: "Disinstallazioni", data: iT.map(x => uByDay[x.day] || 0), borderColor: "#f43f5e", backgroundColor: "rgba(244,63,94,.12)", fill: true, tension: .35, pointRadius: 2 },
    ], { legend: true });
  }

  // Retention curve
  const curve = ret.retentionCurve || [];
  document.getElementById("effRetention").innerHTML = curve.length
    ? barList(curve.map(c => ({ label: `Utenti attivi a ${c.days} giorni`, value: c.rate })), { color: "var(--accent)", icon: "📈", suffix: "%", empty: "Nessun dato retention" })
    : effEmpty("📈", "Nessun dato retention");

  // Coorti durata installazione (uninstall-analytics)
  const cohort = unan.cohort || [];
  document.getElementById("effCohorts").innerHTML = cohort.length
    ? barList(cohort.map(c => ({ label: c.bucket, value: c.count })), { color: "var(--danger)", icon: "⏳", empty: "Nessuna disinstallazione tracciata" })
    : effEmpty("⏳", "Ancora nessuna disinstallazione tracciata");

  // Motivi disinstallazione (trend 30d)
  const r30 = (unan.reasonTrend && unan.reasonTrend["30d"]) || {};
  const reasons = Object.entries(r30).map(([k, v]) => ({ label: REASON_LABELS[k] || k, value: v })).sort((a, b) => b.value - a.value);
  document.getElementById("effReasons").innerHTML = reasons.length
    ? barList(reasons, { color: "var(--danger)", icon: "🙋", empty: "Nessun dato motivo" })
    : effEmpty("🙋", "Nessun motivo registrato negli ultimi 30 giorni");

  // ── Le due misure affiancate ──
  // 1) Telemetria utenti: topLeakHostnames
  const hosts = ops.topLeakHostnames || [];
  document.getElementById("effUserLeaks").innerHTML = hosts.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Dominio</th><th style="text-align:right">Occorrenze (30g)</th></tr></thead>
        <tbody>${hosts.map(h => `<tr>
          <td style="font-family:monospace;font-size:12px">${esc(h.hostname)}</td>
          <td style="text-align:right;font-weight:600">${(h.total || 0).toLocaleString()}</td>
        </tr>`).join("")}</tbody>
      </table></div>`
    : effEmpty("📭", ops.ok ? "Nessun ad-leak segnalato dalla telemetria (ottimo)" : "Telemetria non disponibile: " + (ops.error || "nessun dato"));

  // 2) Nostri test automatici: adleak-latest (endpoint nuovo: 404 = stato vuoto legittimo)
  const testEl = document.getElementById("effTestLeaks");
  const doms = (leak && leak.ok && Array.isArray(leak.domains)) ? leak.domains : null;
  if (!doms) {
    testEl.innerHTML = effEmpty("🤖", leak && leak.error && leak.error !== "Not found" ? ("Errore: " + esc(leak.error)) : "Nessun run del crawler disponibile ancora. " + EFF_ENDPOINT_PENDING);
  } else if (!doms.length) {
    testEl.innerHTML = effEmpty("✅", `Ultimo run (${esc(leak.extensionVersion || "?")}): ${leak.domainsTested ?? 0} domini testati, nessun leak. Ottimo.`);
  } else {
    testEl.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
        Run ${esc(leak.runId || "")} · ${fmtDate((leak.finishedAt || leak.startedAt || 0) / 1000)} · versione ${esc(leak.extensionVersion || "?")} ·
        ${leak.domainsTested ?? 0} domini testati · <b style="color:var(--danger)">${leak.domainsWithLeak ?? doms.length} con leak</b> · ${leak.totalLeaks ?? 0} leak totali
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Dominio</th><th style="text-align:right">Richieste</th><th style="text-align:right">Leak</th><th>Rilevato</th><th>Esito</th></tr></thead>
        <tbody>${doms.map(d => `<tr>
          <td style="font-family:monospace;font-size:12px">${esc(d.domain)}</td>
          <td style="text-align:right">${(d.requests ?? 0).toLocaleString()}</td>
          <td style="text-align:right;font-weight:600;color:var(--danger)">${d.leaks ?? 0}</td>
          <td>${d.detection ? '<span style="color:#fbbf24">🚫 Sì</span>' : '<span style="color:var(--muted)">No</span>'}</td>
          <td style="color:var(--muted);font-size:11px">${d.error ? "⚠️ " + esc(d.error) : (d.httpStatus != null ? "HTTP " + d.httpStatus : "–")}</td>
        </tr>`).join("")}</tbody>
      </table></div>`;
  }

  // Storico run (endpoint nuovo: 404 = stato vuoto legittimo)
  const runsArr = (runs && Array.isArray(runs.runs)) ? runs.runs : (Array.isArray(runs) ? runs : []);
  document.getElementById("effRuns").innerHTML = runsArr.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Versione</th><th style="text-align:right">Domini testati</th><th style="text-align:right">Con leak</th><th style="text-align:right">Leak totali</th></tr></thead>
        <tbody>${runsArr.map(r => `<tr>
          <td style="color:var(--muted)">${fmtDate((r.finishedAt || r.startedAt || 0) / 1000)}</td>
          <td>${esc(r.extensionVersion || r.version || "–")}</td>
          <td style="text-align:right">${(r.domainsTested ?? 0).toLocaleString()}</td>
          <td style="text-align:right">${(r.domainsWithLeak ?? 0).toLocaleString()}</td>
          <td style="text-align:right;font-weight:600">${(r.totalLeaks ?? 0).toLocaleString()}</td>
        </tr>`).join("")}</tbody>
      </table></div>`
    : effEmpty("🗂️", "Nessuno storico disponibile. " + EFF_ENDPOINT_PENDING);

  effLoaded = true;
}

// ── REGISTRAZIONI (gate gratuito — MAI suggerire pagamenti/abbonamenti) ──
let regLoaded = false;

const REG_STATUS = {
  grace: '<span style="color:#fbbf24">🕐 In grazia (uso libero)</span>',
  registered: '<span style="color:#4ade80">✅ Account gratuito attivo</span>',
  expired: '<span style="color:var(--danger)">⏰ Scaduto — basta registrarsi gratis</span>',
};

async function loadRegistrazioni(force = false) {
  if (regLoaded && !force) return;
  document.getElementById("reg-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="loader"></div></div>`;

  const d = await api("/admin/free-licenses");
  if (!d.ok || !d.summary) {
    const msg = d.error && d.error !== "Not found" ? ("Errore: " + esc(d.error)) : ("Nessun dato ancora. " + EFF_ENDPOINT_PENDING);
    document.getElementById("reg-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1">${effEmpty("🆓", msg)}</div>`;
    document.getElementById("regRecent").innerHTML = effEmpty("📭", msg);
    if (charts.regTrendChart) { charts.regTrendChart.destroy(); delete charts.regTrendChart; }
    return;
  }

  const s = d.summary || {};
  document.getElementById("reg-kpis").innerHTML = `
    ${sc("Dispositivi totali", s.total ?? 0, "")}
    ${sc("In grazia (uso libero)", s.inGrace ?? 0, "gold")}
    ${sc("Con account gratuito", s.registered ?? 0, "green")}
    ${sc("Grazia in scadenza", s.graceExpiringSoon ?? 0, "gold")}
    ${sc("Scaduti senza registrarsi", s.expired ?? 0, "red")}
  `;

  const trend = d.trend || [];
  if (trend.length) {
    mkChart("regTrendChart", "line", trend.map(t => t.day?.slice(5) || ""), [
      { label: "Nuovi dispositivi", data: trend.map(t => t.newDevices || 0), borderColor: "#7c5cfc", backgroundColor: "rgba(124,92,252,.15)", fill: true, tension: .35, pointRadius: 2 },
      { label: "Nuovi account gratuiti", data: trend.map(t => t.newAccounts || 0), borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.15)", fill: true, tension: .35, pointRadius: 2 },
    ], { legend: true });
  }

  const recent = (d.recent || []).slice(0, 50);
  document.getElementById("regRecent").innerHTML = recent.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Dispositivo</th><th>Inizio grazia</th><th>Account collegato</th><th>Stato</th></tr></thead>
        <tbody>${recent.map(r => `<tr>
          <td style="font-family:monospace;font-size:12px;color:var(--muted)">${esc(String(r.deviceId || "").slice(0, 12))}…</td>
          <td style="color:var(--muted)">${r.gateStart ? fmtDate(r.gateStart / 1000) : "–"}</td>
          <td style="color:var(--muted)">${r.accountId ? esc(r.accountId) : "–"}</td>
          <td>${REG_STATUS[r.status] || esc(r.status || "–")}</td>
        </tr>`).join("")}</tbody>
      </table></div>`
    : effEmpty("📭", "Nessun dispositivo registrato ancora");

  regLoaded = true;
}

// ── SEO / AEO ────────────────────────────────────────────────
let seoLoaded = false;
let seoPeriod = 30; // days

function setSeoPeriod(days) {
  seoPeriod = days;
  document.querySelectorAll(".period-btns .btn").forEach(b => b.classList.remove("btn-accent"));
  const btn = document.getElementById("seo-period-" + days);
  if (btn) btn.classList.add("btn-accent");
  seoLoaded = false;
  loadSeo();
}

async function refreshSeo() {
  document.getElementById("seo-updated").textContent = "↻ Sync in corso...";
  const d = await api("/admin/seo/refresh", { method: "POST" });
  if (!d.ok) { toast("Errore sync: " + (d.error || "?"), "error"); document.getElementById("seo-updated").textContent = ""; return; }
  seoLoaded = false;
  loadSeo();
  document.getElementById("seo-updated").textContent = "✓ Aggiornato";
  setTimeout(() => { const el = document.getElementById("seo-updated"); if (el) el.textContent = ""; }, 3000);
}

async function loadSeo(force = false) {
  if (seoLoaded && !force) return;
  document.getElementById("seo-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="loader"></div></div>`;
  const d = await api("/admin/seo");
  if (!d.ok) {
    document.getElementById("seo-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1;color:var(--danger)">Errore: ${d.error || "Impossibile caricare"}</div>`;
    toast("Errore caricamento SEO", "error");
    return;
  }
  const data = d.data;
  const gsc = data.gsc || {};
  const totals = gsc.totals || {};
  const ga4 = data.ga4 || {};
  const sitemaps = data.sitemaps || [];
  const cached = d.cached ? " · Cache" : "";

  // Updated timestamp
  if (data.updatedAt) {
    const d2 = new Date(data.updatedAt);
    const hh = String(d2.getHours()).padStart(2, "0") + ":" + String(d2.getMinutes()).padStart(2, "0");
    document.getElementById("seo-updated").textContent = "Ultimo aggiornamento: " + hh + cached;
  }

  // KPI cards
  document.getElementById("seo-kpis").innerHTML = `
    ${sc("Clicks " + seoPeriod + "gg", (totals.clicks || 0).toLocaleString(), "green")}
    ${sc("Impressions", (totals.impressions || 0).toLocaleString(), "")}
    ${sc("CTR Medio", (totals.ctr || 0) + "%", "")}
    ${sc("Pos. Media", (totals.position || 0).toFixed(1), "")}
    ${ga4 && ga4.totals ? sc("Utenti GA4", (ga4.totals.users || 0).toLocaleString(), "gold") : sc("Utenti GA4", "—", "")}
    ${sc("Sitemap attivi", sitemaps.length, "")}
  `;

  // Trend chart (use 30d trend)
  const trend = gsc.trend30d || [];
  const labels = trend.map(r => r.date?.slice(5) || "");
  mkChart("seoTrendChart", "line", labels, [
    { label: "Clicks", data: trend.map(r => r.clicks || 0), borderColor: "#7c5cfc", backgroundColor: "rgba(124,92,252,.15)", fill: true, tension: 0.4, pointRadius: 2 },
    { label: "Impressions (×100)", data: trend.map(r => Math.round((r.impressions || 0) / 100)), borderColor: "#60a5fa", backgroundColor: "rgba(96,165,250,.1)", fill: true, tension: 0.4, pointRadius: 2 },
  ], { legend: true });

  // Device chart
  const devices = gsc.topDevice || [];
  const deviceColors = { DESKTOP: "#7c5cfc", MOBILE: "#4ade80", TABLET: "#fbbf24" };
  mkChart("seoDeviceChart", "doughnut",
    devices.map(d => d.key || "?"),
    [{ data: devices.map(d => d.clicks || 0), backgroundColor: devices.map(d => deviceColors[d.key] || "#6a6a8a"), borderWidth: 0 }],
    { legend: true }
  );

  // Top keywords bar list
  const keywords = (gsc.topQuery || []).slice(0, 10).map(r => ({ label: r.key, value: r.clicks }));
  document.getElementById("seoKeywords").innerHTML = barList(keywords, { color: "#7c5cfc", icon: "🔑", empty: "Nessun dato" });

  // Top pages table
  const pages = (gsc.topPage || []).slice(0, 10);
  document.getElementById("seoPages").innerHTML = pages.length
    ? `<div class="table-wrap"><table><thead><tr><th>Pagina</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos</th></tr></thead><tbody>${
        pages.map(r => `<tr>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="mono" style="font-size:12px" title="${esc(r.key)}">${esc(r.key)}</span></td>
          <td>${r.clicks.toLocaleString()}</td>
          <td>${r.impressions.toLocaleString()}</td>
          <td>${r.ctr}%</td>
          <td>${r.position}</td>
        </tr>`).join("")
      }</tbody></table></div>`
    : `<div class="empty"><p>Nessun dato</p></div>`;

  // Top countries bar list
  const countries = (gsc.topCountry || []).slice(0, 8).map(r => ({ label: r.key, value: r.clicks }));
  document.getElementById("seoCountries").innerHTML = barList(countries, { color: "#4ade80", icon: "🌍", empty: "Nessun dato" });

  // Search appearances bar list
  const appearances = (gsc.topAppearance || []).map(r => ({ label: r.key, value: r.impressions }));
  document.getElementById("seoAppearances").innerHTML = barList(appearances, { color: "#fbbf24", icon: "✨", empty: "Nessun dato" });

  // Opportunities
  const opp = (gsc.opportunities || []).slice(0, 15).map(r => ({ label: r.key + ` (pos ${r.position})`, value: r.impressions }));
  document.getElementById("seoOpportunities").innerHTML = barList(opp, { color: "#7c5cfc", icon: "🎯", empty: "Nessuna opportunità — tutte le keyword sono già in top 5" });

  // Sitemaps
  if (sitemaps.length) {
    document.getElementById("seoSitemaps").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Sitemap</th><th>Errori</th><th>Warning</th><th>Ultimo submit</th><th>Submitted/Indexed</th></tr></thead><tbody>${
      sitemaps.map(s => {
        const web = (s.contents || []).find(c => c.type === "web") || {};
        return `<tr>
          <td><span class="mono" style="font-size:11px" title="${esc(s.path)}">${esc((s.path || "").split("/").pop())}</span></td>
          <td style="color:${s.errors > 0 ? "var(--danger)" : "var(--success)"}">${s.errors}</td>
          <td style="color:${s.warnings > 0 ? "var(--gold)" : "var(--muted)"}">${s.warnings}</td>
          <td style="font-size:12px;color:var(--muted)">${s.lastSubmitted ? new Date(s.lastSubmitted).toLocaleDateString() : "—"}</td>
          <td style="font-size:12px">${web.submitted || 0} / ${web.indexed || 0}</td>
        </tr>`;
      }).join("")
    }</tbody></table></div>`;
  } else {
    document.getElementById("seoSitemaps").innerHTML = `<div class="empty"><p>Nessun sitemap registrato</p></div>`;
  }

  // GA4 data
  if (ga4 && ga4.totals) {
    const t = ga4.totals;
    document.getElementById("seo-ga4").innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        ${sc("Utenti", (t.users || 0).toLocaleString(), "gold")}
        ${sc("Sessioni", (t.sessions || 0).toLocaleString(), "")}
        ${sc("Tasso engagement", ((t.engagementRate || 0) * 100).toFixed(1) + "%", "green")}
        ${sc("Bounce rate", ((t.bounceRate || 0) * 100).toFixed(1) + "%", "red")}
        ${sc("Durata media", Math.round(t.avgSessionDuration || 0) + "s", "")}
        ${sc("Page views", (t.pageViews || 0).toLocaleString(), "")}
      </div>
    `;
  } else {
    document.getElementById("seo-ga4").innerHTML = `<div class="empty"><p>GA4 non configurato — aggiungi GA4_PROPERTY_ID al Worker</p></div>`;
  }

  // Set period button active
  setSeoPeriod(seoPeriod);
  seoLoaded = true;
}

// ── SEO AGENT (run settimanale) ──────────────────────────────
let saLoaded = false;
const SA_SEV_ORDER = { high: 0, medium: 1, low: 2 };
const SA_SEV_BADGE = {
  high:   "background:rgba(244,63,94,.12);color:var(--danger);border:1px solid rgba(244,63,94,.2)",
  medium: "background:rgba(251,191,36,.12);color:var(--warn);border:1px solid rgba(251,191,36,.2)",
  low:    "background:rgba(100,116,139,.12);color:#94a3b8;border:1px solid rgba(100,116,139,.2)",
};
const SA_CHECK_DOT = { pass: "#4ade80", warn: "#fbbf24", fail: "#f87171", error: "#6a6a8a" };

function saHealthColor(s) { return s >= 80 ? "green" : s >= 60 ? "gold" : "red"; }

function saFmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts : ts.replace(" ", "T"));
  return isNaN(d) ? String(ts) : d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function saEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

async function loadSeoAgent(force = false) {
  if (saLoaded && !force) return;
  ["sa-kpis","sa-trend","sa-checks","sa-findings","sa-runs","sa-fixed"].forEach(id =>
    document.getElementById(id).innerHTML = `<div class="loading-center"><div class="loader"></div></div>`);
  const d = await api("/admin/seo-agent");
  if (!d.ok) {
    document.getElementById("sa-kpis").innerHTML = `<div class="loading-center" style="grid-column:1/-1;color:var(--danger)">Errore: ${saEsc(d.error || "Impossibile caricare")}</div>`;
    ["sa-trend","sa-checks","sa-findings","sa-runs","sa-fixed"].forEach(id => document.getElementById(id).innerHTML = "");
    toast("Errore caricamento Agente SEO", "error");
    return;
  }
  const run = d.last_run, trend = d.health_trend || [], checks = d.checks_last || [];
  const empty = !run;
  document.getElementById("sa-kpis").innerHTML = empty
    ? `<div class="empty" style="grid-column:1/-1"><p>🤖 L'agente non ha ancora girato. Prossima esecuzione: <b>domenica 08:00</b>.</p></div>`
    : [
        sc("Health score", run.health_score ?? "—", saHealthColor(run.health_score || 0)),
        sc("Findings aperti", (d.open_findings || []).length, (d.open_findings || []).length ? "red" : ""),
        sc("Auto-risolti ultimo run", run.applied_count ?? 0, "green"),
        sc("Ultimo run", saFmtDate(run.generated_at), ""),
        sc("Modello", run.model_used || "—", ""),
        sc("Durata", run.duration_s != null ? run.duration_s + "s" : "—", ""),
      ].join("");

  // Trend: grafico solo con ≥2 punti
  if (trend.length >= 2) {
    document.getElementById("sa-trend").innerHTML = `<div class="chart-wrap chart-wrap-lg"><canvas id="saTrendChart"></canvas></div>`;
    mkChart("saTrendChart", "line", trend.map(p => (p.date || "").slice(5)), [
      { label: "Health score", data: trend.map(p => p.score), borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.12)", fill: true, tension: 0.4, pointRadius: 2 },
    ], { legend: false, scales: { x: { grid: { color: "#1e1e3a" }, ticks: { color: "#6a6a8a" } }, y: { min: 0, max: 100, grid: { color: "#1e1e3a" }, ticks: { color: "#6a6a8a" } } } });
  } else {
    document.getElementById("sa-trend").innerHTML = `<div class="empty"><p>Dati insufficienti per il grafico (servono almeno 2 run settimanali).</p></div>`;
  }

  // Checks: griglia densa
  document.getElementById("sa-checks").innerHTML = checks.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">` + checks.map(c => {
        const col = SA_CHECK_DOT[c.status] || "#6a6a8a";
        return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 6px;background:var(--input);border-radius:6px;overflow:hidden">
          <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0" title="${saEsc(c.status)}"></span>
          <span class="mono" style="flex-shrink:0">${saEsc(c.id)}</span>
          <span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${saEsc(c.detail || "")}">${saEsc(c.measured ?? "")}</span>
        </div>`;
      }).join("") + `</div>`
    : `<div class="empty"><p>Nessun check disponibile</p></div>`;

  // Findings aperti, ordinati per gravità
  const fins = (d.open_findings || []).slice().sort((a, b) => (SA_SEV_ORDER[a.severity] ?? 9) - (SA_SEV_ORDER[b.severity] ?? 9));
  document.getElementById("sa-findings").innerHTML = fins.length
    ? `<div class="table-wrap"><table><thead><tr><th>Severità</th><th>Area</th><th>Titolo</th><th>Evidenza</th><th>File</th><th>Prima vista</th><th>Occ.</th><th></th></tr></thead><tbody>${
        fins.map(f => {
          const files = (() => { try { return (JSON.parse(f.files_json || "[]") || []).join(", "); } catch { return f.files_json || ""; } })();
          return `<tr>
            <td><span class="badge" style="${SA_SEV_BADGE[f.severity] || SA_SEV_BADGE.low}">${saEsc(f.severity)}</span></td>
            <td style="font-size:12px">${saEsc(f.area)}</td>
            <td style="max-width:260px;font-size:12px" title="${saEsc(f.title)}">${saEsc(f.title)}</td>
            <td style="max-width:200px;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${saEsc(f.evidence || "")}">${saEsc(f.evidence || "")}</td>
            <td style="max-width:160px;font-size:11px" class="mono" title="${saEsc(files)}">${saEsc(files)}</td>
            <td style="font-size:11px;color:var(--muted);white-space:nowrap">${saFmtDate(f.first_seen)}</td>
            <td>${f.occurrences ?? 1}</td>
            <td><button class="btn btn-sm btn-outline" data-sa-ignore="${esc(f.finding_id)}">Ignora</button></td>
          </tr>`;
        }).join("")
      }</tbody></table></div>`
    : `<div class="empty"><p>Nessun finding aperto — tutto pulito ✨</p></div>`;

  // Storico run
  const runs = d.runs || [];
  document.getElementById("sa-runs").innerHTML = runs.length
    ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>HS</th><th>Findings</th><th>Applicati</th><th>Deploy</th><th>Commit</th><th>Modello</th><th>Durata</th></tr></thead><tbody>${
        runs.map(r => `<tr>
          <td style="font-size:12px;white-space:nowrap">${saFmtDate(r.generated_at)}</td>
          <td style="color:var(--${saHealthColor(r.health_score || 0) === "green" ? "success" : saHealthColor(r.health_score || 0) === "gold" ? "gold" : "danger"})">${r.health_score ?? "—"}</td>
          <td>${r.findings_total ?? 0}${r.findings_high ? ` <span style="color:var(--danger)">(${r.findings_high} high)</span>` : ""}</td>
          <td>${r.applied_count ?? 0}${r.proposed_count ? ` <span style="opacity:.6;font-size:11px">+${r.proposed_count} prop.</span>` : ""}</td>
          <td>${r.deployed ? "✅" : "—"}</td>
          <td style="font-size:11px"><code>${r.commit_sha ? saEsc(r.commit_sha) : "—"}</code></td>
          <td style="font-size:11px">${saEsc(r.model_used || "—")}</td>
          <td>${r.duration_s != null ? r.duration_s + "s" : "—"}</td>
        </tr>`).join("")
      }</tbody></table></div>`
    : `<div class="empty"><p>Nessun run registrato</p></div>`;

  // Risolti di recente
  const fixed = d.recently_fixed || [];
  document.getElementById("sa-fixed").innerHTML = fixed.length
    ? fixed.map(f => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span>${f.status === "fixed" ? "🔧" : "🌫️"}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${saEsc(f.title)}">${saEsc(f.title)}</span>
        <span style="color:var(--muted);white-space:nowrap">${f.status === "fixed" ? "fixed" : "risolto"} · ${saFmtDate(f.resolved_at)}</span>
      </div>`).join("")
    : `<div class="empty"><p>Niente di risolto di recente</p></div>`;

  saLoaded = true;
}

async function saIgnore(findingId) {
  const d = await api("/admin/seo-agent/backlog", { method: "POST", body: JSON.stringify({ finding_id: findingId, status: "wontfix", note: "ignored-from-console" }) });
  if (!d.ok) { toast("Errore: " + (d.error || "impossibile ignorare"), "error"); return; }
  toast("Finding ignorato — non sarà riproposto", "success");
  saLoaded = false;
  loadSeoAgent(true);
}

async function loadAutofix(force = false) {
  const resultsEl = document.getElementById("autofix-stats-row");
  if (!resultsEl) { console.warn("[Autofix] #autofix-stats-row not found"); return; }
  resultsEl.innerHTML = '<div class="loading-center"><div class="loader"></div></div>';
  try {
    const data = await api("/admin/autofix/status");
    if (!data.ok) {
      resultsEl.innerHTML = '<div style="color:var(--error);font-size:13px">' + (data.error || "Errore") + '</div>';
      return;
    }
    const sm = data.shadow_mode;
    const modeColor = sm ? "#ffbc6b" : "#16a766";
    const modeIcon  = sm ? "⚠"  : "✓";
    const modeLabel = sm ? "Shadow Mode (nessun deploy)" : "Attivo (deploy automatico)";
    const totalRules = data.total_rules != null ? data.total_rules : "—";
    const pending   = data.pending_decisions || 0;
    const approved  = data.approved_unapplied || 0;
    const deferred  = data.deferred || 0;
    resultsEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--input);border-radius:8px;border-left:4px solid ' + modeColor + ';margin-bottom:12px">' +
        '<span style="background:' + modeColor + ';color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">' + modeIcon + '</span>' +
        '<div><div style="font-weight:600;font-size:14px;margin-bottom:2px">Modalità: ' + modeLabel + '</div>' +
        '<div style="font-size:12px;color:var(--muted)">Ultimo run: ' + (data.date ? new Date(data.date).toLocaleString("it-IT") : "—") + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px">' +
        '<div style="padding:12px;background:var(--input);border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--accent)">' + (data.candidates_added || 0) + '</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Nuove regole</div></div>' +
        '<div style="padding:12px;background:var(--input);border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700">' + totalRules + '</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Regole nel feed (raw)</div></div>' +
        '<div style="padding:12px;background:var(--input);border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#16a766">' + (data.open_leaks || 0) + '</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Leak aperti</div></div>' +
        '<div style="padding:12px;background:var(--input);border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700">' + (data.fixed_leaks || 0) + '</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Leak fixati</div></div>' +
      '</div>' +
      // CTA bar
      '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">' +
        '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">' +
          '🔴 ' + pending + ' leak da valutare · ✅ ' + approved + ' fix approvati in attesa · 💤 ' + deferred + ' rimandati' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
          '<button class="btn btn-sm btn-success" data-bulk-decide="ads_real:fix">✅ Approva tutti gli ads-reali</button>' +
          '<button class="btn btn-sm btn-outline" data-bulk-decide="dom_fp:ignore">🚫 Ignora tutti i DOM sospetti</button>' +
          '<button class="btn btn-sm btn-accent" data-req-apply>⚡ Applica i fix approvati</button>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted);background:var(--input);border-radius:6px;padding:8px 10px">' +
          '💡 Hai <b style="color:var(--text)">' + approved + '</b> decisioni pronte. In chat scrivi <code style="color:var(--accent)">applica i fix approvati</code> per eseguirli subito, oppure il job notturno applicherà gli approvati semplici.' +
        '</div>' +
      '</div>';
    loadAutofixLeaks();
  } catch(e) {
    resultsEl.innerHTML = '<div style="color:var(--error);font-size:13px">Errore: ' + e.message + '</div>';
  }
}

// Global state per batch decisions
let _autofixLeaks = null;

// ── Autofix: carica lista leak ──────────────────────────────────────────────
async function loadAutofixLeaks() {
  const panel = document.getElementById("autofix-leaks-container");
  if (!panel) { console.warn("[Autofix] #autofix-leaks-container not found"); return; }
  panel.innerHTML = '<div id="autofix-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 16px;color:var(--muted)"><div class="loader"></div><div style="margin-top:12px">Carico i leak...</div></div>';
  try {
    console.log("[Autofix] API URL:", API + "/admin/autofix/leaks");
    console.log("[Autofix] Token:", token ? "present" : "MISSING");
    const data = await api("/admin/autofix/leaks");
    console.log("[Autofix] Received data:", JSON.stringify(data).substring(0, 200));
    if (!data) {
      panel.innerHTML = '<div style="color:var(--error);font-size:13px;padding:8px">Risposta vuota dal server</div>';
      return;
    }
    if (!data.ok) {
      panel.innerHTML = '<div style="color:var(--error);font-size:13px;padding:8px">Errore: ' + (data.error || "sconosciuto") + '</div>';
      return;
    }
    _autofixLeaks = data;
    const buckets = data.buckets || { ads_real: [], tracking: [], dom_fp: [] };
    const api_counts = data.counts || {};
    const counts = {
      ads_real: buckets.ads_real?.length || 0,
      tracking: buckets.tracking?.length || 0,
      dom_fp: buckets.dom_fp?.length || 0,
      pending: api_counts.pending || 0,
      approved: api_counts.approved_unapplied || 0,
      deferred: api_counts.deferred || 0,
      total: Object.values(buckets).reduce((s,v) => s + (Array.isArray(v) ? v.length : 0), 0)
    };
    console.log("[Autofix] buckets:", buckets);
    console.log("[Autofix] counts:", counts);

    if (counts.total === 0) {
      panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">Nessun leak rilevato — il sistema è pulito ✅</div>';
      return;
    }

    const sections = [
      { key: "ads_real", label: "🎯 Ads reali (alta confidenza)",  actionLabel: "Approva tutti", action: "fix",    color: "#e66550" },
      { key: "tracking", label: "📊 Tracking / Analytics (blocco utile, non ads)", actionLabel: "Approva tutti", action: "fix",    color: "#4a86e8" },
      { key: "dom_fp",   label: "⚠️ DOM sospetti — probabili falsi positivi",     actionLabel: "Ignora tutti", action: "ignore", color: "#ffbc6b" },
    ];

    let html = '';
    for (const s of sections) {
      const leaks = buckets[s.key] || [];
      const count = counts[s.key] || 0;
      // Un leak e' ancora "aperto" solo se non ha ne' decisione ne' e' gia' applicato.
      const open  = leaks.filter(l => !l.decision && !l.applied).length;
      const closed = leaks.length - open;
      html +=
        '<div style="margin-bottom:16px">' +
          '<details style="background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden">' +
            '<summary style="padding:12px 16px;cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between;user-select:none;list-style:none">' +
              '<span>' + s.label + ' <span style="background:' + s.color + ';color:#fff;border-radius:20px;padding:1px 8px;font-size:11px;margin-left:6px">' + count + '</span>' +
                (closed > 0 ? ' <span style="color:var(--muted);font-weight:400;font-size:11px">(' + closed + ' decisi)</span>' : '') +
              '</span>' +
              // Il bottone batch compare solo se restano leak da decidere.
              (open > 0 ? '<button class="btn btn-sm" style="background:rgba(255,255,255,.07);color:var(--text);border:1px solid var(--border)" data-bulk-decide="' + esc(s.key) + ':' + esc(s.action) + '">' + esc(s.actionLabel) + '</button>' : '') +
            '</summary>' +
            '<div style="padding:12px 16px">' +
              (leaks.length === 0
                ? '<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">Nessun leak</div>'
                : leaks.map(l => renderLeakCard(l, s.key)).join('<div style="height:8px"></div>')) +
            '</div>' +
          '</details>' +
        '</div>';
    }
    panel.innerHTML = html;
  } catch(e) {
    panel.innerHTML = '<div style="color:var(--error);font-size:13px;padding:8px">Errore: ' + esc(e.message) + '</div>';
  }
}

// ── Autofix: render singola card leak ──────────────────────────────────────
function renderLeakCard(leak, bucket) {
  const confColor = leak.confidence === "high" ? "#e66550" : leak.confidence === "medium" ? "#ffbc6b" : "#8a8a8a";
  const decision  = leak.decision || null;
  const decisionBadge = decision
    ? '<span style="background:var(--input);border:1px solid var(--border);border-radius:20px;padding:2px 8px;font-size:10px;color:var(--muted);margin-left:4px">Deciso: ' + decision + '</span>'
    : '';
  const fpBadge  = leak.fp_suspect
    ? '<span style="background:rgba(255,188,107,.15);color:#ffbc6b;border-radius:20px;padding:2px 8px;font-size:10px;margin-left:4px">possibile FP</span>'
    : '';

  let evidence = "";
  const lt = (leak.leak_type || "").toLowerCase();
  if (lt.startsWith("network") || lt.includes("network")) {
    evidence = '<div style="font-size:12px;color:var(--muted);margin-top:4px">Bloccato: <code style="background:var(--input);padding:1px 5px;border-radius:4px;font-size:11px">' + esc(leak.blocked_url || leak.url_pattern || "") + '</code> · rete: ' + esc(leak.ad_network || "—") + '</div>';
  } else if (lt.startsWith("dom") || lt.includes("dom") || lt === "video_ad" || lt.includes("video")) {
    evidence = '<div style="font-size:12px;color:var(--muted);margin-top:4px">Selettore: <code style="background:var(--input);padding:1px 5px;border-radius:4px;font-size:11px">' + esc(leak.selector || "—") + '</code></div>';
  }

  let candidate = "";
  if (leak.candidate_rule && typeof leak.candidate_rule === "object") {
    const cond = (leak.candidate_rule.condition || {});
    const urlFilter = esc(cond.urlFilter || "—");
    const domains   = (cond.domains || []).join(", ");
    candidate = '<div style="font-size:12px;color:var(--muted);margin-top:4px">Regola: <code style="background:var(--input);padding:1px 5px;border-radius:4px;font-size:11px">urlFilter: ' + urlFilter + (domains ? ', domains: ' + esc(domains) : '') + '</code></div>';
  } else {
    candidate = '<div style="font-size:12px;color:var(--muted);margin-top:4px;font-style:italic">(nessuna regola DNR — richiede intervento manuale)</div>';
  }

  const screenshotBtn = leak.screenshot_url
    ? '<button class="btn btn-sm btn-outline" style="margin-top:8px" data-fetch-shot="' + esc(leak.fingerprint) + '">🖼 Screenshot</button>'
    : '';

  const noteId  = "note-" + leak.fingerprint;
  const noteVal = leak.note || "";

  return (
    '<div style="background:var(--input);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:12px">' +
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px">' +
        '<b style="color:var(--text)">' + esc(leak.domain || "?") + '</b>' +
        '<span style="background:rgba(124,92,252,.15);color:var(--accent);border-radius:20px;padding:2px 8px;font-size:10px">' + esc(leak.category || "?") + '</span>' +
        '<span style="background:rgba(255,255,255,.07);color:var(--muted);border-radius:20px;padding:2px 8px;font-size:10px">' + esc(leak.leak_type || "?") + '</span>' +
        '<span style="background:' + confColor + ';color:#fff;border-radius:20px;padding:2px 8px;font-size:10px">' + esc(leak.confidence || "?") + '</span>' +
        fpBadge + decisionBadge +
      '</div>' +
      evidence + candidate +
      '<div style="margin-top:8px">' +
        '<input id="' + noteId + '" placeholder="Nota (opzionale)" value="' + esc(noteVal) + '" ' +
          'style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:11px;width:100%;margin-bottom:6px">' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<button class="btn btn-sm btn-success" data-decide-leak="' + esc(leak.fingerprint) + ':fix" ' + (decision==="fix"?"disabled ":"") + '>✅ Fixa</button>' +
          '<button class="btn btn-sm btn-outline" data-decide-leak="' + esc(leak.fingerprint) + ':ignore" ' + (decision==="ignore"?"disabled ":"") + '>🚫 Ignora</button>' +
          '<button class="btn btn-sm btn-outline" data-decide-leak="' + esc(leak.fingerprint) + ':defer" ' + (decision==="defer"?"disabled ":"") + '>⏳ Rimanda</button>' +
          screenshotBtn +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ── Autofix: decisione singola leak ────────────────────────────────────────
async function decideLeak(fingerprint, decision) {
  const noteEl  = document.getElementById("note-" + fingerprint);
  const note    = noteEl ? noteEl.value.trim() : "";
  try {
    const d = await api("/admin/autofix/decision", {
      method: "POST",
      body: JSON.stringify({ fingerprint, decision, note })
    });
    if (!d.ok) { toast("Errore: " + (d.error || "?"), "error"); return; }
    toast("Decisione salvata ✅", "success");
    loadAutofix();
  } catch(e) {
    toast("Errore: " + e.message, "error");
  }
}

// ── Autofix: batch decision per bucket ──────────────────────────────────────
async function batchDecide(bucket, decision) {
  if (!_autofixLeaks) { toast("Carica prima i leak", "error"); return; }
  const leaks = _autofixLeaks.buckets?.[bucket] || [];
  if (!leaks.length) { toast("Nessun leak in questo bucket", "info"); return; }
  if (!confirm("Confermi " + decision + " per " + leaks.length + " leak?")) return;
  const decisions = leaks.map(l => ({ fingerprint: l.fingerprint, decision }));
  try {
    const d = await api("/admin/autofix/decision", {
      method: "POST",
      body: JSON.stringify({ decisions })
    });
    if (!d.ok) { toast("Errore: " + (d.error || "?"), "error"); return; }
    toast(leaks.length + " decisioni salvate ✅", "success");
    loadAutofix();
  } catch(e) {
    toast("Errore: " + e.message, "error");
  }
}

// ── Autofix: richiesta apply (informativa) ─────────────────────────────────
function requestApply() {
  const approved = _autofixLeaks ? (_autofixLeaks.counts?.approved || 0) : 0;
  toast("I fix approvati verranno applicati dal job notturno. Per applicarli subito, scrivi 'applica i fix approvati' nella chat con Claude.", "info");
}

// ── Autofix: fetch screenshot + lightbox ────────────────────────────────────
async function fetchShot(fingerprint) {
  if (!_autofixLeaks) return;
  // trova il leak per fingerprint in tutti i bucket
  let leak = null;
  const buckets = _autofixLeaks.buckets || {};
  for (const arr of Object.values(buckets)) {
    leak = arr.find(l => l.fingerprint === fingerprint);
    if (leak) break;
  }
  if (!leak || !leak.screenshot_url) { toast("Screenshot non disponibile", "error"); return; }
  try {
    const r = await fetch(leak.screenshot_url, { headers: { "X-Admin-Token": token } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    // costruisci lightbox inline
    let lb = document.getElementById("shot-lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "shot-lightbox";
      lb.style = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer";
      lb.onclick = () => { lb.remove(); };
      document.body.appendChild(lb);
    } else {
      lb.innerHTML = "";
    }
    const img = document.createElement("img");
    img.src = url;
    img.style = "max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6)";
    img.onerror = () => { lb.innerHTML = '<div style="color:#fff;padding:24px">Screenshot non disponibile</div>'; };
    lb.appendChild(img);
    // chiudi con X
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style = "position:fixed;top:16px;right:20px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:18px;cursor:pointer;border-radius:50%;width:36px;height:36px;line-height:36px;text-align:center";
    closeBtn.onclick = (e) => { e.stopPropagation(); lb.remove(); };
    lb.appendChild(closeBtn);
  } catch(e) {
    toast("Errore screenshot: " + e.message, "error");
  }
}

async function inspectSeoUrl() {
  const url = document.getElementById("seo-inspect-url").value.trim();
  if (!url) { toast("Inserisci un URL", "error"); return; }
  document.getElementById("seo-inspect-result").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const d = await api("/admin/seo/url-inspect", { method: "POST", body: JSON.stringify({ url }) });
  if (!d.ok) {
    document.getElementById("seo-inspect-result").innerHTML = `<div class="empty" style="padding:16px"><p style="color:var(--danger)">Errore: ${esc(d.error || "?")}</p></div>`;
    return;
  }
  const r = d.result || {};
  const indexResult = r.indexStatusResult || {};
  const coverageResult = r.coverageSummaryResult || {};
  const mobileResult = r.mobileUsabilityResult || {};
  const richResult = r.richResultsResult || {};

  const indexColor = indexResult.indexStatus === "INDEXED" ? "var(--success)" : "var(--danger)";
  const indexText = indexResult.indexStatus === "INDEXED" ? "✅ Indexed" : indexResult.indexStatus === "CRAWLED" ? "⚠️ Crawled" : "❌ Non indicizzato";

  const issues = (r.pageFetchState?.failedCronCause || indexResult.coveringIndexStatus || richResult.verdict || "");

  document.getElementById("seo-inspect-result").innerHTML = `
    <div style="font-size:13px">
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">
        <span style="color:${indexColor};font-weight:700;font-size:14px">${indexText}</span>
        ${coverageResult.issue ? `<span style="color:var(--danger)">⚠️ ${coverageResult.issue}</span>` : ""}
        ${mobileResult.verdict === "PASS" ? '<span style="color:var(--success)">📱 Mobile OK</span>' : mobileResult.verdict === "FAIL" ? '<span style="color:var(--danger)">📱 Mobile issue</span>' : ""}
      </div>
      ${indexResult.sitemap ? `<div style="color:var(--muted);font-size:12px;margin-bottom:4px">Sitemap: <span style="color:var(--success)">✅ Trovato</span> — ${indexResult.sitemap}</div>` : ""}
      ${indexResult.lastCrawlTime ? `<div style="color:var(--muted);font-size:12px;margin-bottom:4px">Ultimo crawl: ${new Date(indexResult.lastCrawlTime).toLocaleDateString()}</div>` : ""}
      ${issues ? `<div style="color:var(--danger);font-size:12px;margin-top:6px">Problema: ${issues}</div>` : '<div style="color:var(--success);font-size:12px;margin-top:6px">✅ Nessun problema rilevato</div>'}
    </div>
  `;
}

async function batchInspectSitemap() {
  const panel = document.getElementById("seo-batch-panel");
  panel.style.display = "";
  document.getElementById("seo-batch-results").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const d = await api("/admin/seo/url-inspect/batch", { method: "POST", body: JSON.stringify({}) });
  if (!d.ok) {
    document.getElementById("seo-batch-results").innerHTML = `<div class="empty"><p style="color:var(--danger)">Errore: ${esc(d.error || "?")}</p></div>`;
    return;
  }
  const results = d.results || [];
  const indexed = results.filter(r => r.indexed).length;
  document.getElementById("seo-batch-results").innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--muted)">
      ${d.inspected}/${d.total} URL ispezionate (max 20 per batch · <a href="${d.sitemapUrl || "https://adoff.app/sitemap.xml"}" target="_blank" style="color:var(--accent)">sitemap</a>)
      — <span style="color:var(--success)">✅ ${indexed} indicizzate</span> / <span style="color:var(--danger)">❌ ${results.length - indexed} no</span>
    </div>
    <div class="table-wrap"><table><thead><tr><th>URL</th><th>Stato</th></tr></thead><tbody>${
      results.map(r => `<tr>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="mono" style="font-size:11px" title="${esc(r.url)}">${esc(r.url)}</span></td>
        <td style="color:${r.indexed ? "var(--success)" : "var(--danger)"}">${r.indexed ? "✅ Indexed" : "❌ " + (r.status || "Not indexed")}</td>
      </tr>`).join("")
    }</tbody></table></div>
  `;
}

async function submitSitemap() {
  const sitemapUrl = "https://adoff.app/sitemap.xml";
  if (!confirm("Submit " + sitemapUrl + " a Google Search Console?")) return;
  const d = await api("/admin/seo/sitemap/submit", { method: "POST", body: JSON.stringify({ sitemapUrl }) });
  if (!d.ok) { toast("Errore: " + (d.error || "?"), "error"); return; }
  toast("✅ Sitemap submitted!");
  document.getElementById("seo-last-sitemap").textContent = new Date().toLocaleString();
}

function exportSeoCsv() {
  window.open("/admin/seo/export", "_blank");
}

// ── SUPPORT ──────────────────────────────────────────────────
let ticketsLoaded = false;

async function loadTickets(force = false) {
  if (ticketsLoaded && !force) return;
  document.getElementById("ticketTableWrap").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const filter = document.getElementById("ticketFilter")?.value || "";
  let url = "/tickets";
  if (filter) url += `?status=${filter}`;
  const d = await api(url);
  if (!d.ok) {
    document.getElementById("ticketTableWrap").innerHTML = `<div class="loading-center" style="color:var(--danger)">Errore: ${esc(d.error || "Impossibile caricare ticket")}</div>`;
    toast("Errore caricamento ticket", "error");
    return;
  }
  const tickets = d.tickets || [];
  ticketsLoaded = true;
  if (!tickets.length) {
    document.getElementById("ticketTableWrap").innerHTML = `<div class="empty"><div class="empty-icon">💬</div><p>Nessun ticket</p></div>`;
    return;
  }
  document.getElementById("ticketTableWrap").innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>ID</th><th>Oggetto</th><th>Email</th><th>Categoria</th><th>Stato</th><th>Data</th><th>Azioni</th>
      </tr></thead>
      <tbody>
        ${tickets.map(t => `<tr>
          <td><span class="mono">${esc(t.id || "–")}</span></td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.subject || "–")}</td>
          <td style="color:var(--muted)">${esc(t.email || "–")}</td>
          <td><span style="color:var(--muted)">${esc(t.category || "–")}</span></td>
          <td><span class="badge badge-${t.status === "open" ? "open" : "closed"}">${esc(t.status || "–")}</span></td>
          <td style="color:var(--muted)">${t.createdAt ? new Date(t.createdAt).toLocaleDateString("it-IT") : "–"}</td>
          <td>
            <button class="btn btn-sm btn-outline" data-ticket-id="${esc(t.id)}">Apri</button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-ticket-id]");
  if (btn) openTicket(btn.dataset.ticketId);
});

async function openTicket(id) {
  document.getElementById("ticketModalTitle").textContent = `Ticket ${id}`;
  document.getElementById("ticketDetail").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  openModal("ticketModal");
  const d = await api(`/ticket/${id}`);
  if (!d.ok) { document.getElementById("ticketDetail").innerHTML = `<p style="color:var(--danger)">Errore: ${esc(d.error)}</p>`; return; }
  const t = d.ticket || d;
  const replies = t.replies || [];
  document.getElementById("ticketToggleStatus")?.addEventListener("click", () => updateTicketStatus(id, t.status === "open" ? "closed" : "open"));
  document.getElementById("ticketSendReply")?.addEventListener("click", () => sendTicketReply(id));
  document.getElementById("ticketDetail").innerHTML = `
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <span class="badge badge-${t.status === "open" ? "open" : "closed"}">${esc(t.status)}</span>
          <span style="margin-left:10px;color:var(--muted);font-size:12px">${t.email || ""}</span>
        </div>
        <div style="display:flex;gap:8px">
          ${t.status === "open"
            ? `<button class="btn btn-sm btn-success" id="ticketToggleStatus">Chiudi ticket</button>`
            : `<button class="btn btn-sm btn-outline" id="ticketToggleStatus">Riapri ticket</button>`}
        </div>
      </div>
      <div class="ticket-reply">
        <div class="reply-meta">${t.email || "Anonimo"} — ${t.createdAt ? new Date(t.createdAt).toLocaleString("it-IT") : ""}</div>
        <div class="reply-text">${esc(t.description || t.body || t.message || "")}</div>
      </div>
      ${replies.map(r => `
        <div class="ticket-reply ${r.by === "admin" ? "admin" : ""}">
          <div class="reply-meta">${r.by === "admin" ? "Admin" : t.email || "Utente"} — ${r.at ? new Date(r.at).toLocaleString("it-IT") : ""}</div>
          <div class="reply-text">${esc(r.text || "")}</div>
        </div>`).join("")}
    </div>
    <hr class="divider">
    <div class="section-title">Rispondi</div>
    <div class="field">
      <textarea id="ticketReply" placeholder="Scrivi una risposta..."></textarea>
    </div>
    <button class="btn btn-primary" id="ticketSendReply">Invia risposta</button>
  `;
}

async function updateTicketStatus(id, status) {
  const d = await api(`/ticket/${id}`, { method: "POST", body: JSON.stringify({ status }) });
  if (!d.ok) { toast(d.error || "Errore", "error"); return; }
  toast(`Ticket ${status === "closed" ? "chiuso" : "riaperto"}`);
  openTicket(id);
  ticketsLoaded = false;
  loadTickets(true);
}

async function sendTicketReply(id) {
  const reply = document.getElementById("ticketReply").value.trim();
  if (!reply) { toast("Scrivi una risposta prima di inviare", "error"); return; }
  const btn = event.target; btn.disabled = true; btn.textContent = "Inviando...";
  const d = await api(`/ticket/${id}`, { method: "POST", body: JSON.stringify({ reply }) });
  btn.disabled = false; btn.textContent = "Invia risposta";
  if (!d.ok) { toast(d.error || "Errore invio", "error"); return; }
  toast("Risposta inviata");
  openTicket(id);
}

// ── SUGGERIMENTI ─────────────────────────────────────────────
let suggLoaded = false;
let _suggCache = {};
const SUGG_TYPE_ICON = { feature:"💡", bug:"🐛", improvement:"⚡" };
const SUGG_STATUS_BADGE = { new:"open", triaged:"open", proposed:"open", approved:"open", in_progress:"open", done:"closed", rejected:"closed" };
const SUGG_STATUSES = ["new","triaged","proposed","approved","in_progress","done","rejected"];

async function loadSuggestions(force = false) {
  if (suggLoaded && !force) return;
  document.getElementById("suggTableWrap").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const status = document.getElementById("suggStatusFilter")?.value || "";
  const type = document.getElementById("suggTypeFilter")?.value || "";
  let url = "/admin/suggestions";
  const qs = [];
  if (status) qs.push(`status=${encodeURIComponent(status)}`);
  if (type) qs.push(`type=${encodeURIComponent(type)}`);
  if (qs.length) url += "?" + qs.join("&");
  const d = await api(url);
  if (!d.ok) {
    document.getElementById("suggTableWrap").innerHTML = `<div class="loading-center" style="color:var(--danger)">Errore: ${esc(d.error || "Impossibile caricare i suggerimenti")}</div>`;
    toast("Errore caricamento suggerimenti", "error");
    return;
  }
  const list = d.suggestions || [];
  suggLoaded = true;
  _suggCache = {};
  list.forEach(s => { _suggCache[s.id] = s; });
  if (!list.length) {
    document.getElementById("suggTableWrap").innerHTML = `<div class="empty"><div class="empty-icon">💡</div><p>Nessun suggerimento</p></div>`;
    return;
  }
  document.getElementById("suggTableWrap").innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>ID</th><th>Tipo</th><th>Titolo</th><th>Voti</th><th>Cluster</th><th>Stato</th><th>Data</th><th>Azioni</th>
      </tr></thead>
      <tbody>
        ${list.map(s => `<tr>
          <td><span class="mono">${s.id || "–"}</span></td>
          <td>${SUGG_TYPE_ICON[s.type] || ""} ${s.type || "–"}</td>
          <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.title || "–")}</td>
          <td>${s.votes != null ? s.votes : 1}</td>
          <td style="color:var(--muted)">${esc(s.cluster || "–")}</td>
          <td><span class="badge badge-${SUGG_STATUS_BADGE[s.status] || "open"}">${s.status || "new"}</span></td>
          <td style="color:var(--muted)">${s.created_at ? new Date(s.created_at.replace(" ","T")+"Z").toLocaleDateString("it-IT") : "–"}</td>
          <td><button class="btn btn-sm btn-outline" data-sugg-id="${esc(s.id)}">Apri</button></td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-sugg-id]");
  if (btn) openSuggestion(btn.dataset.suggId);
});

function openSuggestion(id) {
  const s = _suggCache[id];
  if (!s) { toast("Suggerimento non trovato", "error"); return; }
  document.getElementById("suggModalTitle").textContent = `${SUGG_TYPE_ICON[s.type] || ""} ${id}`;
  const statusOpts = SUGG_STATUSES.map(st => `<option value="${st}" ${s.status === st ? "selected" : ""}>${st}</option>`).join("");
  document.getElementById("suggDetail").innerHTML = `
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <span class="badge badge-${SUGG_STATUS_BADGE[s.status] || "open"}">${s.status || "new"}</span>
        <span style="color:var(--muted);font-size:12px">${esc(s.email || "anon")} · ${esc(s.browser || "")}</span>
      </div>
      <div class="ticket-reply">
        <div class="reply-meta"><b>${esc(s.title || "")}</b> — ${s.created_at ? new Date(s.created_at.replace(" ","T")+"Z").toLocaleString("it-IT") : ""}</div>
        <div class="reply-text">${esc(s.description || "")}</div>
      </div>
      ${s.proposal ? `<div class="ticket-reply admin"><div class="reply-meta">Proposta Claude</div><div class="reply-text">${esc(s.proposal)}</div></div>` : ""}
      ${s.resolution ? `<div class="ticket-reply"><div class="reply-meta">Esito</div><div class="reply-text">${esc(s.resolution)}</div></div>` : ""}
    </div>
    <hr class="divider">
    <div class="section-title">Gestione</div>
    <div class="field" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label style="font-size:12px;color:var(--muted)">Stato</label>
      <select id="suggStatusSel">${statusOpts}</select>
      <input id="suggClusterInp" placeholder="Cluster (tema)" value="${esc(s.cluster || "")}" style="flex:1;min-width:140px">
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" id="suggSave">Salva</button>
      <button class="btn btn-success btn-sm" id="suggApprove">✅ Approva → coda fix</button>
      <button class="btn btn-outline btn-sm" id="suggReject">Rifiuta</button>
    </div>
  `;
  document.getElementById("suggSave")?.addEventListener("click", () => saveSuggestion(id));
  document.getElementById("suggApprove")?.addEventListener("click", () => approveSuggestion(id));
  document.getElementById("suggReject")?.addEventListener("click", () => updateSuggestionStatus(id, "rejected"));
  openModal("suggModal");
}

async function saveSuggestion(id) {
  const status = document.getElementById("suggStatusSel").value;
  const cluster = document.getElementById("suggClusterInp").value.trim();
  const d = await api(`/admin/suggestions/${id}`, { method: "POST", body: JSON.stringify({ status, cluster }) });
  if (!d.ok) { toast(d.error || "Errore", "error"); return; }
  toast("Suggerimento aggiornato");
  closeModal("suggModal");
  loadSuggestions(true);
}

async function approveSuggestion(id) { await updateSuggestionStatus(id, "approved"); }

async function updateSuggestionStatus(id, status) {
  const d = await api(`/admin/suggestions/${id}`, { method: "POST", body: JSON.stringify({ status }) });
  if (!d.ok) { toast(d.error || "Errore", "error"); return; }
  toast(status === "approved" ? "Approvato → in coda fix" : `Stato: ${status}`);
  closeModal("suggModal");
  loadSuggestions(true);
}

// ── MESSAGGI ───────────────────────────────────────────────
let messagesLoaded = false;
let _msgCache = {};

async function loadMessages(force = false) {
  if (messagesLoaded && !force) return;
  document.getElementById("msgTableWrap").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  const filter = document.getElementById("msgStatusFilter")?.value || "";
  let url = "/admin/messages";
  if (filter) url += `?status=${encodeURIComponent(filter)}`;
  const d = await api(url);
  if (!d.ok) {
    document.getElementById("msgTableWrap").innerHTML = `<div class="loading-center" style="color:var(--danger)">Errore: ${esc(d.error || "Impossibile caricare messaggi")}</div>`;
    toast("Errore caricamento messaggi", "error");
    return;
  }
  const threads = d.threads || [];
  messagesLoaded = true;
  _msgCache = {};
  threads.forEach(t => { _msgCache[t.id] = t; });
  if (!threads.length) {
    document.getElementById("msgTableWrap").innerHTML = `<div class="empty"><div class="empty-icon">📩</div><p>Nessun messaggio</p></div>`;
    return;
  }
  document.getElementById("msgTableWrap").innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Email</th><th>Oggetto</th><th>Stato</th><th>Non letti</th><th>Ultimo aggiornamento</th><th></th>
      </tr></thead>
      <tbody>
        ${threads.map(t => `<tr data-msg-id="${esc(t.id)}" style="cursor:pointer">
          <td style="color:var(--muted)">${esc(t.email || "–")}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.subject || "–")}</td>
          <td><span class="badge badge-${t.status === 'open' ? 'open' : 'closed'}">${esc(t.status || "–")}</span></td>
          <td>${(t.unread_by_user || 0) > 0 ? `<span style="background:var(--danger);color:#fff;border-radius:20px;padding:2px 8px;font-size:11px">${Number(t.unread_by_user) || 0}</span>` : "–"}</td>
          <td style="color:var(--muted)">${t.updated_at ? new Date(t.updated_at.replace(" ","T")+"Z").toLocaleString("it-IT") : "–"}</td>
          <td><button class="btn btn-sm btn-outline" data-msg-open="${esc(t.id)}">Apri</button></td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
}

document.addEventListener("click", e => {
  const openBtn = e.target.closest("[data-msg-open]");
  if (openBtn) { e.stopPropagation(); openMessageThread(openBtn.dataset.msgOpen); return; }
  const row = e.target.closest("tr[data-msg-id]");
  if (row) openMessageThread(row.dataset.msgId);
});

async function openMessageThread(id) {
  document.getElementById("msgModalTitle").textContent = `Thread ${id}`;
  document.getElementById("msgDetail").innerHTML = `<div class="loading-center"><div class="loader"></div></div>`;
  openModal("msgModal");
  const d = await api(`/admin/messages/${id}`);
  if (!d.ok) { document.getElementById("msgDetail").innerHTML = `<p style="color:var(--danger)">Errore: ${esc(d.error || "")}</p>`; return; }
  const thread = d.thread || {};
  const msgs = d.messages || [];
  const senderIcon = { user:"👤", admin:"🛡️", ai:"🤖" };
  const msgBubbles = msgs.map(m => {
    const isAdminOrAi = m.sender === "admin" || m.sender === "ai";
    const label = isAdminOrAi ? "Admin" : (thread.email || "Utente");
    const senderClass = isAdminOrAi ? "admin" : "";
    const img = m.attachmentUrl ? `<img src="${esc(m.attachmentUrl)}" style="max-width:280px;border-radius:8px;margin-top:6px">` : "";
    const textIt = m.textIt ? `<div style="font-size:12px;color:var(--muted);font-style:italic;margin-top:4px">Traduzione IT: ${esc(m.textIt)}</div>` : "";
    return `<div class="ticket-reply ${senderClass}">
      <div class="reply-meta">${senderIcon[m.sender] || "👤"} ${esc(label)} — ${m.created_at ? new Date(m.created_at.replace(" ","T")+"Z").toLocaleString("it-IT") : ""}</div>
      <div class="reply-text">${esc(m.text || "")}${textIt}${img}</div>
    </div>`;
  }).join("");
  document.getElementById("msgDetail").innerHTML = `
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <span class="badge badge-${thread.status === 'open' ? 'open' : 'closed'}">${thread.status || "–"}</span>
        <span style="color:var(--muted);font-size:12px">${esc(thread.email || "")}</span>
      </div>
      <div style="margin-bottom:8px;color:var(--muted);font-size:13px;font-weight:600">${esc(thread.subject || "")}</div>
      ${msgBubbles}
    </div>
    <hr class="divider">
    <div class="section-title">Rispondi</div>
    <div class="field">
      <textarea id="msgReply" placeholder="Scrivi una risposta in italiano (verra tradotta automaticamente)..." style="min-height:80px"></textarea>
    </div>

    <button class="btn btn-primary" id="msgSendReply">Invia risposta</button>
  `;
  document.getElementById("msgSendReply")?.addEventListener("click", () => sendMessageReply(id));
}

async function sendMessageReply(id) {
  const reply = document.getElementById("msgReply").value.trim();
  if (!reply) { toast("Scrivi una risposta prima di inviare", "error"); return; }
  const btn = event.target; btn.disabled = true; btn.textContent = "Inviando...";
  const d = await api(`/admin/messages/${id}/reply`, { method: "POST", body: JSON.stringify({ text: reply }) });
  btn.disabled = false; btn.textContent = "Invia risposta";
  if (!d.ok) { toast(d.error || "Errore invio", "error"); return; }
  toast("Risposta inviata");
  openMessageThread(id);
}


// ── SETTINGS ─────────────────────────────────────────────────
async function changePassword() {
  const curr = document.getElementById("settCurrPass").value;
  const np = document.getElementById("settNewPass").value;
  const np2 = document.getElementById("settNewPass2").value;
  const err = document.getElementById("settPassErr");
  const ok = document.getElementById("settPassOk");
  err.className = "err"; ok.className = "ok-msg";
  if (np.length < 8) { err.textContent = "La nuova password deve avere almeno 8 caratteri"; err.className = "err show"; return; }
  if (np !== np2) { err.textContent = "Le password non coincidono"; err.className = "err show"; return; }
  const btn = event.target; btn.disabled = true;
  const d = await api("/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword: curr, newPassword: np })
  });
  btn.disabled = false;
  if (!d.ok) { err.textContent = d.error || "Errore"; err.className = "err show"; return; }
  ok.textContent = "Password aggiornata con successo!"; ok.className = "ok-msg show";
  document.getElementById("settCurrPass").value = "";
  document.getElementById("settNewPass").value = "";
  document.getElementById("settNewPass2").value = "";
}

async function saveRecoveryEmail() {
  const email = document.getElementById("settEmail").value.trim();
  const err = document.getElementById("settEmailErr");
  const ok = document.getElementById("settEmailOk");
  err.className = "err"; ok.className = "ok-msg";
  if (!email) { err.textContent = "Inserisci un'email valida"; err.className = "err show"; return; }
  const btn = event.target; btn.disabled = true;
  const d = await api("/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
  btn.disabled = false;
  if (!d.ok) { err.textContent = d.error || "Errore"; err.className = "err show"; return; }
  ok.textContent = "Email salvata!"; ok.className = "ok-msg show";
}

// ── UTILS ────────────────────────────────────────────────────
function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
// =============================================
// WIRING STATICO (onclick rimossi dal markup per CSP script-src 'self')
// =============================================
document.addEventListener("click", e => {
  const t = e.target;
  const $ = sel => t.closest(sel);
  if ($("#btnLogin")) doLogin();
  else if ($("#btnGoogle")) loginGoogle();
  else if ($("#btnForgot")) doForgot();
  else if ($("#btnReset")) doReset();
  else if ($("#btnLogout")) doLogout();
  else if ($("#btnToggleSidebar")) toggleSidebar();
  else if ($("#overlay")) closeSidebar();
  else if ($("#btnRefreshPage")) refreshCurrentPage();
  else if ($("#btnGenerateKey")) generateKey();
  else if ($("#btnCopyNewKey")) copyKey(document.getElementById("newKeyText").textContent);
  else if ($("#btnBulkRevoke")) bulkAction("revoke");
  else if ($("#btnBulkDelete")) bulkAction("delete");
  else if ($("#btnClearSelection")) clearSelection();
  else if ($("#btnRefreshSeo")) refreshSeo();
  else if ($("#btnInspectSeoUrl")) inspectSeoUrl();
  else if ($("#btnBatchInspect")) batchInspectSitemap();
  else if ($("#btnSubmitSitemap")) submitSitemap();
  else if ($("#btnExportSeoCsv")) exportSeoCsv();
  else if ($("#btnExportSeoPng") && typeof exportSeoPng === "function") exportSeoPng();
  else if ($("#btnReloadAutofix")) { loadAutofix(); loadAutofixLeaks(); }
  else if ($("#btnBulkApproveSelected") && typeof bulkApproveSelected === "function") bulkApproveSelected();
  else if ($("#btnBulkIgnoreSelected") && typeof bulkIgnoreSelected === "function") bulkIgnoreSelected();
  else if ($("#btnGenOutreachCode")) genOutreachCode();
  else if ($("#btnRegisterOutreachCode")) registerOutreachCode();
  else if ($("#btnReloadChats")) loadChats(true);
  else if ($("#btnChangePassword")) changePassword();
  else if ($("#btnSaveRecoveryEmail")) saveRecoveryEmail();
  else if ($("#btnSaveLicense")) saveLicense();
  else {
    const nav = t.closest("[data-page]");
    if (nav) { navTo(nav.dataset.page); return; }
    const panel = t.closest("[data-panel-link]");
    if (panel) { showPanel(panel.dataset.panelLink); return; }
    const tab = t.closest("[data-stats-tab]");
    if (tab) { switchStatsTab(tab.dataset.statsTab); return; }
    const per = t.closest("[data-seo-period]");
    if (per) { setSeoPeriod(Number(per.dataset.seoPeriod)); return; }
    const nb = t.closest("[data-action='toggleNewLicForm']");
    if (nb) { toggleNewLicForm(); return; }
    const bucket = t.closest("[data-bucket]");
    if (bucket && typeof filterAutofixBucket === "function") { filterAutofixBucket(bucket.dataset.bucket); return; }
    const cm = t.closest("[data-close-modal]");
    if (cm) { closeModal(cm.dataset.closeModal); return; }
  }
});
document.addEventListener("input", e => {
  if (e.target.dataset && e.target.dataset.licFilter === "search") filterLicenses();
});
document.addEventListener("change", e => {
  if (e.target.id === "licSelectAll") { toggleSelectAll(e.target); return; }
  if (e.target.dataset && e.target.dataset.licFilter) { filterLicenses(); return; }
  if (e.target.dataset && e.target.dataset.seoFilter !== undefined) { loadSeo(); return; }
  if (e.target.dataset && e.target.dataset.reload === "tickets") { loadTickets(); return; }
  if (e.target.dataset && e.target.dataset.reload === "suggestions") { loadSuggestions(true); return; }
  if (e.target.dataset && e.target.dataset.reload === "messages") { loadMessages(true); return; }
});
