# AdOff i18n — sistema centralizzato (single source of truth)

> Tutte le stringhe UI del sito vivono in **UN solo file**: [`_matrix.json`](_matrix.json).
> Mai più stringhe inglesi che sfuggono silenziosamente in una lingua.

## Come funziona

```
_matrix.json            ←  UNICA FONTE.  { "<chiave>": { "it": "...", "en": "...", "de": "... } }
     │
     │  python3 sviluppo/scripts/i18n_manager.py build
     ▼
{lang}.json  (×15)      ←  file runtime GENERATI, letti da adoff-i18n.js a runtime
```

Le pagine HTML marcano i nodi traducibili con `data-i18n="chiave"` (testo),
`data-i18n-html="chiave"` (HTML inline) o `data-i18n-placeholder="chiave"`.
`adoff-i18n.js` carica `/{lang}.json?v=<I18N_VER>` e li applica.

## Workflow (l'UNICO modo di toccare le traduzioni)

1. **Modifica / aggiungi** una chiave in `_matrix.json` (tutte le 15 lingue).
2. `python3 sviluppo/scripts/i18n_manager.py build`  → rigenera i `{lang}.json`.
3. `python3 sviluppo/scripts/i18n_manager.py check`   → **gate**: fallisce (exit≠0) se
   - una chiave `data-i18n` usata nell'HTML non esiste nella matrice;
   - una lingua manca una chiave;
   - (warning) una stringa è identica all'inglese = non tradotta.
4. Deploy con `bash sviluppo/scripts/deploy-site.sh` (esegue build+gate+leak prima di pubblicare).
5. **Bump** `I18N_VER` in `adoff-i18n.js` + il `?v=` degli script nelle pagine, così la
   cache 7-giorni dei JSON viene invalidata. (Il deploy wrapper NON lo fa: ricordalo a mano
   quando cambi i testi.)

## Comandi `i18n_manager.py`

| Comando | Cosa fa |
|---|---|
| `consolidate` | (one-off) ricostruisce `_matrix.json` dai 15 `{lang}.json` esistenti |
| `merge <file>` | inietta un fill `{chiave:{lang:val}}` nella matrice |
| `build` | matrice → 15 `{lang}.json` runtime |
| `check` | gate pre-deploy (exit≠0 sui problemi hard) |
| `report` | stesso di check ma senza exit code (diagnostica) |

`_same_ok.json` = allowlist di chiavi legittimamente identiche all'inglese
(es. `support.email.ph`, label bilingui) per togliere falsi positivi dal gate.

## Cosa NON è qui (ancora)

Le pagine prosa SEO (`how-it-works`, `unique-tech`, `vs/*`, `community`, `press`,
`best-ad-blocker-2026`, e le landing) sono HTML **baked** per-lingua in `/{lang}/`,
NON guidate da `data-i18n`. Restano fuori dalla matrice. Le pagine i18n-driven
(`index`, `install`, `support`, `privacy`, `terms`, `withdrawal`) sono invece
completamente centralizzate qui.

> Storia: prima di questo sistema le traduzioni erano sparse in 13 script `translate-*.py`
> one-off + 3 fonti non allineate (JSON, default HTML, pagine `/{lang}/`), senza alcun
> controllo → stringhe inglesi che sfuggivano silenziosamente. Gli script legacy sono
> archiviati in `sviluppo/archive/i18n-legacy-scripts/`.
