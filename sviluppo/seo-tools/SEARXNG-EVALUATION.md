# Valutazione SearXNG self-host per la sonda AEO — decisione 2026-06-08

## Contesto
La sonda AEO settimanale (`aeo_probe.py`, backend `local`) usa **ddgs** (metasearch DuckDuckGo, keyless) per il retrieval web, poi un LLM locale (Ollama `fast-max`) sceglie quali domini citerebbe. Rischio noto (checkpoint): **ddgs può essere rate-limited** su IP cloud / con volume crescente → retrieval vuoto → sonda cieca.

## Domanda
Conviene self-hostare **SearXNG** come motore di retrieval per la sonda AEO?

## Analisi

| Criterio | ddgs (attuale) | SearXNG self-host |
|---|---|---|
| Costo | 0 | 0 (gira su leobox, già always-on) |
| Chiavi API | nessuna | nessuna |
| Rate-limit | **sì** (DuckDuckGo blocca IP con troppe query) | mitigato: aggrega più motori, rotazione, cache locale |
| Affidabilità | media (dipende da 1 fonte) | alta (≥1 motore tra Google/Bing/Brave/DDG/Mojeek) |
| Manutenzione | nulla | bassa (1 container Docker, aggiornamenti saltuari) |
| Qualità risultati | buona | uguale o migliore (multi-engine) |
| Setup | già fatto | ~15 min (docker compose) |

**Volume attuale**: 4 query/settimana → ddgs regge oggi. Il rischio si materializza solo se (a) aumentano le query (più keyword target / più lingue), o (b) DuckDuckGo stringe le maglie.

## Decisione (graduata, costo-zero)
**NON self-hostare ORA, ma rendere il fallback PRONTO a costo zero** — implementato in `aeo_probe.py`:
- Backend `local` ora fa **fallback automatico a SearXNG** quando ddgs torna vuoto, SE `SEARXNG_URL` è settato (env). Finché non lo si setta, comportamento invariato (solo ddgs).
- Backend esplicito `AEO_BACKEND=searxng` per forzare SearXNG.
- Schema risultati SearXNG normalizzato a `{href,title,body}` (identico a ddgs) → stesso LLM-pick, zero altre modifiche.

**Trigger per attivare SearXNG** (uno qualsiasi → 15 min di setup su leobox):
1. La sonda registra ≥2 settimane con retrieval vuoto / 0 citazioni anomale (segno di rate-limit).
2. Si superano ~30 query/settimana (più keyword o più mercati).
3. Si vuole misurare l'AEO su motori specifici (Brave/Google) non coperti da ddgs.

## Setup SearXNG quando servirà (leobox)
```bash
# docker compose minimale, JSON API abilitata
docker run -d --name searxng -p 8888:8080 \
  -e SEARXNG_SETTINGS__SEARCH__FORMATS='[html,json]' \
  searxng/searxng:latest
# poi nei secrets / env del cron AEO:
export SEARXNG_URL=http://127.0.0.1:8888
```
Verifica: `curl "http://127.0.0.1:8888/search?q=test&format=json" | head`.
Nota: abilitare `json` in `formats` (di default solo `html`), altrimenti l'API torna 403.

## Stato
- Codice fallback: **PRONTO e testato (sintassi/import)** in `aeo_probe.py`.
- Infra SearXNG: **non installata** (attesa trigger). Costo di attivazione futura ≈ 15 min, 0 €.
