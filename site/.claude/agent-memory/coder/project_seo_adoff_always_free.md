---
name: seo-adoff-always-free-claim
description: AdOff is 100% free with no account/trial; site pages across languages still carry stale "30-day trial then free account" claims that must be corrected
metadata:
  type: project
---

# AdOff "sempre gratis" — claim da rimuovere dal sito

**Fatto**: AdOff è gratis al 100% per tutti, tutte le funzioni dal primo giorno, NESSUN account, NESSUNA registrazione, nessuna carta, per sempre. Il free-gate è stato rimosso dall'estensione (commit `1c6cc6be`, 2026-09-12); `adoffPlanTier()` ritorna sempre `"premium"`.

**Perché conta**: molte pagine del sito (landing + traduzioni) ripetono ancora il vecchio claim FALSO "30 giorni senza account, poi un account gratuito (mai un pagamento) per altri 365 giorni" / "15 giorni di prova Pro". Queste frasi sono public-facing e affermano qualcosa di non vero.

**Come applicarlo**:
- Il testo corretto in IT (riferimento) è: "gratis per tutti, senza limiti di tempo e senza carta di credito. Tutte le funzioni attive dall'installazione".
- NON toccare i file legali (`privacy.html`, `terms.html`, `withdrawal.html`) né le frasi legittime su **rimborso 30 giorni**, **preavviso 30 giorni** (terms), **"30 secondi"** di installazione, **"30 anni"** biografia founder, **retention log 30 giorni** (privacy).
- Attenzione: `vs/privacyspy.html` NON è un file legale (è una pagina di confronto).
- Correggere SEMPRE insieme sia l'HTML (`data-i18n="chiave"`) sia il valore in `i18n/<lang>.json`; non rinominare chiavi.

**Stato 2026-10-16**: lingue pl/pt/ru/tr/zh corrette (58 file, ~170 righe). NON verificate/corrette: `it` (baseline, contiene ancora `faq.a1`, `cta.title`, `how.step2.title`, `ad_blocker_firefox.yes...` con claim account), `en`, `de`, `es`, `fr`, `ar`, `hi`, `id`, `ja`, `ko` + le pagine HTML root `site/*.html`. Elenco fix: `sviluppo/seo-tools/.state/fix_account_D.txt`.