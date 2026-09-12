#!/usr/bin/env node
// Verifica la logica TTL di loadPage (site/admin-console.html): il timestamp deve segnare l'ultimo
// CARICAMENTO, non l'ultima visita — altrimenti rientri frequenti slittano
// il TTL in avanti e i dati non si aggiornano mai.
// Solo assert, nessun framework. Esecuzione: node sviluppo/tests/test_ttl_router.js
"use strict";

const assert = require("assert");

const PAGE_TTL_MS = 60000;

// Replica di loadPage con clock finto. fixed=true = logica corretta
// (timestamp aggiornato solo quando ricarica), false = variante buggata
// (timestamp aggiornato a ogni visita: il caso 3 deve fallire con questa).
function makeLoadPage(fixed) {
  const _pageLoadedAt = {};
  const loads = [];
  const loadPage = (page, force = false) => {
    if (!force && Date.now() - (_pageLoadedAt[page] || 0) > PAGE_TTL_MS) force = true;
    // FIX: aggiorna il timestamp solo quando si ricarica davvero — segna
    // l'ultimo CARICAMENTO, non l'ultima visita.
    if (force) _pageLoadedAt[page] = Date.now();
    else if (!fixed) _pageLoadedAt[page] = Date.now(); // solo nella variante buggata
    if (force) loads.push(page);
  };
  return { loadPage, loads };
}

const realNow = Date.now;
let fakeNow = 1_000_000; // epoch-like: nel browser reale Date.now() e' ~1.7e12, quindi il primo ingresso supera sempre il TTL
Date.now = () => fakeNow;
try {
  let passed = 0;
  const total = 5;
  const check = (name, fn) => { fn(); passed++; console.log(`  ok: ${name}`); };

  // 1. primo ingresso su una pagina -> ricarica
  check("primo ingresso ricarica", () => {
    const r = makeLoadPage(true);
    r.loadPage("dash");
    assert.strictEqual(r.loads.length, 1);
  });

  // 2. rientro entro il TTL -> non ricarica
  check("rientro entro il TTL non ricarica", () => {
    const r = makeLoadPage(true);
    r.loadPage("dash");
    fakeNow += 30000;
    r.loadPage("dash");
    assert.strictEqual(r.loads.length, 1);
  });

  // 3. REGRESSIONE: rientri ripetuti ogni 30s (sotto il TTL) per 150s totali.
  // Con il bug il timestamp slittava a ogni rientro e non ricaricava mai.
  check("rientri frequenti ricaricano al superamento del TTL dall'ultimo caricamento", () => {
    const r = makeLoadPage(true);
    r.loadPage("dash");
    for (let i = 0; i < 5; i++) {
      fakeNow += 30000; // t=30..150s: a 90s e 150s il TTL dall'ultimo CARICAMENTO e' superato
      r.loadPage("dash");
    }
    assert.ok(r.loads.length >= 2, `attese >=2 ricariche, trovate ${r.loads.length}`);
  });

  // 4. force esplicito (bottone refresh) -> ricarica sempre
  check("force esplicito ricarica sempre", () => {
    const r = makeLoadPage(true);
    r.loadPage("dash");
    fakeNow += 1000;
    r.loadPage("dash", true);
    assert.strictEqual(r.loads.length, 2);
  });

  // 5. il TTL e' per-pagina, non globale
  check("TTL per-pagina, non globale", () => {
    const r = makeLoadPage(true);
    r.loadPage("dash");
    fakeNow += 10000;
    r.loadPage("keys"); // mai vista: ricarica anche se "dash" e' fresca
    assert.strictEqual(r.loads.length, 2);
    r.loadPage("dash"); // ancora fresca: non ricarica
    assert.strictEqual(r.loads.length, 2);
  });

  console.log(`test_ttl_router: ${passed}/${total} OK`);
} finally {
  Date.now = realNow;
}
