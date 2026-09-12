# Runbook — Autorizzazioni API social (TikTok + Meta IG/FB)

> Data: 2026-05-17 · Obiettivo: accesso API DIRETTO per pubblicare automaticamente
> su Instagram, Facebook, TikTok dallo stack n8n self-hosted (leobox).
> Fonti: docs ufficiali developers.tiktok.com + developers.facebook.com (2026-05).

---

## ⚠️ CAVEAT ARCHITETTURALE (leggere PRIMA — fa risparmiare settimane)

Sia l'**audit TikTok** sia l'**App Review Meta** richiedono di **dimostrare a un
revisore umano una UX**:
- TikTok: schermata che mostra nickname/avatar creator, dropdown privacy (nessun
  default), checkbox interazioni, disclosure commerciale, preview, consenso esplicito.
- Meta: screencast replicabile del flusso di pubblicazione con account di test.

La nostra pipeline è **n8n headless (nessuna UI)** → un revisore non può "usarla".

**Soluzioni (scegliere):**
- **S1 — Thin admin UI** (consigliata se vuoi API dirette): una mini pagina web
  interna (1 form: scegli account, vedi info creator, scegli privacy, anteprima,
  "Pubblica") che chiama gli stessi endpoint. Serve SOLO a superare gli audit e
  come pannello di pubblicazione manuale/approvazione; l'automazione n8n gira
  dietro. ~1-2 giorni di build.
- **S2 — Aggregatore pre-auditato per TikTok** (upload-post/Blotato): salti
  l'audit TikTok (2-4 settimane). Meta IG/FB li fai comunque diretti (più facili).
- **S3 — Solo Meta diretto + TikTok in "upload to inbox"**: TikTok senza audit
  pubblica solo in bozza/privato (`SELF_ONLY`) → tu confermi a mano dall'app
  TikTok. Zero audit, ma TikTok resta semi-manuale.

> Decisione presa dall'utente: **richiedere autorizzazione TikTok ufficiale +
> registrarsi Business su Meta per API dirette**. ⇒ percorso = **S1**
> (costruiamo la thin admin UI per superare gli audit), descritto sotto.

> ### DECISIONI UTENTE (2026-05-18) — LOCKED
> - **Scope Meta = SOLO brand AdOff** ⇒ **Standard Access**, NIENTE Business
>   Verification con documenti (A2 SALTABILE). App Review più rapido. Basta che
>   gli account abbiano un ruolo nell'app / token System User del Business.
> - **Device IG = Android (app)** ⇒ sequenza conversione Business sotto (A0).
> - **Pagina FB = già esistente e collegata all'IG** ⇒ C1 quasi completo;
>   resta solo verificare che il tipo account IG sia **Business** (non Creator).

---

# PARTE A — META (Instagram + Facebook) API dirette

### A0. Conversione IG → Business su Android (sequenza esatta, app IG 2026)
> La Pagina FB è già collegata (decisione utente). Serve solo garantire che il
> **tipo account = Business** (Azienda), NON Creator.

1. Apri app Instagram → tap **foto profilo** (in basso a destra).
2. Tap **☰** (tre linee, in alto a destra) → **Impostazioni e attività**.
3. Scorri giù fino alla sezione **"Per i professionisti"**.
4. Tap **"Tipo di account e strumenti"**.
   - Se vedi **"Passa a un account professionale"** → l'account è Personale:
     tap, scegli categoria, poi **scegli "Azienda"** (NON "Creator"), conferma
     il collegamento alla Pagina FB esistente, completa contatti → FINE.
   - Se vedi **"Passa a un account aziendale"** → sei su Creator: tap quella
     voce per passare ad **Azienda** (Business). Conferma Pagina FB.
   - Se vedi già **"Account aziendale"** con opzione "Passa a Creator" → sei
     già **Business**: nulla da fare, prerequisito OK. ✅
5. Verifica collegamento Pagina: ☰ → Impostazioni → **"Centro account"** →
   *Account* → deve elencare sia l'IG sia la Pagina FB del brand.

### Prerequisiti account (fare PRIMA)
- [x] Account Instagram del brand convertito a **Business** — vedi A0 (verificare).
- [x] **Pagina Facebook** del brand creata e **collegata** — già fatto (utente).
- [ ] **Meta Business Portfolio** (ex Business Manager) creato su
      business.facebook.com con il brand.

### A1. App Meta Developer
1. business.facebook.com → crea/verifica il **Business Portfolio**.
2. developers.facebook.com → *My Apps* → **Create App** → use case **"Other" →
   tipo "Business"** → collega al Business Portfolio.
3. Annota **App ID** + **App Secret** (Settings → Basic).
4. *Add Product*: aggiungi **Instagram** (Graph API) + **Facebook Login**.
5. Settings → Basic: compila Privacy Policy URL (adoff.app/privacy), categoria,
   icona, dominio. Senza questi l'App Review viene respinto.

### A2. Business Verification — ⏭️ SALTABILE (decisione utente: solo brand AdOff)
- Decisione LOCKED: pubblichiamo SOLO su account del brand AdOff ⇒ restiamo in
  **Standard Access**. **Business Verification NON necessaria**, NIENTE documenti.
- Requisito: gli account/Pagina devono avere un **ruolo nell'app** (assegnati al
  Business Portfolio) e si usa un **token System User** (vedi A4).
- (Solo se in futuro servisse pubblicare per terzi: riattivare Advanced Access +
  Business Verification — visura/P.IVA/dominio, 2–10 gg. NON ora.)

### A3. Permessi da richiedere (un'unica review, bundle)
Path **Facebook Login** (consigliato per Pagine):
- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`
- (se l'utente ha ruolo Pagina via Business: `ads_management`, `ads_read`)

App Review → *Permissions and Features* → **Request** su ciascuno → conferma
**Advanced Access**.

### A4. Materiale per l'App Review (causa #1 di rifiuto = screencast incompleto)
Per OGNI permesso:
- [ ] Descrizione use-case (es. *"L'app pubblica automaticamente video/foto del
      brand sulle Pagine FB e sull'account IG Business di proprietà, schedulati
      dal nostro backend"*).
- [ ] **Screencast** che mostra il flusso completo end-to-end **usando l'account
      di test**, replicabile passo-passo (qui entra la thin admin UI S1 → Parte C).
- [ ] **Utente di test**: nuovo account FB dedicato, **2FA attiva + backup codes
      salvati**, aggiunto come *Tester*, con una Pagina FB di test + IG Business
      di test collegato. (Il 2FA con backup codes evita blocchi geografici al
      revisore.)
- [ ] Token: genera un **System User token long-lived** (Business Settings →
      System Users → crea → assegna Pagina + asset IG → Generate Token con gli
      scope sopra). Questo token va in n8n credenziale httpRequest.

### A5. Go-live
App Review approvato → bollino verde in *App Review → My Permissions*.
Token System User → credenziale in n8n → workflow `14-meta-publisher`.

---

# PARTE B — TIKTOK Content Posting API (audit)

### B1. Registrazione developer + app
1. developers.tiktok.com → registra account developer (verifica email/telefono).
2. *Manage apps* → **Create app**. Compila: nome, descrizione, sito
   (adoff.app), categoria, Terms/Privacy URL, icona.
3. *Add product* → **Content Posting API** → abilita **Direct Post**
   configuration.
4. *Add scope*: `video.publish` (post diretto) [+ `video.upload` se vuoi anche
   il flusso bozza]. Annota **Client Key** + **Client Secret**.
5. Configura **Redirect URI** OAuth (es. https://adoff.app/oauth/tiktok/callback).

### B2. Fase non-auditata (test)
- Implementa OAuth: ottieni `access_token` + `open_id` dell'account brand.
- Tutti i post da client NON auditato sono forzati `SELF_ONLY` (privati): ok per
  testare la pipeline tecnica.

### B3. Requisiti che l'auditor VERIFICA (hard requirements)
La UX (thin admin UI S1, Parte C) **deve**:
- [ ] Chiamare `POST /v2/post/publish/creator_info/query/` PRIMA di ogni post e
      **mostrare nickname + avatar** del creator target.
- [ ] **Dropdown privacy senza default**, opzioni = `privacy_level_options`
      ricevute (Public/Friends/Private).
- [ ] Checkbox **Comment/Duet/Stitch**, tutte **default OFF**, grigiate se
      disabilitate lato creator (foto: niente Duet/Stitch).
- [ ] Rispettare `max_video_post_duration_sec` (blocca video più lunghi).
- [ ] Toggle **disclosure commerciale** (default OFF): se ON → scelta "Your
      Brand" (*Promotional content*) e/o "Branded Content" (*Paid partnership*);
      branded non può essere Private; serve almeno una scelta o disabilita
      "Pubblica".
- [ ] **Preview** del contenuto + testo/hashtag editabili dall'utente.
- [ ] Testo legale: *"By posting, you agree to TikTok's Music Usage
      Confirmation"* (+ Branded Content Policy se disclosure attiva).
- [ ] **Consenso esplicito** prima dell'upload + avviso "l'elaborazione richiede
      qualche minuto" + polling stato.
- [ ] **NESSUN watermark/logo/branding aggiunto via app** ⚠️ i nostri MP4
      Remotion hanno il logo → per TikTok serve **variante senza logo** (vedi nota
      pipeline sotto).
- [ ] **AI-labeling 2026**: i video sono AI-generati → flag contenuto sintetico.

### B4. Submit audit
1. App dashboard → Content Posting API → **Submit for audit**.
2. Fornisci: use-case chiaro, **demo live** (URL della thin admin UI +
   email/password test + guida "come schedulare un post"), eventuale video.
3. Tempi: **2–4 settimane**, di solito 1+ round di feedback.
4. Approvato → cap giornaliero per-app fissato in base all'uso stimato
   (~15 post/giorno/creator, ~6 req/min).

### B5. Note ToS continuative
- No watermark/logo via app (ban a rischio). 
- Moderazione post-publish: `PUBLISH_COMPLETE` non garantisce permanenza.
- Detection comportamentale anche via API ufficiale: varia IP/frequenza/contenuto.

---

# PARTE C — Thin admin UI (sblocca entrambi gli audit) — ✅ COSTRUITA (2026-05-18)

Mini web app FastAPI (1 file + 1 template) servita da leobox su
`127.0.0.1:8790`, dietro Caddy/Cloudflare con basic auth integrata.

**File:**
- `scripts/social_queue.sql` — schema `adoff_autopilot.social_posts`
  (queue mutabile) + `social_published` (log immutabile) + viste
  `social_ready` / `social_inbox`. Pattern allineato a `youtube_queue`.
- `scripts/social_publish.py` — libreria + dispatcher CLI:
  `creator_info_tiktok()`, `page_info_meta()`, `publish_post(row)`;
  TikTok Direct Post (FILE_UPLOAD + poll stato), Meta IG (container→publish)
  e FB Page (video file_url / photo url). CLI: `--dispatch [--platform]`,
  `--once <id>`.
- `admin-ui/app.py` — FastAPI: `GET /`, `GET /post/{id}` (carica
  creator_info/page_info), `POST /creator-info`, `GET /media/{id}`
  (preview), `POST /publish` (validazione audit server-side →
  `status='approved'`), `POST /skip`, `GET /healthz`.
- `admin-ui/templates/publish.html` — UX audit-conforme (vedi sotto).
- `admin-ui/requirements.txt` · `infra/adoff-admin-ui.service` ·
  `infra/adoff-social-dispatch.{service,timer}` (dispatch ogni 10').

**Flusso (gate approvazione umana):** l'automazione n8n inserisce job in
`social_posts` con `status='draft'`; l'umano apre la UI, vede preview +
creator_info, sceglie privacy/disclosure, dà **consenso esplicito** →
`status='approved'`; `social_publish.py --dispatch` (timer systemd)
pubblica e scrive `social_published`. La stessa UI è ciò che il revisore
TikTok/Meta usa per replicare il flusso end-to-end.

**Hard requirements audit implementati (TikTok B3 / Meta A4):**
creator_info chiamato prima del post (nickname+avatar mostrati) · dropdown
privacy SENZA default (= `privacy_level_options`) · checkbox
comment/duet/stitch default OFF e grigiate se disabilitate lato creator ·
enforcement durata max · toggle disclosure default OFF → Your Brand /
Branded Content (BC non Private, validato client+server) · flag
AI-generated (default ON) · preview media + caption/hashtag editabili ·
testo legale Music Usage Confirmation (+ Branded Content Policy) ·
consenso esplicito obbligatorio + avviso elaborazione · blocco
pubblicazione se media TikTok ha il logo (manca variante no_logo).

**Setup su leobox:**
```
docker exec -i n8n-postgres psql -U n8n -d n8n < scripts/social_queue.sql
mkdir -p .secrets && chmod 700 .secrets
# popolare .secrets/meta_app.json, tiktok_app.json, tiktok_oauth.json (chmod 600)
pip install -r admin-ui/requirements.txt
sudo cp infra/adoff-admin-ui.service /etc/systemd/system/
sudo cp infra/adoff-social-dispatch.{service,timer} /etc/systemd/system/
# editare ADOFF_ADMIN_PASS nel .service
sudo systemctl daemon-reload
sudo systemctl enable --now adoff-admin-ui.service adoff-social-dispatch.timer
```
Per gli audit: esporre la UI a un URL HTTPS (Cloudflare Tunnel/Caddy) e
fornire al revisore URL + credenziali di test + guida "come pubblicare".

---

# CHECKLIST OPERATIVA (ordine consigliato)

```
[x] —   Decisioni utente (scope Meta=solo AdOff, device=Android, FB collegata)
[x] C1  IG → Business ✅ 2026-05-18 (era Creator → convertito) + Pagina FB collegata
[x] C1b Meta Business Portfolio "AdOff — Ad Blocker" ✅ già presente
[x] A1  App Meta "AdOff Publisher" (ID 965237719818838) + casi d'uso
        Instagram + Pagina + 6 permessi (Pronta per il test) ✅ 2026-05-18
[x] A4  System User "adoff-sysuser" + token non scadente + meta_app.json
        scritto (ig_user_id 17841414442557578, fb_page_id 1062260056978225)
        + page_info_meta() verificato end-to-end ✅ 2026-05-18
[x] B1  TikTok app "AdOff" (org AdOff) + Sandbox + Login Kit +
        Content Posting API (Direct Post ON) + scope video.publish/
        video.upload/user.info.basic ✅ 2026-05-18
[x] B2  OAuth sandbox: tiktok_app.json + tiktok_oauth.json (open_id
        -000XL8NO3...) + creator_info_tiktok() verificato e2e ✅
        (`scripts/tiktok_oauth.py` bootstrap creato). Target user brand
        autorizzato. Production form: bloccato su video demo (atteso →
        si registra dopo deploy admin-ui, poi Submit for review)
[x] C   Thin admin UI (build)                                  ✅ FATTA 2026-05-18
[⏭] A2  Meta Business Verification — SALTATA (solo brand AdOff, Standard Access)
[ ] A3  Meta App Review: bundle 4 permessi + screencast + test acc.   (tu+Claude)
[ ] B3  TikTok: UI conforme (creator_info, privacy, disclosure...)    (Claude)
[ ] B4  TikTok submit audit (demo URL + cred test)            (tu, 2-4 sett attesa)
[x] —   Pipeline no-logo variant per TikTok ✅ 2026-05-18
        `video-engine/src/brand.tsx`: Wordmark legge inputProps.noLogo
        (getInputProps) → null se true. Flag `--no-logo` in
        batch-render.mjs (output `<id>__<lang>__nologo.mp4`) e render.mjs.
        Default invariato (legacy identico). Validato e2e (still
        before-after con/senza logo). Job TikTok → no_logo_variant=TRUE
        + render con --no-logo. NB: composizione bespoke `tiktok-adoff`
        ha scena logo strutturale propria → per TikTok usare SEMPRE i
        template bank (hook-card/before-after) con --no-logo, non quella.
[x] 14  Workflow n8n `14-social-enqueue.json` (bank→social_posts draft,
        IG/FB/TikTok no-logo, idempotente) — validato 3-layer ✅
[x] D   Deploy leobox ✅ 2026-05-18 (ambiente Claude = leobox):
        symlink /home/mrxxx/adoff→progetto · social_queue.sql applicato ·
        venv admin-ui · systemd adoff-admin-ui.service (LIVE :8790,
        fix Starlette TemplateResponse) + adoff-social-dispatch.timer ·
        wf 14 importato n8n (cred reale) · admin UI esposta su URL
        STABILE **https://social.adoff.app** (cloudflared named tunnel
        "adoff-admin" id a985af34..., systemd cloudflared-adoff-admin.
        service, basic auth in .secrets/admin-ui.env). Token CF tunnel
        in CF_API_TOKEN_TUNNEL + .secrets/cf-tunnel.{json,env}.
[x] D2  Wiring media ✅ 2026-05-18: `scripts/media_server.py`
        (read-only, solo bank *.mp4, traversal-safe) → systemd
        `adoff-media-server.service` :8791 → ingress cloudflared
        **https://media.adoff.app** (pubblico no-auth, per IG/FB
        media_public_url) + DNS CNAME. TikTok: symlink
        `/opt/n8n/local-files/adoff-bank` → bank (FILE_UPLOAD path).
        Workflow 14 aggiornato (media_public_url + tt path) + re-import.
[ ] D3  Reload n8n (docker restart n8n — infra condivisa, scelta
        utente) per registrare schedule wf 14.
[ ] R   Video demo flusso admin UI (TikTok sandbox) → Submit for review
        TikTok Production (sblocca pubblico; oggi sandbox=SELF_ONLY)
[ ] G   Go-live: dispatcher pubblica i job approvati (Meta già pronto,
        TikTok sandbox pronto)
```

Segreti (gitignored, chmod 600, in `n8n-workflows/.secrets/`):
- `meta_app.json` → `{"system_user_token","ig_user_id","fb_page_id",
  "fb_page_token","graph_version":"v22.0"}`
- `tiktok_app.json` → `{"client_key","client_secret"}`
- `tiktok_oauth.json` → `{"client_key","access_token","refresh_token","open_id"}`
