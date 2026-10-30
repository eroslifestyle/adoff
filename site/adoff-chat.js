/*
 * AdOff AI Support Chat Widget
 * Bolla flottante + pannello chat collegato a api.adoff.app/chat (LLM locale).
 * Self-contained: stili + markup + logica. Caricato site-wide da adoff-footer.js.
 */
(function () {
  'use strict';
  if (window.__adoffChatLoaded) return;
  window.__adoffChatLoaded = true;

  var API = 'https://api.adoff.app/chat';
  var SUPPORTED = ['it', 'en', 'de', 'fr', 'es', 'pt'];
  var TURNSTILE_SITEKEY = '0x4AAAAAADAtLsfOV1PCgWx_';

  function detectLang() {
    var l = 'en';
    try { l = localStorage.getItem('adoff_lang') || ''; } catch (e) {}
    if (!l) {
      var p = window.location.pathname.split('/')[1];
      if (p && /^[a-z]{2}$/.test(p)) l = p;
    }
    if (!l) l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    l = l.toLowerCase();
    return SUPPORTED.indexOf(l) !== -1 ? l : 'en';
  }
  var LANG = detectLang();

  var T = {
    it: { title: 'Assistente AdOff', sub: 'Risposte immediate, 24/7', ph: 'Scrivi un messaggio…', send: 'Invia', greet: 'Ciao! Sono l\'assistente AdOff. Come posso aiutarti? Posso rispondere su prezzi, attivazione, dispositivi, rimborsi e problemi tecnici.', emailPh: 'La tua email', emailBtn: 'Invia', fallbackBtn: 'Apri il modulo di supporto', err: 'Ops, qualcosa è andato storto. Riprova.', open: 'Hai bisogno di aiuto?' },
    en: { title: 'AdOff Assistant', sub: 'Instant answers, 24/7', ph: 'Type a message…', send: 'Send', greet: 'Hi! I\'m the AdOff assistant. How can I help? I can answer about pricing, activation, devices, refunds and technical issues.', emailPh: 'Your email', emailBtn: 'Send', fallbackBtn: 'Open the support form', err: 'Oops, something went wrong. Please try again.', open: 'Need help?' },
    de: { title: 'AdOff Assistent', sub: 'Sofortige Antworten, 24/7', ph: 'Nachricht schreiben…', send: 'Senden', greet: 'Hallo! Ich bin der AdOff-Assistent. Wie kann ich helfen? Preise, Aktivierung, Geräte, Rückerstattungen und technische Fragen.', emailPh: 'Deine E-Mail', emailBtn: 'Senden', fallbackBtn: 'Support-Formular öffnen', err: 'Ups, etwas ist schiefgelaufen. Bitte erneut versuchen.', open: 'Brauchst du Hilfe?' },
    fr: { title: 'Assistant AdOff', sub: 'Réponses immédiates, 24/7', ph: 'Écrire un message…', send: 'Envoyer', greet: 'Bonjour ! Je suis l\'assistant AdOff. Comment puis-je aider ? Tarifs, activation, appareils, remboursements et problèmes techniques.', emailPh: 'Votre email', emailBtn: 'Envoyer', fallbackBtn: 'Ouvrir le formulaire de support', err: 'Oups, une erreur est survenue. Réessayez.', open: 'Besoin d\'aide ?' },
    es: { title: 'Asistente AdOff', sub: 'Respuestas inmediatas, 24/7', ph: 'Escribe un mensaje…', send: 'Enviar', greet: '¡Hola! Soy el asistente de AdOff. ¿Cómo puedo ayudar? Precios, activación, dispositivos, reembolsos y problemas técnicos.', emailPh: 'Tu email', emailBtn: 'Enviar', fallbackBtn: 'Abrir el formulario de soporte', err: 'Vaya, algo salió mal. Inténtalo de nuevo.', open: '¿Necesitas ayuda?' },
    pt: { title: 'Assistente AdOff', sub: 'Respostas imediatas, 24/7', ph: 'Escreve uma mensagem…', send: 'Enviar', greet: 'Olá! Sou o assistente AdOff. Como posso ajudar? Preços, ativação, dispositivos, reembolsos e problemas técnicos.', emailPh: 'O teu email', emailBtn: 'Enviar', fallbackBtn: 'Abrir o formulário de suporte', err: 'Ups, algo correu mal. Tenta novamente.', open: 'Precisas de ajuda?' }
  };
  var t = T[LANG] || T.en;
  var VERIFYING = {
    it: 'Verifica di sicurezza in corso, riprova tra un istante…',
    en: 'Security check in progress, please try again in a moment…',
    de: 'Sicherheitsprufung lauft, bitte gleich erneut versuchen…',
    fr: 'Verification de securite en cours, reessayez dans un instant…',
    es: 'Verificacion de seguridad en curso, intentalo en un momento…',
    pt: 'Verificacao de seguranca em curso, tenta de novo num instante…'
  };
  t.verifying = VERIFYING[LANG] || VERIFYING.en;

  function supportUrl() { return LANG === 'it' ? '/support' : '/support?lang=' + LANG; }

  function sessionId() {
    var s = '';
    try { s = localStorage.getItem('adoff_chat_sid') || ''; } catch (e) {}
    return s;
  }
  function saveSession(s) { try { localStorage.setItem('adoff_chat_sid', s); } catch (e) {} }

  // ─── Styles ────────────────────────────────────────────────────────────────
  var css = [
    '#adoff-chat-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#7c5cfc;border:none;cursor:pointer;box-shadow:0 8px 28px rgba(124,92,252,.45);z-index:99998;display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}',
    '#adoff-chat-btn:hover{transform:scale(1.07);box-shadow:0 10px 34px rgba(124,92,252,.6)}',
    '#adoff-chat-btn svg{width:28px;height:28px;fill:#fff}',
    '#adoff-chat-btn .adoff-chat-badge{position:absolute;top:-4px;right:-4px;background:#4ade80;color:#06281a;font-size:10px;font-weight:800;padding:2px 6px;border-radius:10px;font-family:system-ui,sans-serif}',
    '#adoff-chat-panel{position:fixed;bottom:90px;right:20px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#0e0e22;border:1px solid #2a2a4a;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.5);z-index:99999;display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,sans-serif}',
    '#adoff-chat-panel.open{display:flex;animation:adoffChatIn .22s ease}',
    '@keyframes adoffChatIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '.adoff-chat-head{background:linear-gradient(135deg,#7c5cfc,#5a3ce0);padding:16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0}',
    '.adoff-chat-head .adoff-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:15px}',
    '.adoff-chat-head h3{margin:0;font-size:15px;color:#fff;font-weight:700}',
    '.adoff-chat-head p{margin:1px 0 0;font-size:11px;color:rgba(255,255,255,.8);display:flex;align-items:center;gap:5px}',
    '.adoff-chat-head .adoff-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block}',
    '.adoff-chat-close{margin-left:auto;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;opacity:.8;line-height:1}',
    '.adoff-chat-close:hover{opacity:1}',
    '.adoff-chat-msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px}',
    '.adoff-msg{max-width:84%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}',
    '.adoff-msg.bot{background:#1a1a36;color:#dcdcec;align-self:flex-start;border-bottom-left-radius:4px}',
    '.adoff-msg.user{background:#7c5cfc;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.adoff-typing{align-self:flex-start;background:#1a1a36;padding:13px 16px;border-radius:14px;display:flex;gap:4px}',
    '.adoff-typing span{width:7px;height:7px;border-radius:50%;background:#7c5cfc;animation:adoffBlink 1.2s infinite}',
    '.adoff-typing span:nth-child(2){animation-delay:.2s}.adoff-typing span:nth-child(3){animation-delay:.4s}',
    '@keyframes adoffBlink{0%,60%,100%{opacity:.3}30%{opacity:1}}',
    '.adoff-chat-foot{padding:12px;border-top:1px solid #2a2a4a;display:flex;gap:8px;flex-shrink:0}',
    '.adoff-chat-foot input{flex:1;background:#1a1a36;border:1px solid #2a2a4a;border-radius:10px;padding:11px 14px;color:#fff;font-size:14px;outline:none}',
    '.adoff-chat-foot input:focus{border-color:#7c5cfc}',
    '.adoff-chat-foot button{background:#7c5cfc;border:none;border-radius:10px;padding:0 16px;color:#fff;font-weight:700;font-size:14px;cursor:pointer}',
    '.adoff-chat-foot button:disabled{opacity:.5;cursor:default}',
    '.adoff-chat-fallback{margin:6px 0 0;align-self:flex-start}',
    '.adoff-chat-fallback a{display:inline-block;background:#1a1a36;border:1px solid #7c5cfc;color:#b8a9ff;text-decoration:none;padding:9px 14px;border-radius:10px;font-size:13px;font-weight:600}',
    '@media(max-width:480px){#adoff-chat-panel{right:8px;bottom:80px;width:calc(100vw - 16px)}#adoff-chat-btn{bottom:16px;right:16px}}'
  ].join('');
  function boot() {
  var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  // ─── Markup ──────────────────────────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.id = 'adoff-chat-btn';
  btn.setAttribute('aria-label', t.open);
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.6 1.23 4.94 3.2 6.57L4 22l4.9-2.3c.98.2 2 .3 3.1.3 5.52 0 10-4.04 10-9S17.52 2 12 2z"/></svg><span class="adoff-chat-badge">AI</span>';
  document.body.appendChild(btn);

  var panel = document.createElement('div');
  panel.id = 'adoff-chat-panel';
  panel.innerHTML =
    '<div class="adoff-chat-head">' +
      '<div class="adoff-avatar">A</div>' +
      '<div><h3>' + t.title + '</h3><p><span class="adoff-dot"></span>' + t.sub + '</p></div>' +
      '<button class="adoff-chat-close" aria-label="close">&times;</button>' +
    '</div>' +
    '<div class="adoff-chat-msgs" id="adoff-chat-msgs"></div>' +
    '<div class="adoff-chat-foot">' +
      '<input id="adoff-chat-input" type="text" placeholder="' + t.ph + '" autocomplete="off" maxlength="2000">' +
      '<button id="adoff-chat-send">' + t.send + '</button>' +
    '</div>';
  document.body.appendChild(panel);

  var msgsEl = panel.querySelector('#adoff-chat-msgs');
  var inputEl = panel.querySelector('#adoff-chat-input');
  var sendEl = panel.querySelector('#adoff-chat-send');
  var greeted = false, pendingEmailFor = null, busy = false;

  // ─── Turnstile (anti-bot, solo primo messaggio di sessione) ──────────────────
  var tsToken = '', tsWidgetId = null, tsContainer = null, tsLoading = false, tsRetries = 0;
  var pendingSend = null;
  function loadTurnstile() {
    if (window.turnstile) { renderTurnstile(); return; }
    if (tsLoading) return;
    tsLoading = true;
    window.__adoffTsOnload = renderTurnstile;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__adoffTsOnload&render=explicit';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }
  function renderTurnstile() {
    if (!window.turnstile || tsWidgetId !== null) return;
    if (!tsContainer) {
      tsContainer = document.createElement('div');
      tsContainer.id = 'adoff-ts';
      tsContainer.style.cssText = 'height:0;overflow:hidden';
      panel.insertBefore(tsContainer, panel.querySelector('.adoff-chat-foot'));
    }
    try {
      tsWidgetId = window.turnstile.render(tsContainer, {
        sitekey: TURNSTILE_SITEKEY,
        callback: function (tok) {
          tsToken = tok;
          if (pendingSend) { var m = pendingSend; pendingSend = null; doSend(m.text, m.email); }
        },
        'expired-callback': function () { tsToken = ''; },
        // Turnstile non disponibile (es. errore 600010 / rete): non bloccare la chat.
        // Procedi senza token: il backend applica comunque rate-limit + anti-abuso.
        'error-callback': function () {
          tsToken = '';
          if (pendingSend) { var m = pendingSend; pendingSend = null; doSend(m.text, m.email); }
        }
      });
    } catch (e) { /* noop */ }
  }
  function resetTurnstile() {
    tsToken = '';
    if (window.turnstile && tsWidgetId !== null) { try { window.turnstile.reset(tsWidgetId); } catch (e) {} }
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // Converte testo semplice in HTML sicuro con link cliccabili (markdown + URL nudi + adoff.app).
  function linkify(text) {
    var s = esc(text); // escape HTML prima di tutto (anti-XSS)
    // markdown [label](https://url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    // URL nudi http(s):// (non dentro un href gia' creato)
    s = s.replace(/(^|[^"=\/>])(https?:\/\/[^\s<]+)/g, function (m, pre, url) {
      var trail = ''; var mm = url.match(/[.,;:!?)]+$/); if (mm) { trail = mm[0]; url = url.slice(0, -trail.length); }
      return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + trail;
    });
    // dominio adoff.app senza schema (es. adoff.app/support)
    s = s.replace(/(^|[\s(>])((?:www\.)?adoff\.app[^\s<]*)/g, function (m, pre, dom) {
      var trail = ''; var mm = dom.match(/[.,;:!?)]+$/); if (mm) { trail = mm[0]; dom = dom.slice(0, -trail.length); }
      return pre + '<a href="https://' + dom + '" target="_blank" rel="noopener noreferrer">' + dom + '</a>' + trail;
    });
    return s.replace(/\n/g, '<br>');
  }

  function addMsg(text, who) {
    var m = document.createElement('div');
    m.className = 'adoff-msg ' + who;
    if (who === 'user') { m.textContent = text; }
    else { m.innerHTML = linkify(text); }
    msgsEl.appendChild(m);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return m;
  }
  function showTyping() {
    var d = document.createElement('div');
    d.className = 'adoff-typing'; d.id = 'adoff-typing';
    d.innerHTML = '<span></span><span></span><span></span>';
    msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() { var d = document.getElementById('adoff-typing'); if (d) d.remove(); }

  function addFallback() {
    var w = document.createElement('div');
    w.className = 'adoff-chat-fallback';
    w.innerHTML = '<a href="' + supportUrl() + '">' + t.fallbackBtn + '</a>';
    msgsEl.appendChild(w); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function addEmailField() {
    var w = document.createElement('div');
    w.className = 'adoff-chat-foot'; w.style.borderTop = 'none'; w.style.padding = '0 18px 6px';
    w.innerHTML = '<input type="email" id="adoff-chat-email" placeholder="' + t.emailPh + '"><button id="adoff-chat-email-btn">' + t.emailBtn + '</button>';
    msgsEl.appendChild(w); msgsEl.scrollTop = msgsEl.scrollHeight;
    var eb = w.querySelector('#adoff-chat-email-btn');
    var ei = w.querySelector('#adoff-chat-email');
    ei.focus();
    eb.addEventListener('click', function () {
      var em = ei.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { ei.style.borderColor = '#f43f5e'; return; }
      w.remove();
      send(pendingEmailFor || '', em);
      pendingEmailFor = null;
    });
    ei.addEventListener('keydown', function (e) { if (e.key === 'Enter') eb.click(); });
  }

  function send(text, email) {
    if (busy) return;
    text = (text || inputEl.value).trim();
    if (!text) return;
    if (!email) addMsg(text, 'user');
    inputEl.value = '';
    doSend(text, email);
  }

  // Invio diretto al backend. Nessun gating Turnstile lato chat: l'assistente deve
  // rispondere sempre. La protezione anti-abuso e' lato worker (rate-limit per IP
  // 8/min + 80/giorno, anti prompt-injection, cap messaggi per sessione).
  function doSend(text, email) {
    if (busy) return;
    busy = true; sendEl.disabled = true;
    if (!document.getElementById('adoff-typing')) showTyping();
    var sid = sessionId();
    var payload = { message: text, lang: LANG };
    if (sid) payload.sessionId = sid;
    if (email) payload.email = email;

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        busy = false; sendEl.disabled = false;
        hideTyping();
        if (d.sessionId) saveSession(d.sessionId);
        if (!d.ok) { addMsg(t.err, 'bot'); addFallback(); return; }
        addMsg(d.reply || t.err, 'bot');
        if (d.fallback) { addFallback(); return; }
        if (d.needEmail) { pendingEmailFor = text; addEmailField(); return; }
      }).catch(function () {
        hideTyping(); busy = false; sendEl.disabled = false;
        addMsg(t.err, 'bot'); addFallback();
      });
  }

  function openPanel() {
    panel.classList.add('open');
    if (!greeted) { addMsg(t.greet, 'bot'); greeted = true; }
    setTimeout(function () { inputEl.focus(); }, 100);
  }
  function closePanel() { panel.classList.remove('open'); }

  btn.addEventListener('click', function () { panel.classList.contains('open') ? closePanel() : openPanel(); });
  panel.querySelector('.adoff-chat-close').addEventListener('click', closePanel);
  sendEl.addEventListener('click', function () { send(); });
  inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }

  // Bootstrap a prova di race: costruisci solo quando <body> esiste. Lo script e'
  // caricato async (immutable-cached): se viene eseguito prima che il body sia pronto,
  // l'append fallirebbe lasciando il flag __adoffChatLoaded a true (bottone mancante
  // fino a F5). Differendo a DOMContentLoaded il bottone compare sempre.
  if (document.body) { boot(); }
  else { document.addEventListener('DOMContentLoaded', boot, { once: true }); }
})();
