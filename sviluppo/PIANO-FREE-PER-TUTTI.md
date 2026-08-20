---
name: piano-free-per-tutti-update
description: Update punto 6 del piano FREE-PER-TUTTI: completamento 15 lingue con commit, verifica alfabeto, bug hindi/italiano scartato, trappola chiavi modificate
updated: 2026-08-20
metadata:
  type: project
---

# Piano FREE-PER-TUTTI — update punto 6 (15 lingue completate)

Aggiornamento del punto 6 del file `sviluppo/PIANO-FREE-PER-TUTTI.md`. Il task "[~]" (in corso) diventa "[x]" (fatto) con nuovi dettagli su commit, verifica e bug incontrati.

**Why:** il punto 6 risultava ancora "[~]" mentre le 15 lingue erano di fatto pronte — senza update il piano non riflette lo stato reale del lavoro e nasconde i problemi emersi durante la traduzione.

**How to apply:** sostituire il blocco con una singola Edit su `sviluppo/PIANO-FREE-PER-TUTTI.md`. `old_string` = vecchio testo da "6. [~] **15 lingue** (in corso, commit `c203384`)" fino a prima di "7. [~] **Comunicazione e pubblicazione**". `new_string` = testo fornito nel brief.

## Nuovo testo del punto 6

6. [x] **15 lingue** (fatto 2026-08-20, commit `c203384` + `f8ee2dd` + `81e6f54`): tutte e
   tredici le lingue tradotte davvero — tedesco, francese, spagnolo, portoghese, russo,
   polacco, cinese, giapponese, coreano, arabo, hindi, turco, indonesiano. Circa 8.200
   celle di `_matrix.json`.
   Ogni file e' stato accettato solo dopo aver verificato l'ALFABETO delle stringhe lunghe
   (93-99% a seconda della lingua), non il report dell'agente: e' cosi' che e' emerso un
   file "hindi" che conteneva testo italiano, con zero caratteri devanagari su 278
   stringhe — scartato e rifatto.
   Trappola trovata e chiusa: le chiavi il cui testo INGLESE era cambiato restavano con la
   vecchia traduzione e nessun controllo le segnalava, perche' non risultavano "non
   tradotte". Giapponese e russo mostravano ancora il messaggio vecchio. Si trovano solo
   confrontando la matrice con un commit precedente.

## Decisioni e fix chiave

- **Criterio di accettazione:** verifica dell'alfabeto caratteristico delle stringhe lunghe (93-99% per lingua), non il report dell'agente.
- **Bug scoperto:** un file dichiarato "hindi" era in realta' testo italiano — zero caratteri devanagari su 278 stringhe. Scartato e rifatto.
- **Trappola chiusa:** chiavi con testo inglese modificato restavano con la vecchia traduzione; i controlli di "non tradotto" non le intercettavano. Per giapponese e russo il messaggio vecchio era ancora visibile.
- **Metodo di rilevazione della trappola:** confronto della `_matrix.json` con un commit precedente (non controllo automatico basato su celle vuote).

## Entita'/tool coinvolti

- File: `sviluppo/PIANO-FREE-PER-TUTTI.md`
- Commit: `c203384`, `f8ee2dd`, `81e6f54`
- Artefatto dati: `_matrix.json` (~8.200 celle)
- 13 lingue tradotte: tedesco, francese, spagnolo, portoghese, russo, polacco, cinese, giapponese, coreano, arabo, hindi, turco, indonesiano

## Cosa NON ha funzionato (fallimenti)

- **Report dell'agente:** non affidabile come unico criterio — il file "hindi" conteneva italiano nonostante il via libera dell'agente.
- **Controllo "non tradotto":** insufficiente — non intercettava chiavi con traduzione vecchia su testo inglese aggiornato (giaiapponese e russo mostravano il messaggio vecchio).
- **Nessun check alfabetico automatico** era in place: e' stato introdotto proprio per impedire che il bug hindi si ripetesse.

## Note operative per la Edit

- Tipo: singola Edit su `sviluppo/PIANO-FREE-PER-TUTTI.md`.
- `old_string`: dal primo carattere di "6. [~] **15 lingue** (in corso, commit `c203384`)" fino all'ultimo carattere prima dell'inizio di "7. [~] **Comunicazione e pubblicazione**" (escluso).
- `new_string`: il blocco completo riportato sopra nella sezione "Nuovo testo del punto 6".
- Nessun altro punto del piano va modificato in questo task.
