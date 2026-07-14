# PLAN — Riprogettazione sistema VPN & DNS Guard (2026-07-14)

> Frutto di 30 sessioni AskUserQuestion (6 blocchi) + 4 verifiche subagent (backend, popup, mobile, costi/proxy/multi-device).
> Fonte di verità delle decisioni prese. Da questo file si implementa.

---

## 0. STATO ATTUALE (verificato)

Tre cose diverse chiamate "VPN/DNS", architetture distinte:

| Sistema | Cos'è oggi | Stato |
|---|---|---|
| **VPN browser** (VPNresellers) | Popup genera solo un file WireGuard `.conf` da importare a mano in client esterno. NON instrada traffico (impossibile in MV3). | Gate solo client-side. **Bug**: `/vpn/create` manda solo `email`, worker pretende `username+password` → flusso rotto. **Nessun gating server-side** → chiunque abusa via curl. |
| **App mobile Flutter** | `VpnService` Android locale (TUN loopback) che filtra SOLO DNS contro blocklist di 349 domini, upstream Cloudflare 1.1.1.1. Non nasconde IP, non cifra. | Codice Kotlin implementato. **Bug**: `/verify-mobile-license` risponde 405 (registrato solo POST, client chiama GET) → verifica trial mobile morta. No verifica firma client-side. |
| **DNS Guard** (site/android-dns.html) | Solo una GUIDA che rimanda ad AdGuard DNS pubblico (`dns.adguard.com`). Zero backend AdOff. | Live, onesto (già dichiara dipendenza da terzi). |

### Fatti economici/tecnici decisivi (verificati con fonte)
- **VPNresellers costa $1,99/account/mese** (1–1.000 acc.), $0,99 oltre. **NON fattura a banda/GB** — solo per account attivo. Billing prepaid, addebito **giornaliero**, disattivi account → smetti di pagare. Minimo ricarica $25. Fonte: vpnresellers.com/vpn-reseller-pricing.
- **1 account = fino a 10 connessioni simultanee "on any kind of device"**. Billing **per utente, NON per device**. → **3 device dello stesso utente = $1,99 totali, NON $5,97**. Fonte: help.vpnresellers.com.
- **VPNresellers espone solo WireGuard/OpenVPN/VLESS**, nessun proxy HTTP/SOCKS. `chrome.proxy` accetta solo http/https/socks → **VPN-estensione stile NordVPN NON fattibile con VPNresellers** (NordVPN ha infra proxy propria). Fonte: api.vpnresellers.com/docs/v4_1.
- **Caveat multi-device WireGuard** (non documentato, inferenza): la config WireGuard è statica per (account, server). Stessa config su 3 device contemporanei → possibile roaming-hijack instabile. OpenVPN supporta multi-sessione nativa. → **richiede test empirico prima del lancio**.

---

## 1. DECISIONI PRESE (contratto)

### Modello economico
- **La VPN è inclusa in un nuovo tier superiore chiamato "Premium"** (NON "Pro+"). Pro adblock base resta invariato.
- **Prezzi Premium**:
  - Mensile: **€4,99/mese** (costo VPN ~€1,85 → margine ~€3,1).
  - Annuale **Founder** (primi 100): **€29,99 primo anno** → al rinnovo **€49,99 standard**.
  - Annuale **standard** (oltre i 100): **€49,99/anno**.
  - **Differenza dal Founder adblock**: lo sconto Founder Premium vale **solo il 1° anno**, poi standard (perché la VPN ha costo ricorrente reale, a differenza dell'adblock ~0).
  - **Founder Premium = pool SEPARATO** (nuovi 100 posti, contatore distinto da founder_seats adblock). Chi è già Founder adblock può comunque prendere un posto Founder Premium.
  - **NO Lifetime con VPN**: la Founder Lifetime (€99) resta **solo adblock** — una tantum + VPN a costo ricorrente = perdita dopo ~50 mesi. Chi ha Lifetime adblock può aggiungere la VPN come abbonamento Premium separato.
- **Pro adblock base INVARIATO**: €2,99/mese, €19,99 Founder / €24,99 std annuale, trial 30gg. Nessun utente esistente toccato.
- **Cap 3 device per licenza Premium** (allineato al "fino a 3 dispositivi personali" già comunicato; sotto le 10 connessioni VPNresellers).

### Chi riceve la VPN (matrice accesso)
- ✅ **Solo Premium paganti attivi** (mensile o annuale).
- ❌ **NO trial · NO Pro base · NO Free** — nessuna eccezione.
- ✅ **Owner/staff esente** (accesso pieno senza pagare — modello OmniaStudio owner).
- Fine abbonamento/disdetta → **account VPN disattivato subito**.

### Trial & referral
- **Nessun assaggio VPN nel trial**. Trial = esperienza adblock Pro completa; la VPN è invisibile finché non paghi Premium.
- **Referral = giorni Pro adblock (NO VPN)**. Protegge il margine dal referral-gaming.

### Controllo costi VPN (tutti attivi)
1. **Auto-disable account VPN inattivi dopo 7 giorni** senza connessione — IL controllo principale (billing giornaliero). Riattivazione **automatica trasparente** alla riconnessione (worker rileva Premium valido + account disabilitato → `/vpn/enable` auto, l'utente non nota nulla).
2. **Disable immediato a fine abbonamento**.
3. **1 account VPNresellers per licenza** (legato al deviceId firmato).
4. **Cap banda → SOLO clausola ToS** (NON cap tecnico). Motivo verificato: VPNresellers **non espone i GB/account via API** (solo `balance`), P2P/torrent **è consentito**, nessuna soglia GB pubblica. Il cap non è tecnicamente misurabile da noi → si degrada a clausola contrattuale "uso personale ragionevole, ci riserviamo di limitare abusi anomali" allineata al ToS upstream.

### Rischio DMCA / legale (P2P consentito, banda non misurabile)
- **ToS utente**: vieta uso illegale + dichiara **no-log** (non possiamo identificare chi fa cosa — standard settore VPN).
- **Verifica contratto reseller VPNresellers** (firmato all'onboarding, non pubblico) per chiarire chi risponde legalmente agli abusi utente. → azione owner.
- **Kill-switch abuse**: su abuse report → `/vpn/disable` immediato dell'account incriminato. (Diverso dal kill-switch privacy client-side.)

### Refund & no-log (tensione risolta)
- **Refund = pro-rata sui giorni di ABBONAMENTO trascorsi** (come qualsiasi SaaS), NON sull'uso VPN. Disable VPN immediato al refund.
- **Risolve il conflitto no-log**: NON serve tracciare l'uso VPN per il refund → il no-log del traffico resta intatto.
- **No-log = trasparenza dichiarata**: i termini spiegano esattamente cosa si traccia = **solo stato connessione/account per billing** (attivo/disattivo, ultima connessione per l'auto-disable-7gg), MAI il traffico/siti. Coerente con "prodotto onesto".

### Codice condiviso cross-platform (massima riusabilità)
- **Verifica licenza/token ECDSA** identica su browser/mobile/desktop (un solo sistema auth).
- **Endpoint worker VPN condivisi** (`/vpn/*` con gating) — un backend per tutte le piattaforme.
- **Blocklist DNS condivisa** via rules-feed remoto (mobile DNS Guard + desktop allineati).
- **UX scelta server** (pattern vpn-tray) replicata su mobile e desktop.

### Schema licenza & pagamenti
- **Licenza**: flag **`tier: premium`** sulla licenza esistente (pro|premium). La VPN si abilita se `tier===premium`. Un solo sistema licenze.
- **Verifica Premium server-side**: **token licenza Premium firmato ECDSA** (include tier+scadenza), verificato con firma — **stateless**, no query D1 per chiamata (evita la falla quota D1/KV già vista). Coerente col trial anti-crack.
- **Upgrade Pro→Premium**: **proration Stripe** (credito residuo Pro scalato dal Premium).
- **Pagamento fallito**: **disable VPN immediato** al primo fallimento MA **auto-riattivazione al pagamento** — riusa lo STESSO meccanismo dell'auto-disable-7gg (account disabilitato + credenziali/licenza valide → `/vpn/enable` auto alla riconnessione). Un unico sistema copre inattività E pagamento fallito.

### Anti-abuso / sicurezza (tutte le misure)
- **Gating server-side obbligatorio**: il worker verifica il **token licenza Premium ECDSA** (tier=premium attivo) PRIMA di ogni `/vpn/*`. Oggi assente = falla (chiunque abusa via curl).
- **1 account VPN per deviceId, non condivisibile** (riusa schema anti-crack).
- **Rate-limit stretto su /vpn/create** (anti-spam account che costano $1,99 ciascuno).
- **Nonce/timestamp anti-replay** sul token Premium.
- **Binding IP/deviceId sulla config** (config legata al deviceId richiedente, riuso altrove = rifiutato).
- **Log audit operazioni VPN admin** (create/enable/disable: chi/quando/quale account — MAI il traffico).
- **Anti-fraud trial** (riusa v3.5.33) per impedire trial usa-e-getta.

### VPN browser
- **RIMOSSA dal browser** (impossibile instradare traffico con VPNresellers; no false promesse). Il bug `/vpn/create` muore con il vecchio codice.
- **Upsell su tutti i punti**: banner nel popup ('VPN su app' + link download) + sezione dedicata 'AdOff Premium' con CTA checkout + pagina in options. Presenza completa.
- **Badge licenza a 3 livelli**: **Free / Pro / Premium** (Premium con icona/colore VPN distinto). Aggiorna license-client + UI popup/options.

### Struttura codice
- **Modulo VPN separato** importato dal worker (gating, auto-disable, provisioning) — worker già >800 righe, rispetta 'una responsabilità per file'.
- **Scheduler**: **Cron Trigger Cloudflare giornaliero** — query account VPN attivi, controlla ultima connessione (>7gg → disable) E stato abbonamento (scaduto → disable). Un solo cron copre entrambi. (Webhook Stripe per disable immediato alla disdetta = miglioria futura opzionale.)

### Naming/posizionamento
- Nomi separati e distinti:
  - **AdOff VPN** = tunnel reale IP-hiding (app native mobile/desktop).
  - **AdOff DNS Guard** = DNS-blocking mobile (VpnService locale).
  - **Private DNS** = la guida AdGuard (invariata).

### DNS Guard mobile
- **Freemium**: blocking DNS base gratis (acquisizione), feature avanzate (blocklist estesa/stats) Pro.
- **Blocklist**: statica grande (da liste pubbliche EasyList/AdGuard DNS) + **update remoto** (riusa pattern rules-feed).
- **DoH proprietario**: NO — si tiene la guida AdGuard (zero costi/infra).

### Piattaforme VPN reale (visione)
- **Mobile Android + Desktop in PARALLELO** = prima ondata.
- Browser proxy — **escluso** (vincolo VPNresellers).
- **iOS = 3ª piattaforma** (dopo Android+Desktop stabili). Richiede Apple Developer + NEPacketTunnelProvider + review severa.
  - **Adblock iOS** = solo **DNS Guard (Private DNS)** + **Safari content blocker** (Apple vieta VpnService-style per adblock). La VPN reale iOS è separata (NEPacketTunnel).

### Kill-switch (feature Premium privacy)
- **Kill-switch ON** come feature Premium: se la VPN cade, il traffico è bloccato (no leak IP). Mobile via VpnService, desktop via firewall rules. Standard delle VPN serie, differenziatore.

### App desktop AdOff VPN (nuova, cross-platform)
- **Stack: Tauri** (Rust+web, leggero, Rust gestisce bene WireGuard/rete).
- **NON** fork di vpn-tray: app nuova cross-platform. Da vpn-tray si riusa la **UX** (scelta server paese→città, web picker filtrato, fast-connect, country-lock, auto-rotation) + la **logica** come reference.
- vpn-tray attuale = applet Linux Mullvad/Tailscale (backend diverso). Sostituire Tailscale→VPNresellers (WireGuard/OpenVPN) + gating licenza AdOff.

### Feature avanzate VPN (differenziatori Premium)
- **Auto-rotation server** (cambia server a intervalli — privacy++, pochi consumer VPN ce l'hanno).
- **Fast-connect / server ottimale** (1 click).
- **Country-lock** (blocca su paese, utile geo-streaming).

### UX scelta server
- Replica il pattern **vpn-tray**: menu/picker raggruppato paese→città, filtrabile, con fast-connect. Adattato ai server VPNresellers reali del progetto AdOff.

### Dashboard VPN utente
- **Sezione VPN in /account** (dashboard già consolidata): stato account VPN, server, device collegati (max 3), download config, disconnetti.
- **Gestione device self-service**: lista device VPN attivi + **revoca** per liberare uno slot (cambio telefono ecc.). Come le VPN serie.

### Supporto & onboarding VPN
- **Supporto**: **FAQ VPN self-service** (connessione, server, config, kill-switch) + **categoria 'VPN' nel triage** esistente con thread Telegram dedicato (routing per categoria già attivo).
- **Onboarding VPN**: **wizard in-app** al primo avvio VPN (scarica app se serve → scegli server → connetti → spiega kill-switch) + **guida sul sito** con tooltip contestuali.

### Valuta pagamento
- **Multi-valuta automatica Stripe** (rileva valuta locale — miglior UX internazionale, importante per mercato VPN US). ⚠️ Complica pricing/founder/report → gestire la conversione dei prezzi Founder e dei report margine.

### DNS vs VPN mobile
- Convivenza nello slot VPN Android unico → **design in Fase 2**.
- Protocollo default (WireGuard vs OpenVPN) → **deciso dopo test empirico**.

### Strategia & brand
- **Parti subito** — VPN strategica, nessuna validazione preliminare di mercato.
- **Brand: feature dentro AdOff, un solo brand** = **"AdOff Premium"** con VPN inclusa. Un checkout, un'app, sfrutta il brand esistente. (Il naming "AdOff VPN" resta uso descrittivo interno per il tunnel reale, non un sotto-brand separato.)

### Metriche di successo (tutte tracciate)
- **Conversion rate Pro→Premium** (appeal VPN).
- **Margine netto reale VPN** (ricavi − costo VPNresellers effettivo, verifica ROI reale vs teorico).
- **Churn Premium vs Pro** (retention: la VPN vale se i Premium restano di più).
- **Utilizzo VPN** (% Premium che la usano davvero — se pochi, account inutili pagati).

### Tracking progetto
- **PLAN** (questo file) = design congelato. **PROGRESS.md** = stato esecutivo per fase + checkpoint a fine di ogni fase.

### Messaging (regole globali rispettate: CTA con "free", pain-point, onesto, Telegram EN)
- Onestà piattaforme: "VPN su app, non browser".
- Pain-point: "Blocca ads E nascondi il tuo IP con un solo abbonamento".
- Bundle value: "Adblock + VPN a meno di una VPN da sola".
- Telegram @adoffapp annuncio EN al lancio con immagine brand nuova.

### Posizionamento competitor (riusa sistema vs/ SEO esistente)
- Pagine **vs/ dedicate** per 3 angoli: **vs VPN pure** (NordVPN/Proton — "adblock incluso, costa meno") · **vs AdGuard VPN** (bundle diretto — prezzo/onestà/stealth) · **vs Brave** ("adblock+VPN su QUALSIASI browser, non solo il suo").

### Legale VPN
- **Documento VPN Policy dedicato**: no-log statement, giurisdizione (EU generico), esattamente cosa si traccia (stato connessione/account per billing, MAI traffico), P2P consentito, uso lecito. Le VPN serie ce l'hanno → fiducia. Review legale prima di pubblicare.

### Monitoring VPN (infra/costi in produzione)
- **Alert balance reseller basso** → Telegram (ricarica prima che gli account si disattivino per credito esaurito).
- **Dashboard admin**: N account VPN attivi × $1,99 = costo mensile stimato + trend (ROI real-time).
- **Alert errori API VPNresellers** (create/enable/config falliti = Premium non si connette = urgente).
- **Report settimanale margine VPN** (ricavi Premium vs costo VPN reale — traccia il margine netto).

### Bug da fixare
- `/vpn/create` (email vs username+password) → fix dentro la riprogettazione.
- `/verify-mobile-license` 405 (GET non gestito) → fix + **aggiungere verifica firma ECDSA client-side** nel Dart (oggi si fida ciecamente).

### Aggiornamento pricing docs
- PRICING-PLAN.md + constants.json (SSOT) + pagine pricing aggiornati **solo dopo test E2E** del flusso Premium (checkout + gating + VPN funzionante).

---

## 2. SEQUENZA ROLLOUT (sicurezza → feature → lancio)

### FASE 0 — Sicurezza & fix (nessuna feature nuova visibile)
- [ ] **Modulo VPN separato** (refactor: estrai logica VPN dal worker.js in modulo dedicato importato).
- [ ] Gating server-side su tutti gli endpoint `/vpn/*` (verifica token ECDSA Premium attivo, tier=premium). Bloccante. Test: non-Premium → 403.
- [ ] Fix bug `/verify-mobile-license` (gestire GET) + verifica firma ECDSA client-side Dart.
- [ ] **Cron Trigger Cloudflare giornaliero**: disable account VPN inattivi >7gg + disable account con abbonamento scaduto. Auto-riattivazione trasparente alla riconnessione (Premium valido + account disabled → enable).
- [ ] 1 account VPN ↔ deviceId lock + rate-limit endpoint VPN.
- [ ] **Test empirico multi-device — WireGuard E OpenVPN a confronto**: 2-3 device con stessa/diverse config → coesistono o kick? Confronta i due protocolli su multi-device 3-device e scegli il default. GATE del lancio VPN. (1 account = 10 connessioni per doc, ma WireGuard config statica = rischio roaming-hijack non testato.)

### FASE 1 — Tier Premium & pulizia
- [ ] Checkout Stripe: nuovo SKU Premium (mensile €4,99 · annuale Founder €29,99→€49,99 · std €49,99) con price_data inline + gating Founder-100 (riusa pattern founder_seats).
- [ ] Emissione licenza Premium (estende schema licenza esistente con flag `premium`/`vpn`).
- [ ] Provisioning account VPN al primo uso Premium (fix flusso create con username/password generati).
- [ ] **Rimuovere la UI VPN dal popup browser** → sostituire con upsell "VPN su app AdOff".
- [ ] Cap 3 device per licenza Premium.

### FASE 2 — VPN reale mobile + DNS Guard mobile
- [ ] VpnService mobile: da DNS-filter locale → **tunnel reale** verso server VPNresellers (WireGuard/OpenVPN secondo esito test Fase 0).
- [ ] DNS Guard freemium: blocklist statica grande + update remoto (rules-feed pattern).
- [ ] Gating Premium mobile (token verificato client + server).

### FASE 1bis — Test E2E (gate prima di aggiornare doc pubblici)
- [ ] Stripe test mode: checkout Premium completo simulato (webhook → licenza → tier=premium).
- [ ] Account VPNresellers di test reale (create/enable/config/disable via API).
- [ ] Test connessione VPN reale su 3 device (= test multi-device WireGuard/OpenVPN).
- [ ] Test gating: non-Premium NON può usare /vpn/* (403).

### FASE 3 — Lancio & comunicazione
- [ ] Aggiornare PRICING-PLAN.md + constants.json + pagine pricing (dopo test E2E).
- [ ] Messaging sito: onestà piattaforme + pain-point + bundle, **15 lingue al lancio** (i18n _matrix.json + i18n_manager.py).
- [ ] Badge Premium (Free/Pro/Premium) + upsell browser (popup banner + sezione + options).
- [ ] Congruenza pre-deploy (versione/prezzi/regole/lingue) come da regola.
- [ ] Canali: Telegram @adoffapp (EN) + email Pro esistenti + social + in-app banner.
- [ ] Asset: card Telegram + video demo VPN + screenshot store + landing /premium.
- [ ] Deploy multi-browser + store secondo Deploy Rule.

### CHECKLIST GO-LIVE (accettazione, tutte bloccanti)
- [ ] **Nessun leak IP/DNS** con VPN attiva (test leak reale).
- [ ] **Kill-switch funziona**: VPN cade → traffico bloccato (no leak).
- [ ] **Gating**: curl a /vpn/* senza token Premium → 403 su TUTTI gli endpoint.
- [ ] **Congruenza** prezzi/versione/regole/lingue ovunque (regola pre-deploy).

---

### Pagamenti Premium (tutti i metodi)
- **Carta** (già attivo) + **PayPal** + **Crypto** (privacy-conscious, coerente col target VPN) + **Apple Pay/Google Pay** (checkout mobile 1-tap). Tutti via Stripe.
- **Multi-valuta automatica** (vedi sopra).

### Qualità VPN comunicata/implementata
- **No-log verificabile** (leva #1 fiducia) · **velocità/banda illimitata** (server 1-10 Gbps VPNresellers) · **P2P/torrent consentito** (⚠️ vs rischio DMCA) · **numero paesi/server** dai server VPNresellers reali.

### Analytics funnel (tutti gli eventi)
- Vista upsell → click checkout · checkout iniziato → completato · prima connessione VPN post-acquisto · upgrade Pro→Premium.

### Roadmap futura post-lancio
- **Ad-blocking a livello VPN** (DNS-blocking nel tunnel quando VPN attiva — unisce i due prodotti su desktop/mobile). *(Split-tunneling / IP dedicato / multi-hop SCARTATI dalla roadmap.)*

### Contenuti SEO/marketing (riusa sistemi esistenti)
- Guide 'ad blocker + VPN' multilingua · pagine vs/ competitor VPN · FAQ VPN (AEO/AI search) · blog build-in-public founder-led (Eros).

### Canali di lancio
- **Telegram @adoffapp** (EN, obbligatorio) · **email ai Pro esistenti** (pubblico più caldo) · **social** (X/IG/FB build-in-public) · **in-app** (banner popup/onboarding).

### Asset di lancio
- Card brand Telegram EN (FLUX flux2-dev) · video demo VPN (adblock+VPN insieme) · screenshot store con badge Premium · landing /premium (15 lingue).

## 3. NUMERI ROI (riepilogo)

| Scenario | Ricavo lordo | Costo VPN | Margine lordo/mese |
|---|---|---|---|
| Premium mensile €4,99, 1-3 device | €4,99 | ~€1,85 (1 acc.) | ~€3,14 |
| Premium annuale Founder €29,99 (1° anno) | €2,50/mese equiv. | ~€1,85 | ~€0,65 (amo lancio) |
| Premium annuale std €49,99 | €4,17/mese equiv. | ~€1,85 | ~€2,32 |

**Killer del margine = account inattivi mai disattivati** → l'auto-disable è la leva #1. Il cap banda conta poco (non fatturano a GB).

---

### Dettagli operativi (blocco 18)
- **Crypto**: **stablecoin USDT/USDC** via **gateway dedicato** (BTCPay/Coinbase Commerce, non Stripe Crypto). BTC/Monero scartati.
- **Founder multi-valuta**: **prezzi fissi psicologici per valuta** (€29,99 / $32,99 / £26,99 — no conversione live). Report margine normalizzati in EUR.
- **Server**: esponi tutti + **health-check** (nascondi down) + **ordina per latenza** (geoip) + **etichette d'uso** (streaming/P2P/privacy).
- **Errori connessione**: retry auto su altro server + riprovisiona account se mancante + log admin.
- **Anti-churn**: email pre-scadenza + win-back a chi disdice + downgrade a Pro (non cancellazione) + dashboard valore usato (ads bloccati + ore protette).
- **Compliance store**: verificare che, tolta la VPN dal browser, **nessun nuovo permesso** CWS/AMO (no 'proxy'). Dichiarazioni privacy native → Fase 2 mobile.
- **QA continuo**: smoke test giornaliero /vpn/* + alert se lista server si svuota/cambia + regression test gating ad ogni deploy.
- **Dati minimi (no-log)**: SOLO deviceId+tier, ultima connessione (auto-disable), mapping deviceId→accountId. **Niente IP/siti/traffico/DNS**.
- **GDPR**: delete account VPNresellers + purge dati locali + export su richiesta + riusa sistema uninstall/privacy esistente.
- **Performance**: WireGuard default (se test lo permette) + connessione lazy (on-demand) + server ottimale auto + zero impatto adblock quando VPN off.
- **Presentazione valore** (onesto): confronto VPN-sola vs Premium + risparmio annuale + Founder scarcity reale (X/100) + CTA free trial adblock come entry.
- **Scala supporto**: FAQ self-service + bot AI triage (riusa esistente) + diagnostica in-app (test connessione) + video tutorial.

## 4. FAILED APPROACHES / DO NOT
- **NON** fare VPN-estensione instradante nel browser con VPNresellers (no proxy HTTP/SOCKS — verificato).
- **NON** assumere $1,99 × N device: è $1,99 per utente fino a 10 connessioni.
- **NON** mettere la VPN nel trial né nei referral (costo reale).
- **NON** lasciare gli endpoint `/vpn/*` senza gating server-side.
- **NON** chiamare il tier "Pro+": si chiama **Premium**.
- **NON** aggiornare i doc pricing pubblici prima del test E2E.
- **NON** lanciare la VPN prima del test empirico multi-device WireGuard.
