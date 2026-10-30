# AdOff — Checklist fix (rev. 4) · audit completo sito + 3 store

> Ri-verificata il **1 giugno 2026**: sito (home, /install.html, /chi-sono.html) + **Chrome Web Store** (v3.4.1) + **Firefox AMO** (v3.4.5) + **Edge** (link → 404).
> Tieni conto che le nuove versioni sono **in revisione** (fino a 7 gg): ma la revisione pubblica **solo ciò che hai inviato**. Se la submission contiene ancora numeri vecchi, dopo la revisione saranno ancora lì. Le **descrizioni** store si possono spesso aggiornare dalla dashboard.
> **Guardrail:** un solo numero vero ovunque (= ciò che il package contiene). Nessuna scarsità finta. Privacy del founder inclusa.

---

## 🔴 CRITICO 1 — Numeri reali incoerenti su 4 superfici
Oggi lo **stesso dato** è diverso ovunque:

| Dato | Sito | Chrome Store | Firefox (descr.) | Firefox (commenti dev) |
|---|---|---|---|---|
| Regole di rete | **138** | **"100+"** | **138** | **107** |
| Peso | "pochi KB" | **"74 KB"** (ma Dettagli dice 146 KB) | — | — |
| Lingue | **15** | **6** | **15** | — |
| Livelli di protezione | **4** | **3** | 4 | — |
| Versione | — | **3.4.1** (28 mag) | **3.4.5** | 3.4.5 |

**Azione (la più importante di tutte):**
- [ ] Stabilire i **numeri veri dal package** (regole `declarativeNetRequest`, peso reale, n. lingue `_locales`, n. livelli).
- [ ] Propagarli **identici** su: sito + Chrome + Firefox (descrizione **e** commenti sviluppatore) + Edge + screenshot + `constants.json`.
- [ ] Allineare la **versione** su tutti gli store (Chrome è fermo a 3.4.1, Firefox a 3.4.5).
**Fatto quando:** regole, peso, lingue, livelli, versione coincidono su tutte e 4 le superfici e col package.

## 🔴 CRITICO 2 — Privacy del founder esposta sul Chrome Store
La scheda Chrome mostra pubblicamente **email personale (Gmail), numero di cellulare personale e indirizzo di casa** (richiesto da Chrome per i "trader" UE).
**Azione:**
- [ ] Sostituire con **contatti business**: email `support@adoff.app` (già usata su Firefox), un recapito telefonico non personale, e — se possibile — un indirizzo non residenziale.
- [ ] La disclosure "trader" è obbligatoria, ma i **dati** possono essere quelli aziendali, non il tuo Gmail/cellulare.
**Fatto quando:** nessun contatto personale del founder visibile sugli store. *(Per un brand privacy è un punto pesante.)*

---

## 🟠 Store, scheda per scheda

### Chrome Web Store (la più datata — v3.4.1)
- [ ] Aggiornare descrizione: **100+ → numero reale**, **74 KB → peso reale**, **6 → 15 lingue**, **3 → 4 livelli**.
- [ ] Risolvere la contraddizione interna: copy dice "74 KB", i Dettagli dicono "146 KiB".
- [ ] Campo "Languages": valorizzare con le lingue reali (ora solo English).
- [ ] Caricare la versione allineata (3.4.5) e nuovi screenshot.
- [ ] **Nota strategica:** su Chrome la copy usa "content filter / filtro contenuti" invece di "ad blocker" (scelta prudente vs le policy Chrome anti-adblock). Va bene mantenerla soft **per non rischiare il delisting**, ma i **numeri** devono comunque essere veri e coerenti.

### Firefox AMO (v3.4.5)
- [ ] Conflitto interno: descrizione "138 rules" vs commenti sviluppatore "107 static rules" → un solo numero.
- [ ] Trial: dice "15-day" → portare a **30 giorni**.
- [ ] Screenshot ancora "107 rules, 74KB, 6 languages" → rigenerare (numero reale, peso reale, 15 lingue).

### Edge Add-ons — il 404 è un link costruito con l'ID sbagliato
**Diagnosi corretta:** il link in homepage usa il **GUID del Partner Center** (`00a23227-cb9a-415c-88bb-4e9636f7e94b`), che è l'**ID interno della dashboard di gestione**, NON l'ID pubblico dello store. La pagina pubblica Edge usa un ID diverso, in formato `microsoftedge.microsoft.com/addons/detail/{nome}/{ID-pubblico}`. Per questo dà 404.
**Azione:**
- [ ] Aprire il **Partner Center** e verificare lo stato dell'estensione:
  - Se **"Published / In the store"** → copiare il **link pubblico reale** ("View in Store") e metterlo sul sito al posto del GUID.
  - Se **"In certification / In review"** → la pagina pubblica non esiste ancora → marcare Edge **"in arrivo"** finché non è live.
- [ ] **Homepage:** sostituire il link Edge (GUID) con l'URL pubblico reale o con "in arrivo".
- [ ] **Install page:** il pulsante "Edge" punta erroneamente al **Chrome Web Store** → correggere comunque (URL Edge reale o "in arrivo").
**Fatto quando:** il link Edge porta alla scheda pubblica reale (o dice onestamente "in arrivo"), su home e install page.

---

## 🟠 Sito (sotto il tuo controllo, non dipende dalla revisione)
- [ ] **Counter Founder** ancora "—/100": collegarlo al numero reale (100/100 se 0 venduti; mai "—").
- [ ] **Safari incoerente:** la FAQ "È sicuro installare" elenca "Safari Extensions" come canale ufficiale e la CTA finale dice "Disponibile su … Safari …", ma altrove è "in arrivo". Uniformare su **"in arrivo"**.
- [ ] **Conteggio browser:** home dice "5 browser", install.html ne elenca 7. Uniformare.
- [ ] **Versione ZIP** sull'install page: dice v3.4.4, ultima è 3.4.5. Allineare.
- [ ] **Pagina storia EN (`/about`):** non risulta linkata/esistente. Crearla e linkarla (Task K.1) se vuoi pubblico globale.

---

## ✅ Già a posto (nessuna azione)
Recensioni finte rimosse · founder note · pagina Chi sono (IT) · pricing nuovo (2,99 / 19,99→24,99 / 99) · claim AdGuard rimosso · install page ora "store-first" con sideload come fallback · Safari onesto sull'install page · lingue = 15 (coerenti nei testi di sito e Firefox).

## 📊 Dato utile
Utenti reali attuali: **~16 su Chrome** + **1 su Firefox**. Sei pronto per attivare la richiesta recensioni (Task L) e per i primi post "counter Founder".
- Statistiche Chrome (sviluppatore): https://chrome.google.com/webstore/devconsole → AdOff → Stats
- Statistiche Firefox: https://addons.mozilla.org/developers/addon/adoff/statistics/
- Statistiche Edge: Partner Center → Analytics/Reports

---

### Ordine consigliato
1. CRITICO 1 (numeri veri ovunque) + CRITICO 2 (contatti business).
2. Sito: counter, Safari, Edge link/404, browser count, versione ZIP, pagina EN.
3. Store: Chrome (descrizione+versione), Firefox (107/138, trial, screenshot), Edge (in arrivo o URL).
