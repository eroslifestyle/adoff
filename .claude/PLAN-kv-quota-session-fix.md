# PLAN — Fix login user+admin: sessioni KV → D1 + cache edge (quota KV read sfondata)

## Diagnosi (certa, verificata)
- Login user e admin rotti: **quota READ KV free-tier sfondata** — oggi **122.170 read** vs cap **100.000/giorno** (Cloudflare GraphQL analytics).
- Meccanismo: a quota satura `kvGet()` (worker.js L61) intercetta "limit exceeded" e ritorna `null`. `verifyAccountAuth`/`verifyAdminAuth` leggono la sessione da KV → `null` → 401 → il client fa logout. Sintomo utente: "torni ok ma resti fuori". Log live confermato: `[kvGet] Rate limit exceeded for key "account_session:..."`.
- Fonte del carico: ~10k richieste/ora **solo di giorno** (07-14 IT), ~2 read KV ciascuna; crollo netto alle 15 IT. Consumer esatto non ancora isolato (Fase 3).

## Obiettivo
Rendere la **validazione sessione indipendente dalla quota KV**, così login user+admin funzionano **anche a quota satura**. Zero costi ricorrenti (resta free-tier). D1 free-tier = 5M row-read/giorno (>>KV).

## Approccio (1+2+3 approvato)
Storage sessioni su **D1** (durevole) + **cache edge** (caches.default) come primo livello sul path caldo → la validazione di una sessione valida NON tocca né KV né spesso D1. Retrocompatibile con le sessioni KV già emesse (fallback in lettura durante la transizione).

## Modifiche worker.js (unico file worker)

### A. Schema D1 (auto-migrate, blocco fetch L~6302)
Aggiungo:
```
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  kind  TEXT NOT NULL,        -- 'account' | 'admin'
  data  TEXT NOT NULL,        -- JSON payload (email/raw/username/...)
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
```

### B. Helper centralizzati (nuovi)
- `sessionPut(env, kind, token, payload, ttlSec)` → INSERT OR REPLACE su D1 + scrive cache edge (`caches.default`, key sintetica `https://session.internal/<kind>/<token>`, TTL=ttl).
- `sessionGet(env, kind, token)` → 1) prova cache edge (0 storage read); 2) miss → SELECT D1; se trovata ripopola cache; 3) fallback legacy: `kvGet` sulla vecchia chiave (`account_session:`/`session:`) per non invalidare sessioni emesse prima del deploy; 4) scaduta/assente → null.
- `sessionDelete(env, kind, token)` → DELETE D1 + cache.delete + (best-effort) KV delete legacy.
- Purge opportunistico degli scaduti: `DELETE FROM sessions WHERE expires_at < ?` dentro `handleScheduled` (cron già esistente 09:00).

### C. Riscrittura punti di verifica
- `verifyAccountAuth` (L4040): usa `sessionGet(env,'account',token)` invece di `kvGet(account_session:)`. Mantiene check `expiresAt`.
- `verifyAdminAuth` (L3155): mantiene il match legacy `env.ADMIN_TOKEN`; poi `sessionGet(env,'admin',token)`.

### D. Riscrittura punti di creazione (put)
- Account (4 punti: OAuth L4558, login-password L4782, verify-email L4891, license-login L5012) → `sessionPut(env,'account',token,payload,ttl)`.
- Admin (2 punti: handleAdminLogin L3004, issueAdminOAuthSession L4587) → `sessionPut(env,'admin',token,payload,ttl)`.

### E. Logout/cleanup
- Reset-password admin e ogni `delete("session:"+t)`/`delete("account_session:"+t)` → `sessionDelete`.

## Fase 3 — diagnostica consumer (parallela, non bloccante)
In `kvGet`, sul ramo "limit exceeded" loggare **anche il path della request** (via un contesto leggero) NON è banale (kvGet non ha request). Alternativa: contatore in-memory per-isolate dei prefissi di chiave più letti + log periodico. Deploy separato dopo il fix, per identificare il consumer al picco di domani mattina e tagliarlo alla fonte.

## Guardrail / Do-NOT (rispettati)
- `checkRateLimit` resta **in-memory** (non toccato).
- Nessuna credenziale in output/log.
- Deploy worker SOLO via `wrangler` OAuth (login già attivo, workers:write+kv:write verificati). NO source dell'env D1-only.
- Admin servito da Pages alias `master.adoff-site.pages.dev` (non apex) — non toccato.
- Retrocompatibilità: sessioni KV esistenti continuano a validare (fallback in lettura) finché non scadono.

## Verifica (evidence-gate)
1. `wrangler deploy` → success + nuova versione id.
2. E2E: crea sessione account via D1 (o login reale) → `GET /account/me` con X-Account-Token → 200 `{ok:true}` **anche con quota KV satura** (la read non passa più da KV).
3. Admin: login Google owner → `#token=` → `/admin/stats` 200.
4. Analytics: verificare che le read KV crollino nei giorni successivi.

## Rollback
Worker versione precedente = `def463df-...`. `wrangler rollback` o redeploy del commit attuale.
