---
name: comunicazione-sostenitori-adoff-gratis
description: Template pronti all'uso per annunciare ai sostenitori che AdOff è diventato gratuito (email IT/EN, post Telegram, nota supporto, checklist operativa)
updated: 2026-08-20
metadata:
  type: project
---

# Comunicazione sostenitori — AdOff gratuito

**Why:** AdOff diventa gratuito per tutti (versione 3.6.0, commit `b31d629`). I sostenitori pagavano per qualcosa che ora è gratis: vanno avvisati con onestà, senza supplica né raggiro.

**How to apply:** Seguire la sequenza operativa obbligatoria (sito + estensione → email sostenitori → Telegram). Tutto è preparato ma NON eseguito: l'utente lancia manualmente query e invii.

## Contesto tecnico

- Estensione AdOff 3.6.0 include nel changelog:
  - "AdOff e' ora gratuito per tutti: ogni funzione e' attiva senza account e senza scadenze"
  - "Non serve fare nulla: e' gia' tutto sbloccato"
  - "Se avevi un abbonamento attivo, sei passato a Sostenitore: puoi interromperlo quando vuoi senza perdere nessuna funzione"
- Email worker firma: `sendEmail(to, subject, html, env)` con Resend
- Post Telegram: `sviluppo/marketing/automation/telegram_daily_post.py`, token in `~/.claude/channels/telegram/.env`
- Query D1 (NON eseguita, solo pronta):
  `SELECT email, plan, created_at FROM licenses WHERE revoked = false AND (ends_at IS NULL OR ends_at > NOW())`
- Sequenza obbligatoria: (1) pubblicare sito + estensione, (2) inviare email ai sostenitori, (3) pubblicare post Telegram

## 1. Email ai sostenitori — ITALIANO

```html
<!--
sendEmail(
  to: <email dal result D1>,
  subject: "AdOff e' ora gratuito per tutti — e il tuo abbonamento",
  html: <corpo sotto>,
  env: <env Resend>
)
-->

<p>Ciao,</p>

<p>AdOff da oggi è gratuito per tutti. Ogni funzione è attiva senza account e senza scadenze: non devi fare nulla, è già tutto sbloccato.</p>

<p>Cosa cambia per te? Niente di negativo. Continui ad avere tutto quello che avevi prima, esattamente come prima.</p>

<p>Te lo scrivo perché stavi pagando per qualcosa che ora è gratis, e non voglio che tu lo scopra per caso o che ti senta preso in giro. Il tuo abbonamento è diventato un sostegno volontario al progetto: se vuoi, puoi <a href="https://adoff.app/account">interromperlo quando vuoi</a> senza perdere nessuna funzione. Se invece preferisci continuare a sostenermi, mi aiuti a portare avanti AdOff.</p>

<p>Grazie. Sul serio.</p>

<p>— Eros</p>

<p><small>Gestisci il tuo abbonamento: <a href="https://adoff.app/account">https://adoff.app/account</a></small></p>
```

## 2. Email ai sostenitori — INGLESE

```html
<!--
sendEmail(
  to: <email dal result D1>,
  subject: "AdOff is now free for everyone — and your subscription",
  html: <corpo sotto>,
  env: <env Resend>
)
-->

<p>Hi,</p>

<p>As of today, AdOff is free for everyone. Every feature is unlocked without an account and without expiration — you don't need to do anything, it's all already active.</p>

<p>What changes for you? Nothing negative. You keep everything you had before, exactly as before.</p>

<p>I'm emailing because you were paying for something that's now free, and I'd rather you hear it from me than find out on your own. Your subscription has become a voluntary contribution to the project: if you want, you can <a href="https://adoff.app/account">cancel it anytime</a> without losing any features. And if you'd like to keep supporting AdOff, that genuinely helps me keep going.</p>

<p>Thank you. Really.</p>

<p>— Eros</p>

<p><small>Manage your subscription: <a href="https://adoff.app/account">https://adoff.app/account</a></small></p>
```

## 3. Post Telegram @adoffapp — INGLESE

```
AdOff is now free for everyone. Every feature, no account, no expiration.
If you were a paying user, nothing changes for you — except you'll get an email from us about it.
More info → https://adoff.app

#AdOff #Privacy #OpenSource
```

Da pubblicare tramite `sviluppo/marketing/automation/telegram_daily_post.py` (token in `~/.claude/channels/telegram/.env`).

## 4. Nota per supporto (IT + EN)

```markdown
### IT
Risposta standard a "ho pagato, e adesso?":

AdOff è diventato gratuito per tutti, ma chi aveva un abbonamento attivo continua ad avere tutto come prima. L'abbonamento è diventato un sostegno volontario al progetto: l'utente può disdirlo in qualsiasi momento da https://adoff.app/account senza perdere alcuna funzione. Nessun rimborso è dovuto (il servizio è stato erogato), ma se chiede spiegazioni o sembra arrabbiato, fammi sapere.

### EN
Standard reply to "I paid, what now?":

AdOff is now free for everyone, but anyone with an active subscription keeps everything they had before. The subscription has become a voluntary contribution to the project: the user can cancel it anytime at https://adoff.app/account without losing any features. No refund is owed (the service was delivered), but if they push back or seem upset, let me know.
```

## 5. Checklist operativa

1. **Preparare (NON eseguire)** la query D1 per estrarre i destinatari:
   `SELECT email, plan, created_at FROM licenses WHERE revoked = false AND (ends_at IS NULL OR ends_at > NOW())`
2. **Pubblicare PRIMA** sito + estensione AdOff 3.6.0 (commit `b31d629`). Verificare che il changelog sia live e che `adoff.app` rifletta la versione gratuita.
3. **Poi** inviare le email ai sostenitori via worker, una per destinatario:
   `sendEmail(to, subject, html, env)` con Resend
   - IT: subject `"AdOff e' ora gratuito per tutti — e il tuo abbonamento"`
   - EN: subject `"AdOff is now free for everyone — and your subscription"`
   - Stesso `to` per entrambe le lingue (i sostenitori attivi sono IT-first ma mandare EN di default dove il piano/dominio email è estero se disponibili; altrimenti una sola lingua per destinatario)
4. **Poi** pubblicare il post Telegram @adoffapp con `sviluppo/marketing/automation/telegram_daily_post.py` (token in `~/.claude/channels/telegram/.env`).
5. Caricare la nota supporto IT + EN nella knowledge base del canale assistenza.
6. Nessuna esecuzione automatica: ogni passo è manuale e verificato.

## Avvertenze e fallimenti da evitare

- **Sequenza invertita**: se parte Telegram o email prima del deploy, i sostenitori leggono "è gratis" e vanno a controllare → trovano ancora il vecchio binario/pagina → danno per truffa. Rispettare ordine (1) sito+estensione, (2) email, (3) Telegram.
- **Email tradotta parola per parola**: la versione EN suona robotica. Il template qui è riscritto, non tradotto.
- **Tono supplichevole o aggressivo**: "ti preghiamo di restare", "se disdici ci fai un danno" ecc. NO. Tono: fatto, onesto, sobrio.
- **Query D1 eseguita per sbaglio**: è un SELECT, non dannoso, ma ricordarsi che espone email in chiaro — non loggarla in pubblico.
- **Rimborsi**: non promessi nel template. Se un sostenitore chiede, fammi sapere (servizio erogato).

## Stato

- [x] Template email IT redatto
- [x] Template email EN redatto
- [x] Post Telegram redatto
- [x] Nota supporto IT+EN redatta
- [x] Query D1 pronta (NON eseguita)
- [ ] Deploy sito + estensione 3.6.0 eseguito
- [ ] Email inviate ai sostenitori
- [ ] Post Telegram pubblicato
- [ ] Nota supporto caricata nell'helpdesk
