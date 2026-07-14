# AdOff — README / Pacchetto di lavoro per Claude Code

Questo è il punto di partenza. Apri questo file, poi segui il brief.

## I file del pacchetto
| File | A cosa serve |
|---|---|
| `adoff-fix-brief.md` | **Brief tecnico master (Task A→K)**: cosa fixare, in che ordine, con acceptance criteria. È la guida principale per Claude Code. |
| `adoff-story-brand.md` | Story brand di Eros: chi è, storia, valori, **voce/tono**, taglines. Usalo per ogni testo. |
| `adoff-chi-sono.md` | Copy pronto della pagina **"Chi sono / About"** (IT+EN) + **Founder note** per la home. |
| `adoff-persona-story-kit.md` | Kit personaggio + **piano contenuti**, profili (chi pubblica cosa), regole formato. |
| `adoff-30-post.md` | 30 post per il **profilo personale** (build-in-public), IT + EN sui pilastro. |
| `adoff-post-brand.md` | 20 post per il **profilo brand** ufficiale AdOff. |

## Ordine di esecuzione (dal brief)
1. **C** — coerenza dati (allinea sito ↔ store ↔ package)
2. **A** — togli le recensioni finte
3. **K** — pagina "Chi sono" + founder note (sostituisce le recensioni)
4. **G** — pricing (riallinea, valuta il Lifetime)
5. **D** — strategia codice/licenza (open core / source-available)
6. **B** — pubblicazione/allineamento store
7. **L** — richiesta recensioni in-app (non invasiva, trigger 7–15 gg)
8. **E** — distribuzione (companion installer, enterprise, app di sistema)
9. **F** — mobile (iOS Safari+DNS, Android off-Play)
10. **H** — marketing organico (con i file post/voce)
11. **I** — budget €1000 (solo dopo segnale organico)
12. **J** — automazione (tu orchestri, AI esegue)

## Guardrail non negoziabili (valgono per TUTTO)
- **Onestà sui numeri:** ogni cifra (regole, lingue, trial) deve coincidere con ciò che il **package reale** contiene. Mai gonfiare. Un solo numero su sito + store + package.
- **Niente recensioni/social proof finte.** Solo recensioni reali linkate agli store.
- **Niente auto-install silenzioso** di estensioni; l'utente conferma sempre. Niente comportamenti da PUP/adware.
- **Privacy reale:** filtraggio on-device, zero log, nessun traffico verso server propri spacciato per privacy.
- **Voce di Eros:** caldo, schietto, ironico, underdog, "uno di noi". Metafora **serrature/sicurezza → privacy digitale**. Niente corporatese.
- **Acquisizione:** creator/newsletter di nicchia, **mai** Google/Meta come canale principale.

## Decisioni/azioni che solo Eros può sciogliere
- [ ] **Regole reali: 138 o 107?** Verifica nel file regole del package e fissa il numero vero ovunque.
- [ ] **Lingue reali** (conta in `_locales/`) e **trial** definitivo (sito dice 30, store 15).
- [ ] **Togliere le recensioni finte** dalla home (sono ancora online).
- [x] **Pricing — DECISO:** Mensile €2,99 · Annuale **Founder €19,99 (primi 100, bloccato a vita) → €24,99 standard** · **Lifetime rimosso** (solo "Founder" €99 limitato) · piano unico · **counter reale "X/100 posti Founder"** sul sito (dato vero da Stripe/backend, niente timer finti). Da implementare su sito + Stripe + store.
- [ ] **Lifetime live da rimuovere:** il sito mostra ancora €67,90 — sostituire con la nuova architettura.
- [ ] **Licenza** (open core / source-available) — far validare a un legale.
- [ ] *(Opzionale)* una **firma siciliana** per la voce.
- [ ] Inserire **nome = Eros** dove resta `[nome]` (già fatto nei file storia/about/post chiave).

## Prompt iniziale suggerito per Claude Code
> Leggi `adoff-fix-brief.md` ed eseguilo nell'ordine indicato, partendo dal **Task C**. Usa `adoff-chi-sono.md` per la pagina About e il founder note, e `adoff-story-brand.md` per voce, valori e taglines. Rispetta i guardrail del README: nessuna recensione finta, numeri coincidenti col package reale (verifica prima il conteggio reale di regole/lingue e allinea sito + store), niente auto-install silenzioso, voce di Eros. Mostrami un piano di modifiche file per file prima di applicarle.

---
Buon lavoro, Eros. Hai un prodotto vero, una storia vera e un piano chiaro: ora è questione di eseguire, un pezzo alla volta.
