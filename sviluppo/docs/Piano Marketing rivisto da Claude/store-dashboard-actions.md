# AdOff — Azioni manuali dashboard store (post-fix sito 2026-06-01)

> Il **sito è già allineato e online** (versione 3.4.6, 138 regole, 15 lingue, 4 livelli, Safari "in arrivo", Edge→Chrome Web Store, founder counter reale, pagina /about EN linkata).
> Questo file copre ciò che **NON si può fare via API**: la copy delle schede store e i contatti "trader" si modificano **solo dalla dashboard**.
> **Numeri veri (SSOT `site/data/constants.json`)**: versione **3.4.6** · **138** regole (137 block + 1 allow) · **15** lingue · **4** livelli · trial **30 giorni** · **5** browser (Chrome, Firefox, Edge, Opera, Brave) + Safari in arrivo · peso store ZIP ~132 KB (unpacked ~146 KB).
> La copy corretta da incollare è già pronta in **`docs/store-listing.md`** (Variant A = Chrome/Edge "safe", Variant B = Firefox brand-rich).

---

## 🔴 CRITICO 2 — Contatti "trader" Chrome Web Store (priorità massima)
La scheda Chrome espone pubblicamente **Gmail personale + cellulare + indirizzo di casa**.
- [ ] Developer Dashboard → **Account** → *Contact information* / *Trader contact details*
- [ ] Email pubblica → `support@adoff.app` (già usata su Firefox)
- [ ] Telefono → recapito **non personale** (VoIP/business; es. numero dedicato). *Da fornire tu — non inventabile.*
- [ ] Indirizzo → indirizzo **non residenziale** se possibile (la disclosure trader è obbligatoria, ma i dati possono essere aziendali).
- **Fatto quando:** nessun contatto personale del founder visibile sugli store.

---

## 🟠 Chrome Web Store (scheda più datata — copy "100+/74KB/6 lingue/3 livelli")
Developer Dashboard → AdOff → **Store listing**. Incolla da `docs/store-listing.md` **Variant A**:
- [ ] **Description** → sostituisci con `A · Detailed Description (EN)` (rif. righe 18-79 del doc): contiene già **138 regole**, **4 livelli**, **trial 30 giorni**.
- [ ] **Short description** → `A · Short Description` (132 char).
- [ ] Rimuovi ogni "100+", "74 KB", "6 lingue", "3 livelli" residui (la nuova copy non li contiene).
- [ ] Campo **Language** della scheda → aggiungi almeno Italiano oltre English (il supporto UI 15 lingue è descritto nel testo).
- [ ] **Screenshot** → rigenerare senza numeri vecchi (devono dire 138 regole / 15 lingue / peso reale, NO loghi di terze parti).
- [ ] Nota: mantenere la copy "content filter / filtro contenuti" (non "ad blocker") per le policy Chrome — ok, ma i **numeri** devono essere veri.
- [ ] **Versione**: il package allineato è **3.4.6**. NON ricaricare ora se 3.4.5/3.4.6 è già *in review* (eviti conflitti); quando la review chiude, carica 3.4.6 via API (vedi `CLAUDE.md` → Chrome Web Store Upload).

## 🟠 Firefox AMO (copy "138" ma commenti dev "107", trial "15-day")
addons.mozilla.org → Developer Hub → AdOff → **Edit listing**. Usa `docs/store-listing.md` **Variant B**:
- [ ] **Description** → `B · Detailed Description` (brand-rich, già 138 regole).
- [ ] **Commenti per i revisori / note sviluppatore** → correggi "107 static rules" → **138** (137 block + 1 allow).
- [ ] Testo trial → da "15-day" a **30 giorni**.
- [ ] **Screenshot** → rigenerare: "107 rules / 74KB / 6 languages" → **138 / peso reale / 15 lingue**.

## 🟠 Edge Add-ons
- Il sito ora **non punta più al GUID rotto**: i pulsanti Edge mandano al **Chrome Web Store** (Edge installa estensioni CWS nativamente).
- [ ] Se vuoi una scheda Edge dedicata: Partner Center → verifica stato.
  - Se **Published** → mandami l'**URL pubblico reale** (`microsoftedge.microsoft.com/addons/detail/{nome}/{id}`): aggiorno i pulsanti Edge del sito da CWS a quello dedicato.
  - Se **In review** → lascia così (il fallback CWS funziona già su Edge).

---

## ✅ Già fatto e online (sito) — nessuna azione
- Versione 3.4.6 ovunque (home, install, press, best-ad-blocker, i18n, 14 pagine per-lingua, install/press per-lingua).
- Safari uniformato "in arrivo" (FAQ, CTA finale, JSON-LD, 14 lingue) — niente più "Safari Extensions" come canale ufficiale.
- Edge: GUID 404 rimosso → Chrome Web Store.
- Founder counter: placeholder `100/100` + popolamento reale dal backend `/founder-status`.
- Conteggio browser uniformato a 5 (+ Safari in arrivo).
- Pagina **/about** (EN) linkata da nav + footer + CTA founder (rewrite chi-sono→about per non-IT).

## Ordine consigliato
1. CRITICO 2 (contatti business Chrome) — fornisci telefono/indirizzo.
2. Chrome: Description + Short + Language + screenshot.
3. Firefox: Description + commenti dev (107→138) + trial (15→30) + screenshot.
4. Edge: passami l'URL pubblico se la scheda è live.
