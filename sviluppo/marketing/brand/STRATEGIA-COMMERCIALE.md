# Shadow Shield — Strategia Commerciale

## 1. Analisi Competitor

### Mappa del mercato ad blocker (Aprile 2026)

| Tool | Utenti | Prezzo | Rating | Modello Revenue | Problema principale |
|---|---|---|---|---|---|
| **uBlock Origin** | 29M+16M Lite | Free | 4.3/5 | Donazioni | Manifest V3 lo ha ucciso su Chrome |
| **AdBlock Plus** | 400M eco | Free/$40yr | Medio | Acceptable Ads (whitelist a pagamento) | Conflitto interessi: guadagna permettendo ads |
| **AdBlock** | 63M | Free/donazione | 4.48/5 | Acceptable Ads | Stessa critica di ABP |
| **AdGuard** | 17M | Free ext/$40yr app | 4.66/5 | App premium | Funzioni avanzate solo a pagamento |
| **Ghostery** | 100M+ | Free/$2-12/mo | 4.6/5 | Contributor | Passato controverso vendita dati |
| **Privacy Badger** | 1M+ | Free | N/A | No-profit EFF | Solo tracker, non blocca ads |
| **Total Adblock** | N/D | $19→$99/yr | Misto | Subscription aggressiva | Pricing ingannevole, free inutile |
| **Stands** | N/D | Free | 58/100 | **Vende i tuoi dati** | Data broker mascherato da ad blocker |
| **Brave** | 100M MAU | Free browser | 96/100 | BAT/Search | Richiede cambio browser |

### Insight chiave

1. **uBlock Origin e' morto su Chrome** — Manifest V3 ha eliminato le API che servivano. La versione Lite ha 1/10 della capacita'. Milioni di utenti Chrome cercano alternativa.
2. **ABP e AdBlock hanno un conflitto di interessi** — guadagnano permettendo ads "accettabili" per default
3. **Nessuno offre stealth anti-detection serio** come estensione Chrome
4. **Total Adblock usa pricing predatorio** — $19 il primo anno, $99 dopo
5. **Stands vende i dati** — utenti inconsapevoli

---

## 2. Gap di Mercato (Opportunita')

| Gap | Descrizione | Noi |
|---|---|---|
| **uBlock Origin vuoto** | Milioni di utenti Chrome orfani dopo MV3 | MV3 nativo, funziona su Chrome |
| **Zero stealth** | Nessun competitor ha anti-detection serio | Stealth mode con variable spoofing |
| **Pricing onesto** | Total Adblock inganna, ABP ha conflitto interessi | Prezzo chiaro, nessuna whitelist |
| **Anti-cookie consent** | Solo ABP Premium ($40/yr) gestisce cookie banner | Noi lo offriamo gratis o nel base |
| **Design moderno** | Tutti hanno UI vecchia stile 2015 | UI dark premium, brand forte |
| **Italiano** | Nessun ad blocker pensato per il mercato italiano | Copy italiano, supporto siti italiani |

---

## 3. Proposta Nome

### Opzioni finaliste

| Nome | Dominio | Perche' funziona |
|---|---|---|
| **Veil** | veil.app / veilblock.com | "Velo" — invisibile, elegante, premium. Una parola, memorabile |
| **Cloak** | cloak.app / cloakblock.com | "Mantello" — protezione invisibile, stealth |
| **Aegis** | aegis.app / aegisblock.com | Scudo di Zeus — protezione mitologica, potente |
| **Phantom** | phantomguard.com | Fantasma — invisibile, non rilevabile |
| **NightShield** | nightshield.com | Scudo notturno — dark theme, protezione |
| **VeilGuard** | veilguard.com | Guardiano invisibile — combina entrambi i concetti |

### Raccomandazione: **Veil**

- Una sola parola, facile da ricordare in ogni lingua
- Evoca invisibilita' e protezione senza essere aggressivo
- Non ha "block" o "ad" nel nome (differenziazione)
- Dominio `.app` disponibile (Google-managed, HTTPS obbligatorio)
- Tone premium e minimalista — come Brave ma piu' elegante
- Funziona come verbo: "Veil your browsing"

**Tagline:** "Browse unveiled." (Naviga senza veli — doppio significato: tu vedi tutto, nessuno vede te)

---

## 4. Modello di Business

### Strategia: Freemium a 3 tier

| Tier | Prezzo | Funzionalita' |
|---|---|---|
| **Free** (forever) | 0 | Blocco ads su tutti i siti, CSS hiding, network blocking (107 regole). Nessun limite di tempo |
| **Pro** | 1.50/mese o 15/anno (2 mesi gratis) | Stealth anti-detection, blocco avanzato YouTube, auto-cookie consent, statistiche dettagliate, supporto prioritario |
| **Lifetime** | 19.90 una tantum | Tutte le funzionalita' Pro per sempre. Early adopter price |

### Perche' questo pricing

- **Free generoso** — cattura utenti, genera recensioni positive sullo store
- **1.50/mese** — sotto la soglia psicologica dei 2 euro. Piu' economico di TUTTI i competitor (ABP $4/mo, AdGuard $3.3/mo, Ghostery $2-12/mo, Total $8.25/mo)
- **Lifetime 19.90** — impulso d'acquisto. AdGuard lifetime costa $100. Noi siamo 5x piu' economici
- **Nessuna whitelist Acceptable Ads** — differenziatore etico forte
- **Nessuna vendita dati** — differenziatore privacy

### Revenue projection (conservativa)

| Metrica | Anno 1 | Anno 2 | Anno 3 |
|---|---|---|---|
| Download totali | 50,000 | 200,000 | 500,000 |
| Utenti free | 45,000 (90%) | 176,000 (88%) | 425,000 (85%) |
| Pro mensile | 2,000 | 10,000 | 30,000 |
| Lifetime | 3,000 | 14,000 | 45,000 |
| Revenue mensile | 3,000 + lifetime | 15,000 + lifetime | 45,000 + lifetime |
| Revenue annuale | ~95,000 | ~430,000 | ~1,340,000 |

---

## 5. Piano Sito Web

### Struttura pagine

```
veil.app (o dominio scelto)
  /           — Landing page hero
  /features   — Funzionalita' dettagliate
  /pricing    — Tabella pricing 3 tier
  /download   — Link Chrome Web Store
  /privacy    — Privacy policy (zero data collection)
  /blog       — Articoli SEO (ad blocking, privacy tips)
```

### Landing page — sezioni

1. **Hero** — "Browse unveiled." + CTA "Aggiungi a Chrome — Gratis"
2. **Problema** — "Il web e' rotto. Ads ovunque, tracker che ti seguono, siti che ti bloccano se usi un ad blocker."
3. **Soluzione** — "Veil blocca tutto. Invisibilmente." + 3 feature card (Blocco ads, Stealth mode, Auto-cookie)
4. **Numeri** — Contatore animato: "X ads bloccati dalla community"
5. **Confronto** — Tabella vs competitor (uBlock Lite, ABP, AdGuard)
6. **Pricing** — 3 card (Free, Pro, Lifetime)
7. **Testimonianze** — Review dallo store
8. **FAQ** — 5-6 domande frequenti
9. **Footer** — Privacy policy, contatti, social

### Tech stack sito

- **Framework:** Astro o Next.js (statico, veloce)
- **Hosting:** Vercel o Cloudflare Pages (gratis)
- **Pagamenti:** Stripe (per Pro e Lifetime)
- **Analytics:** Plausible (privacy-first, no cookie)
- **Email:** Resend o Loops (onboarding, upsell)

---

## 6. Strategia di Lancio

### Fase 1: Pre-lancio (2 settimane)

- [ ] Scegliere nome definitivo e comprare dominio
- [ ] Creare sito landing page con waitlist
- [ ] Pubblicare su Chrome Web Store (versione Free)
- [ ] Preparare 5 screenshot + video demo per lo store

### Fase 2: Lancio (settimana 3)

- [ ] Post su Product Hunt
- [ ] Post su Reddit: r/privacy, r/chrome, r/uBlockOrigin, r/ArtificialIntelligence
- [ ] Post su Hacker News
- [ ] 3 articoli blog SEO ("Best ad blocker for Chrome 2026", "uBlock Origin alternative", "Come bloccare ads su YouTube")
- [ ] Contattare 5 YouTuber tech italiani per review

### Fase 3: Crescita (mese 2-6)

- [ ] SEO organico (target: "ad blocker chrome", "bloccare pubblicita'")
- [ ] Referral program: utente invita amico → 1 mese Pro gratis
- [ ] Partnership con VPN (Surfshark, NordVPN) per bundle
- [ ] Localizzazione: tedesco, francese, spagnolo
- [ ] Video YouTube proprio: "Ho creato un ad blocker che batte uBlock Origin"

---

## 7. Differenziatori Chiave (Pitch)

> **Veil e' l'unico ad blocker per Chrome che:**
>
> 1. Funziona con Manifest V3 (al contrario di uBlock Origin)
> 2. Non vende whitelist ad aziende (al contrario di AdBlock Plus)
> 3. Non vende i tuoi dati (al contrario di Stands)
> 4. Ha stealth anti-detection (nessun competitor lo offre)
> 5. Costa meno di tutti ($1.50/mese vs $4+ dei competitor)
> 6. Offre lifetime a $19.90 (AdGuard chiede $100)

---

## 8. Rischi e Mitigazione

| Rischio | Probabilita' | Mitigazione |
|---|---|---|
| Google rifiuta l'estensione | Media | Conformarsi alle policy, no "anti-detection" nella descrizione |
| YouTube cambia sistema ad | Alta | Aggiornamenti frequenti, community feedback |
| Competitor copiano stealth | Bassa | First mover advantage + brand forte |
| Basso conversion rate free→Pro | Alta | A/B test pricing, migliorare valore Pro |
| Google banna ad blocker | Bassa | Supportare Firefox, Edge, Safari |

---

## 9. Prossimi Passi

1. **Decidere il nome** — Veil? Cloak? Aegis? Altro?
2. **Comprare il dominio**
3. **Creare il sito** (1-2 giorni con Astro/Next.js)
4. **Implementare sistema licensing** (Free vs Pro — Stripe + Supabase)
5. **Pubblicare su Chrome Web Store**
6. **Lanciare su Product Hunt + Reddit**
