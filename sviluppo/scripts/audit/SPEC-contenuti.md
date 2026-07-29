# SPEC — allineamento contenuti alla realtà del prodotto

Checklist applicata per-lingua. Ogni agente possiede un insieme di file disgiunto dagli altri.

## Verità di riferimento (verificata nel codice, NON negoziabile)

| dato | valore | fonte |
|---|---|---|
| versione estensione | **3.5.38** | `app/manifest.json` |
| regole di rete | **144** (143 block + 1 allow) | `grep -c '"id"' app/rules/adblock-rules.json` |
| durata trial | **15 giorni** | `app/src/background.js:13` → `const TRIAL_DAYS = 15;` |
| garanzia rimborso | **30 giorni** | `site/data/constants.json` → `refund_days: 30` |
| cookie affiliato | **30 giorni** | pagina affiliati, invariato |
| lingue | 15 | `constants.json` |
| browser supportati | 5: Chrome, Firefox, Edge, Opera, Brave | `constants.json` |
| Safari | **non ancora disponibile** (`browsers_coming_soon`) | `constants.json` |
| piano Lifetime | **RIMOSSO il 2026-07-16** | `constants.json` `_note` |

### Listino attuale (gli unici prezzi ammessi)

| piano | prezzo |
|---|---|
| Pro mensile | € 2,99 / mese |
| Pro annuale Founder (primi 100) | € 19,99 / anno |
| Pro annuale standard | € 24,99 / anno |
| Premium (AdBlock + VPN) mensile | € 4,99 / mese |
| Premium annuale Founder | € 29,99 / anno |
| Premium annuale standard | € 49,99 / anno |

Prezzi **superati** da eliminare ovunque compaiano: 2,69 · 2,47 · 5,99 · 29,59 · 59,99 · 67,90 · 99 (Lifetime).

---

## FIX 1 — trial: 30 giorni → 15 giorni

Il claim più diffuso e il più grave: 104 pagine promettono 30 giorni di prova, il prodotto ne dà 15.

**Attenzione, è il punto in cui è più facile sbagliare.** Nel sito convivono TRE cose diverse che valgono «30 giorni» e solo la prima va cambiata:

1. **durata della prova gratuita Pro** → deve diventare **15** ❌→✅
2. **garanzia soddisfatti o rimborsati** → resta **30** ✅ non toccare
3. **durata del cookie di affiliazione** → resta **30** ✅ non toccare

Esempi reali dal sito, per capire la differenza:

- `es/free-ad-blocker.html` — *"Una **prueba gratuita de 30 días** de Pro añade el modo sigiloso"* → è il trial, va a 15
- `fr/best-ad-blocker-2026.html` — *"avec une **garantie satisfait ou remboursé de 30 jours**"* → è il rimborso, resta 30
- `affiliati.html:118` — *"**30 giorni**. Se qualcuno clicca il tuo link e acquista entro 30 giorni, ricevi la commissione"* → è il cookie, resta 30
- `ar/how-it-works.html:247` — *"الفترة التجريبية المجانية لمدة **30 يومًا**"* (periodo di prova gratuito di 30 giorni) → è il trial, va a 15
- `ar/best-ad-blocker-2026.html:496` — *"مع **ضمان استرداد الأموال خلال 30 يومًا**"* (garanzia di rimborso entro 30 giorni) → è il rimborso, resta 30

Una frase può contenerli entrambi: *"30 dni za darmo · gwarancja zwrotu 30 dni"* → il primo diventa 15, il secondo resta 30.

**Non usare un find-and-replace cieco.** Vai occorrenza per occorrenza e decidi dal contesto. Se una frase è ambigua e non riesci a stabilire di quale dei tre casi si tratti, **lasciala invariata** e segnalala nel report.

Adegua anche il testo attorno al numero se la lingua lo richiede (declinazioni, classificatori, plurali): in russo, polacco, arabo e hindi cambiare solo la cifra può produrre una forma grammaticale sbagliata.

## FIX 2 — rimuovere il piano Lifetime

Il piano a vita non esiste più dal 2026-07-16 ma è ancora venduto su 69 pagine (189 occorrenze), a volte con il prezzo: *"Pro Vitalicio — **99 EUR** pago único"*, *"The Founder Lifetime is a limited launch offer: €99 once"*.

Rimuovere card, righe di tabella, voci di FAQ e menzioni nel testo. Dove il Lifetime era una delle opzioni di un elenco, l'elenco va lasciato coerente (niente liste con un buco, niente "scegli tra mensile, annuale o " troncato).

Termini da cercare in tutte le lingue: `Lifetime`, `a vita`, `Lebenslang`, `de por vida`, `vitalicio`, `à vie`, `навсегда`, `永久`, `평생`, `ömür boyu`, `dożywotni`, `seumur hidup`, `आजीवन`, `مدى الحياة`.

Attenzione ai falsi positivi: *"Founder price locked **for life**"* (il prezzo Founder bloccato a vita) è una promessa ANCORA VALIDA sul piano annuale e **non va rimossa** — riguarda il prezzo, non un piano Lifetime.

## FIX 3 — prezzi superati

Sostituire con il listino attuale. Dove compare un intervallo legato ai vecchi tier per numero di dispositivi (es. *"€2.69 - €5.99 per mese (3-10 dispositivi)"*), va riscritto secondo il modello attuale: **piano unico fino a 3 dispositivi**, niente tier 3/5/10.

## FIX 4 — versione stantia

60 pagine citano versioni vecchie: 3.1.0, 3.3.0, 3.3.1, 3.4.6, 3.5.7. La versione reale è **3.5.38**.

Casi tipici:
- *"AdOff v3.1.0 — ultimo aggiornamento: 19 aprile 2026"* nell'intestazione delle guide
- *"Versione 3.4.6 · Compatibile con Chrome, Edge, Brave, Opera"* nel box di download
- tabelle del press kit con una riga «Versione»

Dove la versione è accompagnata da una data di aggiornamento, aggiorna anche quella in modo coerente (usa 2026-07-29, formattata secondo le convenzioni della lingua).

Lasciare invariate le voci di **changelog storico** (es. «novità della 3.3.0»): sono dati storici corretti, non la versione corrente.

## FIX 5 — browser supportati

Safari non è ancora disponibile. Dove compare in un elenco di browser su cui AdOff è installabile (es. *"Disponibile per Chrome, Firefox, Safari, Edge"*), va rimosso o marcato come «in arrivo».
Elenco corretto: Chrome, Firefox, Edge, Opera, Brave.

## FIX 6 — conteggio regole

Le regole di rete sono **144**. Correggere ogni claim che dica un numero diverso riferito ad AdOff.
Non toccare i numeri riferiti ad ALTRI prodotti (es. *"molti blocker caricano liste con 80.000 regole"*, *"Chrome limita le estensioni a 30.000 regole statiche"*): sono confronti corretti.

## FIX 7 — separatore corrotto nei titoli

In diverse pagine tradotte il separatore `·` è stato sostituito da una virgola, producendo titoli come *"Benutzerhandbuch **,** AdOff Werbeblocker"* o *"User Guide **,** AdOff Ad Blocker"*. Ripristinare ` · ` (spazio, punto mediano, spazio).

---

## Regole operative comuni

- Modifica sia gli HTML di competenza sia le chiavi corrispondenti nel dizionario `site/i18n/{lang}.json`: se il testo sbagliato sta in una chiave i18n, correggerlo solo nell'HTML non serve a niente perché il runtime lo sovrascrive.
- Non riformattare l'HTML, non cambiare indentazione, non riordinare attributi. Solo il testo che va corretto.
- Non introdurre né rimuovere attributi `data-i18n`.
- Idempotenza: rieseguire il lavoro non deve produrre altri cambiamenti.
- Se un fix richiede di riscrivere una frase, mantieni registro, tono e lunghezza simili all'originale.
