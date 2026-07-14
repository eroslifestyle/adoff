# GSC SEO Tools — Setup (one-time, ~10 min)

Permette a Claude di leggere via API le statistiche Google Search di `adoff.app`
(proprieta' Dominio, gia' verificata via DNS) e produrre analisi/raccomandazioni SEO.

Auth = **service account** (nessun refresh token che scade, ideale per cron settimanale).

## 4 passi manuali (richiedono il tuo login)

### 1. Crea il service account nel progetto GCP AdOff
- https://console.cloud.google.com/iam-admin/serviceaccounts (progetto = AdOff, lo stesso del CWS)
- "Crea account di servizio" → nome `adoff-gsc-reader` → Crea (nessun ruolo IAM necessario)
- Apri il SA creato → tab **Chiavi** → Aggiungi chiave → Crea nuova → **JSON** → scarica il file

### 2. Abilita la Search Console API
- https://console.cloud.google.com/apis/library/searchconsole.googleapis.com → **Abilita**

### 3. Dai accesso al service account in Search Console
- https://search.google.com/search-console → proprieta' **adoff.app**
- Impostazioni → **Utenti e autorizzazioni** → Aggiungi utente
- Incolla l'**email del service account** (formato `adoff-gsc-reader@<project>.iam.gserviceaccount.com`)
- Permesso: **Con limitazioni** (sola lettura, basta e avanza) → Aggiungi

### 4. Registra il path della key
- Sposta la JSON scaricata in un posto sicuro, es:
  `mv ~/Downloads/<file>.json ~/.secrets/adoff-gsc-sa.json && chmod 600 ~/.secrets/adoff-gsc-sa.json`
- Aggiungi a `~/.secrets/adoff-stores.env`:
  `export ADOFF_GSC_SA_JSON=/home/mrxxx/.secrets/adoff-gsc-sa.json`

## Uso

```bash
source ~/.secrets/adoff-stores.env
cd sviluppo/seo-tools

python3 gsc_query.py                    # top query + top page, ultimi 28gg
python3 gsc_query.py --days 90          # ultimi 90gg
python3 gsc_query.py --dim page --limit 50
python3 gsc_query.py --opportunities    # quick win: query in pos 5-20
python3 gsc_query.py --json > data.json # output grezzo per analisi Claude
```

Quando il setup e' fatto, di' a Claude "analizza le statistiche GSC" e lui lancia
lo script, incrocia i dati e propone interventi SEO concreti (title/description da
riscrivere, pagine con CTR basso, query da spingere, gap di contenuto per lingua).
