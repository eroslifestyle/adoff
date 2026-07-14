# WORKBOOK EDITORIALE MULTILINGUA — AdOff (2026)

> **Scope**: piano editoriale operativo + workbook di produzione per i video marketing AdOff sui social TikTok / Instagram Reels / Facebook (+ Shorts repurpose). Copre tutte le **15 lingue** del software.
> **Fonti autoritative** (NON sostituite, complementari):
> - `STRATEGIA-SOCIAL-CONTENT-2026.md` (pilastri, anti-spam, scelta piattaforme, decisione no-Business TikTok)
> - `BIBBIA-MARKETING.md` (tono, leve emotive, voce brand)
> - `automation/caption-prompt.md` + `automation/hook-bank.json` (generazione caption via LLM)
> - `feedback_video_line.md` → standard video approvato = composition `cyber-purge` (Remotion)
> - `tiktok-logo-discreet.md` → TikTok variante `__logosoft`, IG/FB logo pieno
> - `only-final-voiced-video.md` → solo video voiced+synced finali entrano in coda

---

## 1. Lingue coperte (15)

`it · en · de · fr · es · pt · ru · ar · zh · tr · id · pl · hi · ja · ko`

| Tier | Lingue | Note |
|---|---|---|
| Tier 1 (lancio + test creativo) | **it · en** | Validazione e taratura ritmo/musica/voce |
| Tier 2 (espansione EU + LATAM + BR) | de · fr · es · pt · pl · tr | Mercati ad-blocker maturi, alta saturazione pubblicità |
| Tier 3 (Asia + MENA + RU) | ru · ar · zh · id · hi · ja · ko | Maggior adattamento culturale: hashtag scrittura locale, RTL su `ar` |

> **Regola geo/lingua coerenti** (da STRATEGIA): un account-lingua posta nel **fuso del mercato** (non IT account che posta solo HI). Un solo "macro-account brand multilingua" non è realistico in T1: si scala per tier.

---

## 2. Cadenza & finestre orarie

- **3 post/lingua/settimana** (default workbook): **Lun · Mer · Ven**.
- Slot orari (locali, primo round; iterare con analytics nativi):
  - TikTok: 12:00–13:00 oppure 19:00–21:00
  - IG Reels: 11:00–12:00 oppure 19:00–20:00
  - FB Page: 18:00–20:00 (audience 35+)
  - YT Shorts: repurpose stesso giorno, qualsiasi ora
- Ciascun macro-fuso (EU / LATAM / MENA / EA / SEA) = un proprio scheduling, gli account-lingua escono nel proprio fuso.
- Mai burst, mai 2 post stessa lingua stesso giorno. **Ritmo regolare batte i picchi**.

---

## 2.b. Strategia audio + regime publish TikTok (decisione 2026-05-20)

**Audio nel video render = SOLO voce Chatterbox. Niente bed musicale generato (AI music TikTok-trend lo trovi solo nel catalogo nativo).**

I viral hacker/phonk-edit usano sempre la traccia trending dalla libreria nativa della piattaforma (TikTok "Add sound" / IG-FB Reels "Audio"). Vantaggi: musica vera (Kordhell, DVRST, PHNKR, BellyJay) licenziata dalla piattaforma, boost algoritmico (TikTok premia chi usa sound trending), zero licenze lato nostro, A/B testing gratis (stesso video silenzioso pubblicato N volte con N sound diversi).

**Regime publish adottato — B (Inbox + tap manuale audio):**
- Dispatcher carica via TikTok **Content Posting API endpoint `inbox/video/init/`** (no `post_info`, solo `source_info`). Video atterra come **draft nell'inbox app TikTok** dell'account brand.
- Creator (utente) apre app, vede il draft, tap "Add sound" → sceglie traccia trending del momento dal catalogo nativo, eventualmente regola caption (precompilata dalla nostra) → Publish.
- Costo manuale: ~30s a post in cambio di reach algoritmica reale.
- Status terminale API per inbox: `SEND_TO_USER_INBOX`. URL pubblico iniziale = `tiktok-inbox://draft/<publish_id>` (sentinel — non c'è ancora URL pubblico finché il creator non pubblica dall'app).
- Stesso pattern per IG/FB Reels via Meta Graph API → upload come **draft**, creator finalizza in Reels editor con "Audio" nativo.

**Toggle:** `TIKTOK_MODE=inbox` (default) | `TIKTOK_MODE=direct`. Variabile env del dispatcher `social_publish.py`. In direct, API pubblica subito (rinuncia al trend audio ma 100% autonomo).

**Impact playlist Playwright:** [[tiktok-logo-discreet]] + [[tiktok-playlist-automation]] valgono solo in regime direct (la playlist si assegna a video già pubblico). In inbox mode l'assegnazione playlist avviene quando il creator pubblica dall'app: niente hook automatico, è un secondo tap manuale o un task batch periodico.

---

## 3. Formato video VINCOLANTE — `cyber-purge` (standard approvato 2026-05-19)

> Vedi `src/CyberPurge.tsx`. Caratteristiche obbligatorie per OGNI video AdOff:
- Verticale 1080×1920, durata 18–30s.
- Sfondo animato per intero (digital rain + griglia + scanline). **NESSUN** glow viola statico, **nessuna** barra/scudo in basso.
- **Una immagine realistica per FRASE** (FLUX locale, on-demand sd-server :1237), trattata sci-fi.
- Cambio scena **agganciato al voiceover (~3s)**, cut secco.
- Voce Chatterbox brand IT/EN (clone Ava ML) velocizzata atempo ~1.18× per le altre lingue; bed musicale hi-tech.
- **Wipe circolare before→after sul "click"** + shockwave.
- Brand solo come **flash finale** centrale.
- TikTok: render con `--logo-mode=discreet` → suffix `__logosoft` (watermark angolo discreto). IG/FB/Shorts: render `full` (logo pieno).
- Contenuto: nessun brand reale, nessun prezzo, leva sulla frustrazione, IT/EN/15-lingue → testo a schermo == lingua voce, sincronizzato (`feedback_lang_av_sync`).

---

## 4. Flusso operativo dettagliato (workbook)

```
[F1] PIANO SETTIMANALE
       └─ 3 concept/sett (hook bank → caption-prompt) × 15 lingue
       └─ Output: piano CSV (giorno, lang, concept_id, piattaforme, slot)
                                  │
                                  ▼
[F2] PER OGNI POST — ASSET MULTILINGUA
       ├─ Script voiceover per lingua  (CONTENT in gen-voiceover-chatterbox.py)
       ├─ Voiceover Chatterbox + atempo 1.18  →  public/vo-cyber-<lang>.mp3 + .json
       ├─ Immagini FLUX per scena       →  public/scene-<lang>-0..N.jpg  (resiliente con auto-restart sd-server)
       ├─ Render Remotion ×2 varianti  →  output/typologies/cyber-purge-<lang>.mp4  +  cyber-purge-<lang>__logosoft.mp4
       └─ Caption + hashtag per lingua  via caption-prompt.md (LLM locale Qwen su LiteLLM)
                                  │
                                  ▼
[F3] QA / BRAND-POLICY FILTER
       ├─ grep -iE "youtube|google|facebook|instagram|tiktok|amazon|reddit|twitch|chrome|firefox|safari|edge|opera"  ← deve essere VUOTO
       ├─ check lang sync: testo a schermo == lingua voiceover
       ├─ check disclosure AI presente in caption (EU AI Act)
       └─ check durata 18–30s, audio AAC, no watermark esterno
                                  │
                                  ▼
[F4] ENQUEUE DRAFT  →  social_posts (status='draft')
       ├─ una riga per (lang × piattaforma)
       ├─ media_url su media.adoff.app (file mp4 corretto per piattaforma)
       └─ caption + hashtags pronti
                                  │
                                  ▼
[F5] HUMAN GATE  →  https://social.adoff.app  (admin UI)
       ├─ preview audio+video, lingua, hashtag, AI disclosure
       ├─ approva → status='approved'
       └─ REGOLA: validare UN campione per lingua prima di approvarne 3 (no bulk).
                                  │
                                  ▼
[F6] DISPATCHER  →  adoff-social-dispatch.timer (10min)
       ├─ Meta Graph API → IG/FB (logo pieno)
       ├─ TikTok Content Posting API → TikTok (`__logosoft`, sandbox SELF_ONLY finché review)
       └─ Log esito, retry, error capture
                                  │
                                  ▼
[F7] MISURA
       ├─ Engagement nativo (TikTok Studio, IG Insights, FB Insights)
       ├─ Click su bio-link → adoff.app (UTM `utm_source=<plat>&utm_medium=organic&utm_campaign=w<NN>-<concept>&utm_content=<lang>`)
       └─ Iterare: hook bank, slot orari, scene set
```

---

## 5. Matrice asset per UN post per UNA lingua

```
public/
  vo-cyber-<lang>.mp3                          (voce + timeline JSON)
  vo-cyber-<lang>.json
  scene-<lang>-0.jpg … scene-<lang>-6.jpg      (7 immagini frase-specifiche)
output/typologies/
  cyber-purge-<lang>.mp4                       (IG/FB/Shorts — logo full)
  cyber-purge-<lang>__logosoft.mp4             (TikTok — logo discreto)
social_posts (DB) ×3 righe:
  (platform=instagram, lang, media_url=…full.mp4,    caption_full, hashtags, status=draft)
  (platform=facebook,  lang, media_url=…full.mp4,    caption_full, hashtags, status=draft)
  (platform=tiktok,    lang, media_url=…logosoft.mp4, caption_short, hashtags, status=draft)
```

---

## 6. Struttura caption

```
<HOOK FRUSTRAZIONE 1 RIGA>            ← max 60 char, leva emotiva
<PROMESSA / RISOLUZIONE 1 RIGA>       ← cosa cambia con AdOff (generica)
<CTA SOFT>                            ← "adoff.app" — niente prezzo, niente "trial 15gg"
<HASHTAG BLOCK 6–10>                  ← lingua-locale + universali brand
<DISCLOSURE AI>                       ← una riga, lingua locale (EU AI Act)
```

- TikTok / IG / FB: stesso testo, ma TikTok tende a privilegiare hashtag in coda al testo; IG accetta block dedicato.
- Max 150 char + hashtag (TikTok caption limit oggi: 2200 ma rendimento alto sotto 150).
- Nessuna emoji aggressiva, max 1–2 emoji funzionali (es. silenzio, click).

---

## 7. Regole assolute (gate F3 NON deve mai fallire in produzione)

1. **Brand Name Policy**: vietati `youtube · google · facebook · instagram · tiktok · amazon · reddit · twitch · chrome · firefox · safari · edge · opera` (e altri brand) in caption/hashtag. Solo termini generici. Vedi project `CLAUDE.md`.
2. **Privacy founder**: zero dati personali. Voce = "noi" brand.
3. **No pricing aggressivo**: "free" implicito; il trial vive in bio/sito, mai nei caption.
4. **Lang sync**: caption == lingua voiceover == lingua testo a schermo.
5. **AI disclosure** in caption: obbligatoria (EU AI Act).
6. **No real-screen capture** di player video brandizzati: solo UI sintetica + immagini FLUX nostre.
7. **No bulk-enqueue** senza validare almeno UN campione per lingua/concept.

---

## 8. Esempio SETTIMANA 1 — 3 post × 15 lingue (45 post DRAFT)

> Format colonne: `concept_id · video_file · caption · hashtag · disclosure`. Bio-link `adoff.app` fisso. Slot orari = §2.
> Stessa composition `cyber-purge`, scena set rigenerato per lingua. Per il **post 1** la sorgente IT è il campione validato; per i restanti 2 concept si producono nuovi vo + scene-set per lingua.

### POST 1 — Lunedì · concept `c1-story-arc`
Hook universale: la storia completa frustrazione → click → silenzio (script cyber-purge-IT corrente).
Video file (per lang): `cyber-purge-<lang>.mp4` (IG/FB) + `cyber-purge-<lang>__logosoft.mp4` (TikTok).

| Lang | Caption (hook + promessa + CTA) | Hashtag | Disclosure AI |
|---|---|---|---|
| it | Volevi solo guardare un video. Poi un click — e torna il silenzio. → adoff.app | #pubblicità #stopads #navigaresenzapubblicità #adblock #privacy #navigazionepulita #adoff #zeroads | Contenuto creato con AI. |
| en | You just wanted to watch a video. One click — and the silence returns. → adoff.app | #ads #noads #adblock #stopads #cleanweb #privacy #adoff #zeroads | AI-assisted content. |
| de | Du wolltest nur ein Video schauen. Ein Klick — und es ist Ruhe. → adoff.app | #Werbung #keineWerbung #Adblocker #Privatsphäre #SauberesInternet #adoff #stopads | KI-unterstützter Inhalt. |
| fr | Tu voulais juste regarder une vidéo. Un clic — et le silence revient. → adoff.app | #publicité #stopauxpubs #adbloqueur #vieprivée #naviguersanspub #adoff #zeropub | Contenu assisté par IA. |
| es | Solo querías ver un video. Un clic — y vuelve el silencio. → adoff.app | #publicidad #sinanuncios #stopads #privacidad #internetlimpia #adoff #ceroanuncios | Contenido asistido por IA. |
| pt | Só querias ver um vídeo. Um clique — e volta o silêncio. → adoff.app | #publicidade #semanuncios #stopads #privacidade #internetlimpa #adoff #zeroanuncios | Conteúdo assistido por IA. |
| ru | Ты просто хотел посмотреть видео. Один клик — и снова тишина. → adoff.app | #реклама #безрекламы #блокировкарекламы #приватность #чистыйинтернет #adoff | Создано с помощью ИИ. |
| ar | كنتَ تريد فقط مشاهدة فيديو. نقرة واحدة — ويعود الصمت. → adoff.app | #إعلانات #بدون_إعلانات #حظر_الإعلانات #خصوصية #إنترنت_نظيف #adoff | محتوى من إنشاء الذكاء الاصطناعي. |
| zh | 你只是想看个视频。一键 — 安静重现。→ adoff.app | #广告 #屏蔽广告 #无广告 #干净网页 #隐私 #adoff | AI 辅助内容。 |
| tr | Sadece bir video izlemek istiyordun. Bir tık — ve sessizlik geri döner. → adoff.app | #reklam #reklamsız #adblock #gizlilik #temizinternet #adoff | Yapay zeka destekli içerik. |
| id | Kamu cuma mau nonton video. Satu klik — dan keheningan kembali. → adoff.app | #iklan #tanpaiklan #stopiklan #privasi #internetbersih #adoff | Konten dibantu AI. |
| pl | Chciałeś tylko obejrzeć wideo. Jedno kliknięcie — i wraca cisza. → adoff.app | #reklama #bezreklam #blokerreklam #prywatność #czystyinternet #adoff | Treść tworzona z pomocą AI. |
| hi | तुम बस एक वीडियो देखना चाहते थे। एक क्लिक — और फिर से शांति। → adoff.app | #विज्ञापन #बिनाविज्ञापन #प्राइवेसी #साफइंटरनेट #adoff | AI द्वारा सहायता प्राप्त सामग्री। |
| ja | ただ動画を見たかっただけ。ワンクリックで — 静けさが戻る。→ adoff.app | #広告 #広告ブロック #広告なし #プライバシー #快適ブラウジング #adoff | AI 補助コンテンツ。 |
| ko | 그냥 영상이 보고 싶었을 뿐. 한 번의 클릭 — 다시 찾아온 고요. → adoff.app | #광고 #광고차단 #광고없음 #프라이버시 #깨끗한웹 #adoff | AI 보조 콘텐츠. |

---

### POST 2 — Mercoledì · concept `c2-walls`
Hook universale: banner, pop-up, **muri anti-adblock** che ti bloccano. (Nuovo vo + scene-set per lingua: focus su anti-adblock walls.)

| Lang | Caption | Hashtag | Disclosure |
|---|---|---|---|
| it | Banner. Pop-up. Muri che ti bloccano. Un click li spegne. → adoff.app | #stopads #adblock #pubblicità #muripubblicitari #privacy #adoff #internetpulito | Contenuto creato con AI. |
| en | Banners. Pop-ups. Walls that lock you out. One click turns them off. → adoff.app | #adblock #stopads #popups #adwall #privacy #adoff #cleanweb | AI-assisted content. |
| de | Banner. Pop-ups. Mauern, die dich aussperren. Ein Klick schaltet sie aus. → adoff.app | #Adblocker #keineWerbung #Popups #Privatsphäre #adoff #SauberesInternet | KI-unterstützter Inhalt. |
| fr | Bannières. Pop-ups. Murs qui te bloquent. Un clic les éteint. → adoff.app | #adbloqueur #stopauxpubs #popups #vieprivée #adoff #naviguersanspub | Contenu assisté par IA. |
| es | Banners. Pop-ups. Muros que te bloquean. Un clic los apaga. → adoff.app | #adblock #sinanuncios #popups #privacidad #adoff #internetlimpia | Contenido asistido por IA. |
| pt | Banners. Pop-ups. Muros que te bloqueiam. Um clique apaga tudo. → adoff.app | #adblock #semanuncios #popups #privacidade #adoff #internetlimpa | Conteúdo assistido por IA. |
| ru | Баннеры. Поп-апы. Стены, которые тебя блокируют. Один клик — всё гаснет. → adoff.app | #блокировкарекламы #безрекламы #попап #приватность #adoff | Создано с помощью ИИ. |
| ar | لافتات. نوافذ منبثقة. جدران تقفلك. نقرة واحدة وتختفي. → adoff.app | #حظر_الإعلانات #بدون_إعلانات #نوافذ_منبثقة #خصوصية #adoff | محتوى من إنشاء الذكاء الاصطناعي. |
| zh | 横幅。弹窗。把你挡在外面的墙。一键关掉。→ adoff.app | #屏蔽广告 #无广告 #弹窗 #隐私 #adoff #干净网页 | AI 辅助内容。 |
| tr | Bannerlar. Pop-up'lar. Seni kilitleyen duvarlar. Bir tıkla kapanır. → adoff.app | #adblock #reklamsız #popup #gizlilik #adoff #temizinternet | Yapay zeka destekli içerik. |
| id | Banner. Pop-up. Dinding yang mengunci kamu. Satu klik dan padam. → adoff.app | #adblock #tanpaiklan #popup #privasi #adoff #internetbersih | Konten dibantu AI. |
| pl | Banery. Pop-upy. Ściany, które cię blokują. Jedno kliknięcie i znikają. → adoff.app | #blokerreklam #bezreklam #popup #prywatność #adoff #czystyinternet | Treść tworzona z pomocą AI. |
| hi | बैनर. पॉप-अप. दीवारें जो तुम्हें रोकती हैं। एक क्लिक — और बंद। → adoff.app | #बिनाविज्ञापन #विज्ञापन #पॉपअप #प्राइवेसी #adoff #साफइंटरनेट | AI द्वारा सहायता प्राप्त सामग्री। |
| ja | バナー。ポップアップ。あなたを締め出す壁。ワンクリックで消える。→ adoff.app | #広告ブロック #広告なし #ポップアップ #プライバシー #adoff #快適ブラウジング | AI 補助コンテンツ。 |
| ko | 배너. 팝업. 너를 막는 벽. 한 번의 클릭으로 사라져. → adoff.app | #광고차단 #광고없음 #팝업 #프라이버시 #adoff #깨끗한웹 | AI 보조 콘텐츠. |

---

### POST 3 — Venerdì · concept `c3-silence`
Hook universale: focus sul "dopo" — **silenzio totale, dal primo secondo**. Tono aspirazionale calmo (calm tint dominante, meno glitch, più viola).

| Lang | Caption | Hashtag | Disclosure |
|---|---|---|---|
| it | Un click. Silenzio totale. Dal primo secondo. → adoff.app | #silenzio #zeroads #adblock #navigazionepulita #privacy #adoff #stopads | Contenuto creato con AI. |
| en | One click. Total silence. From the very first second. → adoff.app | #silence #zeroads #adblock #cleanweb #privacy #adoff #stopads | AI-assisted content. |
| de | Ein Klick. Totale Ruhe. Schon ab der ersten Sekunde. → adoff.app | #Ruhe #keineWerbung #Adblocker #SauberesInternet #Privatsphäre #adoff | KI-unterstützter Inhalt. |
| fr | Un clic. Silence total. Dès la première seconde. → adoff.app | #silence #zeropub #adbloqueur #naviguersanspub #vieprivée #adoff | Contenu assisté par IA. |
| es | Un clic. Silencio total. Desde el primer segundo. → adoff.app | #silencio #ceroanuncios #adblock #internetlimpia #privacidad #adoff | Contenido asistido por IA. |
| pt | Um clique. Silêncio total. Desde o primeiro segundo. → adoff.app | #silêncio #zeroanuncios #adblock #internetlimpa #privacidade #adoff | Conteúdo assistido por IA. |
| ru | Один клик. Полная тишина. С первой секунды. → adoff.app | #тишина #безрекламы #блокировкарекламы #приватность #adoff | Создано с помощью ИИ. |
| ar | نقرة واحدة. صمت تام. منذ الثانية الأولى. → adoff.app | #صمت #بدون_إعلانات #حظر_الإعلانات #خصوصية #adoff | محتوى من إنشاء الذكاء الاصطناعي. |
| zh | 一键。完全的安静。从第一秒开始。→ adoff.app | #安静 #无广告 #屏蔽广告 #隐私 #adoff #干净网页 | AI 辅助内容。 |
| tr | Tek tık. Tam sessizlik. Daha ilk saniyeden. → adoff.app | #sessizlik #reklamsız #adblock #gizlilik #adoff #temizinternet | Yapay zeka destekli içerik. |
| id | Satu klik. Hening total. Dari detik pertama. → adoff.app | #hening #tanpaiklan #adblock #privasi #adoff #internetbersih | Konten dibantu AI. |
| pl | Jedno kliknięcie. Pełna cisza. Od pierwszej sekundy. → adoff.app | #cisza #bezreklam #blokerreklam #prywatność #adoff #czystyinternet | Treść tworzona z pomocą AI. |
| hi | एक क्लिक। पूरी शांति। पहले ही पल से। → adoff.app | #शांति #बिनाविज्ञापन #प्राइवेसी #adoff #साफइंटरनेट | AI द्वारा सहायता प्राप्त सामग्री। |
| ja | ワンクリック。完全な静けさ。最初の一秒から。→ adoff.app | #静けさ #広告なし #広告ブロック #プライバシー #adoff #快適ブラウジング | AI 補助コンテンツ。 |
| ko | 한 번의 클릭. 완전한 고요. 첫 순간부터. → adoff.app | #고요 #광고없음 #광고차단 #프라이버시 #adoff #깨끗한웹 | AI 보조 콘텐츠. |

---

## 9. Calendario settimana 1 (sintesi)

| Giorno | Concept | Asset master | Render varianti | Caption file |
|---|---|---|---|---|
| Lun | `c1-story-arc` | `cyber-purge` IT validato (riusare) + replica EN..KO | full + __logosoft × 15 | post1-captions.json |
| Mer | `c2-walls` | nuovo vo+scene set × 15 | full + __logosoft × 15 | post2-captions.json |
| Ven | `c3-silence` | nuovo vo+scene set × 15 | full + __logosoft × 15 | post3-captions.json |

→ Output settimana 1: **45 post** (15 lang × 3 concept), ognuno con 3 righe `social_posts` (IG / FB / TikTok) = 135 righe DRAFT in coda. Tutti human-gated.

---

## 10. Checklist pre-publish (per ogni post draft → approved)

- [ ] Lingua voce == lingua caption == lingua testo a schermo
- [ ] Durata 18–30s, audio AAC presente e sincronizzato
- [ ] Variante `__logosoft` usata SOLO per TikTok (e logo full su IG/FB)
- [ ] Caption ≤ 150 char + hashtag block 6–10
- [ ] AI disclosure presente in caption
- [ ] grep brand reali = vuoto
- [ ] grep "prezzo / abbonamento / pagamento" = vuoto
- [ ] Bio-link `adoff.app` con UTM tag corretto per piattaforma/concept/lang
- [ ] Slot orario nel fuso del mercato lingua

---

## 11. TikTok — playlist per lingua (post-publish automation)

L'API TikTok Content Posting **non espone** un parametro `playlist_id` (verifica
sui doc ufficiali developers.tiktok.com 2026-05-19: changelog senza voci `playlist/folder/collection/series` per Content Posting; `post_info` accetta 9 campi e nessuno di organizzazione). Soluzione: post-publish hook Playwright sulla TikTok Studio Web del brand.

### Componenti
- Modulo: `sviluppo/ai-autopilot/n8n-workflows/scripts/tiktok_playlist.py`
- Venv dedicato: `~/.cache/adoff-playwright-venv` (Playwright 1.49 + Chromium)
- Persistent profile (cookie + localStorage Studio Web): `~/.cache/adoff-playwright-venv/tt_profile/`
- Hook nel dispatcher: `social_publish.py::_tiktok_assign_playlist_safe()` chiamato in `_publish_tiktok` subito dopo `PUBLISH_COMPLETE`. Subprocess con timeout (`TIKTOK_PLAYLIST_TIMEOUT=120s` default). **Best-effort**: se fallisce, la pubblicazione resta valida e il dispatcher prosegue.

### Mappa lingua → nome playlist (nativo)
`it→Italiano · en→English · de→Deutsch · fr→Français · es→Español · pt→Português · ru→Русский · ar→العربية · zh→中文 · tr→Türkçe · id→Bahasa Indonesia · pl→Polski · hi→हिन्दी · ja→日本語 · ko→한국어`

### Setup one-time (login Studio Web)
```bash
~/.cache/adoff-playwright-venv/bin/python \
  sviluppo/ai-autopilot/n8n-workflows/scripts/tiktok_playlist.py bootstrap
# si apre Chromium HEADED → fai login al brand account TikTok Studio
# quando vedi la lista Posts → premi INVIO nel terminale → sessione salvata
```

### Test manuale
```bash
~/.cache/adoff-playwright-venv/bin/python \
  sviluppo/ai-autopilot/n8n-workflows/scripts/tiktok_playlist.py assign <pid> <lang>
```
Se l'UI Studio cambia layout e i selettori non matchano: `bootstrap --debug`
(apre headed con `page.pause()` per ispezione selettori).

### Limiti / accettati
- Borderline policy: automazione di sessione autenticata sul **proprio** account brand.
  Su account piccoli passa; su account grandi possono scattare verifiche.
- Selettori UI Studio: stringhe testuali (`Add to playlist`, `Create playlist`) + ARIA.
  Se TikTok cambia label, aggiornare i `texts` in `_click_menu_item` / `_pick_or_create_playlist`.
- 1 playlist per video (limite TikTok), 1 playlist per lingua → mapping 1:1.

---

## 12. Integrazione n8n — workflow 15 "Cyber Purge Producer"

End-to-end host+n8n per UN video `cyber-purge` per `(lang, concept)`.

### Architettura
```
[n8n container 15-cyber-purge-producer]
   │  Manual Trigger / Set lang+concept
   │
   │  POST http://host.docker.internal:8792/build/cyber-purge {lang, concept, force}
   ▼
[host adoff-marketing-bridge.service  (FastAPI :8792)]
   │  subprocess → chatterbox-venv python cyber-purge-build.py --lang … --concept …
   ▼
[host cyber-purge-build.py]
   1) VO Chatterbox brand + atempo 1.18 → public/vo-cyber-<lang>.{mp3,json}
   2) FLUX scenes resiliente (auto-restart sd-server)  → public/scene-<lang>-N.jpg
   3) Render Remotion id=cyber-purge → output/typologies/cyber-purge-<lang>.mp4
   4) JSON summary su stdout
   ▼  (HTTP response al workflow n8n)
[n8n continua]
   │  Copy agent Ollama (qwen2.5:7b) → caption + hashtags + AI disclosure (lang)
   │  Brand-guard code (regex su brand reali + "trial/paid/subscription")
   │  Postgres INSERT × 3 (IG/FB/TikTok) in adoff_autopilot.social_posts (status=draft)
   │  Telegram notify (success o failure)
```

### Componenti
- Workflow: `sviluppo/ai-autopilot/n8n-workflows/workflows/15-cyber-purge-producer.json` (id `ADOFF15CYBPURGE1`, **inattivo** finché non lo abiliti dalla UI)
- Concept: `sviluppo/marketing/video-engine/concepts/<concept_id>.json` (oggi: `c1-story-arc` IT+EN)
- Orchestrator: `sviluppo/marketing/video-engine/cyber-purge-build.py` (idempotente)
- Bridge HTTP: `sviluppo/ai-autopilot/n8n-workflows/scripts/marketing_bridge.py` (FastAPI :8792)
- Systemd unit: `~/.config/systemd/user/adoff-marketing-bridge.service` (enabled, autostart)
- Mount n8n: `/home/mrxxx/adoff` montato rw in `n8n` + `n8n-worker` (docker-compose `/opt/n8n/docker-compose.yml`)
- Firewall: ufw allow da 172.17.0.0/16 · 172.18.0.0/16 · 172.21.0.0/16 → tcp 8792

### Smoke test rapido (IT, idempotente, ~0.15s)
```bash
docker exec n8n wget -qO- --post-data='{"lang":"it","concept":"c1-story-arc","force":false}' \
  --header='Content-Type: application/json' http://host.docker.internal:8792/build/cyber-purge
```

### Health bridge
```bash
curl -s http://127.0.0.1:8792/healthz
systemctl --user status adoff-marketing-bridge
journalctl --user -u adoff-marketing-bridge -f
```

### Per attivare (manuale)
1. UI n8n → workflow "AdOff 15 - Cyber Purge Producer"
2. Postgres node → bind credential `n8n-postgres` (placeholder da risolvere alla prima esecuzione)
3. Env nel container n8n (in `/opt/n8n/.env`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
4. Eseguire "Manual Trigger" con lang/concept di default (`it` / `c1-story-arc`) → verifica draft in `social_posts`

### Aggiungere una nuova lingua
1. Aggiungere blocco lingua in `concepts/c1-story-arc.json` (`scripts.<lang>`)
2. Eseguire il workflow con `lang: <xx>` (Set node). VO + scene + render generati automaticamente.

### Aggiungere un nuovo concept (es. c2-walls)
1. Creare `concepts/c2-walls.json` (stessa struttura di c1)
2. Cambiare il parametro `concept` nel Set node del workflow (o passarlo via UI)

---

## 13. Note operative aperte

- **Musica**: oggi `public/bgm_full.mp3` = **placeholder con licenza non documentata**. Prima del primo publish reale → sostituire con traccia cyber royalty-free certa (Uppbeat / Pixabay / Artlist) e ri-render.
- **Bug timing EN**: `vo-cyber-en` non è ancora prodotto; quando si genera, usare la pipeline Chatterbox attuale evitando il "buco morto" osservato su `vo-tech-reveal-en`.
- **Iterazione**: in T1 (it+en) si tarano ritmo/musica/hashtag con analytics nativi prima di scalare a T2/T3.
- **Anti-spam**: niente repost watermarkato cross-platform — sempre re-export dal master Remotion (vedi STRATEGIA §3).

---

*Workbook V1 — 2026-05-19. Aggiornare quando cambiano: standard video, regole brand, copertura lingue, cadenza.*
