# Brief per l'agente di lingua

Working dir: `/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin`

## Ambito esclusivo

Ti viene assegnato un codice lingua `XX`. Il tuo ambito è **soltanto**:
- i file `.html` dentro `site/XX/` (sottocartelle incluse: `site/XX/vs/`, `site/XX/blog/`, `site/XX/about-data/`)
- il dizionario `site/i18n/XX.json`

Altri 15 agenti lavorano **nello stesso momento** sulle altre lingue e sulla root.
Non toccare nulla fuori dal tuo ambito. In particolare **mai**: `site/adoff-*.js`,
`site/i18n/_matrix.json`, gli altri `site/i18n/*.json`, `site/*.html` di root,
`sviluppo/scripts/i18n_manager.py`, `sviluppo/scripts/deploy-site.sh`.

## Cosa leggere prima di iniziare

1. `sviluppo/scripts/audit/SPEC-contenuti.md` — la specifica completa, con la verità di
   riferimento del prodotto (versione, trial, prezzi, regole, browser).
2. `sviluppo/scripts/audit/out/work/XX.md` — la tua lista di lavoro, con file, riga e
   contesto di ogni occorrenza da valutare.

## Il punto in cui è più facile sbagliare

Il trial passa da 30 a **15 giorni**. Ma nel sito convivono tre cose diverse che valgono
«30 giorni», e solo la prima va cambiata:

1. **durata della prova gratuita Pro** → diventa **15**
2. **garanzia soddisfatti o rimborsati** → resta **30**
3. **durata del cookie di affiliazione** → resta **30**

Una stessa frase può contenerne due: *"30 giorni gratis · garanzia di rimborso 30 giorni"*
→ il primo diventa 15, il secondo resta 30.

La lista di lavoro segnala i candidati con un filtro automatico che **non è affidabile**:
è stato tarato su 15 lingue e sbaglia. Valuta ogni occorrenza nel suo contesto reale.
Se una frase è ambigua, **lasciala invariata e segnalala nel report**: meglio un'occorrenza
non corretta che una corretta a sproposito.

Quando cambi il numero, adegua la grammatica attorno: in russo, polacco, arabo e hindi
cambiare solo la cifra produce forme sbagliate (declinazioni, classificatori, plurali).

## Le altre correzioni

Sono descritte nella SPEC. In sintesi:
- **Lifetime**: il piano a vita non esiste più. Rimuovilo da card, tabelle, FAQ, testi.
  Attenzione al falso positivo: *«prezzo Founder bloccato a vita»* riguarda il prezzo del
  piano annuale ed è una promessa **ancora valida** — non va rimossa.
- **Prezzi**: solo quelli del listino in SPEC. Gli intervalli legati ai vecchi tier per
  numero di dispositivi vanno riscritti: piano unico fino a 3 dispositivi.
- **Versione**: quella corrente è nel manifest. Le voci di changelog storico restano.
- **Safari — CORREZIONE, leggi con attenzione**: una versione precedente di questo brief
  diceva di rimuovere Safari. **Era sbagliato e ha già causato un errore.** La verità:
  `site/adoff-safari.zip` esiste ed è scaricabile (152 KB), quindi l'estensione Safari
  **c'è**. Non è ancora sul Mac App Store e richiede Xcode per l'installazione permanente:
  è esattamente ciò che dicono già le pagine di installazione, ed è corretto.
  Quindi: **non rimuovere le sezioni Safari dalle pagine di installazione, e non
  cancellare le chiavi `install.safari.*` dai dizionari.** L'unica cosa da correggere lì
  è la versione stantia (`v3.4.6` in `install.dl.info.safari`).
  Dove invece si dichiara un **conteggio** di browser supportati, quello resta **5**
  (Chrome, Firefox, Edge, Opera, Brave): Safari non entra nel conteggio finché non è
  distribuito sullo store.
- **Regole**: sono 144. Non toccare i numeri riferiti ad altri prodotti (le 80.000 regole
  di altri blocker, il limite di 30.000 di Chrome: sono confronti corretti).
- **Separatore**: nei `<title>` tradotti il carattere `·` è diventato una virgola.
  Va ripristinato ` · `.

## SEO

Per le pagine elencate nella sezione SEO della tua lista:
- `<meta name="description">` unica per pagina, 140-160 caratteri, **nella tua lingua**
- `<link rel="canonical">` che punta a **se stessa**, URL pubblico `https://adoff.app/XX/...`
  **senza estensione `.html`** (il sito usa URL extensionless)
- meta Open Graph mancanti: `og:title`, `og:description`, `og:image`.
  Per `og:image` usa un file che esiste davvero (`ls site/assets/`), URL assoluto.

## Coerenza HTML ↔ dizionario

Se il testo sbagliato si trova in una chiave i18n, correggerlo solo nell'HTML **non serve**:
il runtime lo sovrascrive col valore del dizionario. Correggi entrambi.
Per capire se un testo è governato da una chiave, cerca l'attributo `data-i18n` sull'elemento.

## Regola di esecuzione

Per le trasformazioni ripetitive fatti generare uno script da MiniMax
(`m3-code "<spec>" > sviluppo/scripts/audit/fix_XX.py`), ispezionalo, eseguilo, verifica.
Per le riscritture che richiedono giudizio linguistico intervieni tu, occorrenza per
occorrenza, con Edit.

## Criteri di accettazione (riporta l'output letterale)

1. Rigenera la tua lista con `python3 sviluppo/scripts/audit/make_worklists.py` e mostra il
   prima/dopo della riga della tua lingua: le occorrenze devono essere scese in modo netto.
2. Ogni occorrenza rimasta va motivata (falso positivo, oppure rimborso/cookie legittimo).
3. `site/i18n/XX.json` resta JSON valido e non perde chiavi: mostra il conteggio prima e dopo.
4. Nessun HTML corrotto: tutti i file del tuo ambito si aprono e si parsano.
5. `git diff --stat` sui tuoi file: poche righe per file. Centinaia di righe cambiate su un
   singolo file significa che hai riformattato l'HTML: annulla con `git checkout` e rifai.

## Divieti

- NON `git commit`, NON `git push`, NON deploy
- NON riformattare l'HTML, non cambiare indentazione, non riordinare attributi
- NON aggiungere né rimuovere attributi `data-i18n`
- NON tradurre chiavi che non riguardano le correzioni sopra (la traduzione di massa è un
  lavoro separato che verrà fatto dopo)

## Report finale

Conteggi per tipo di correzione, output letterale dei 5 criteri, elenco delle occorrenze
deliberatamente non corrette con il motivo. Se qualcosa non ha funzionato, dillo: un
fallimento dichiarato vale più di un successo apparente.
