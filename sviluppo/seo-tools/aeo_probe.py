#!/usr/bin/env python3
"""
AdOff — Sonda AEO: misura se adoff.app verrebbe CITATO dai motori AI per le query
target. Trend settimanale dell'"Answer Engine Optimization".

INSIGHT: il collo di bottiglia non è mai stato l'LLM, ma l'accesso al WEB. Quindi
si replica una mini-Perplexity LOCALE: retrieval web gratuito + LLM locale che
sintetizza e sceglie le fonti. Zero API a pagamento, zero key.

Backend (env AEO_BACKEND, default 'local'):
  local      → ddgs (DuckDuckGo metasearch, keyless) + Ollama leobox. Se SEARXNG_URL è
               settato, fa FALLBACK automatico a SearXNG quando ddgs torna vuoto (rate-limit
               DuckDuckGo su IP cloud). Misura 2 segnali per query:
                 • retrieval_hit : adoff.app è tra i risultati web top-N (discoverability)
                 • llm_cited     : l'LLM locale, dati i risultati, sceglie di citare adoff.app (AEO)
  searxng    → forza retrieval via istanza SearXNG self-host (env SEARXNG_URL) + Ollama
  perplexity → Perplexity API (se PERPLEXITY_API_KEY) — web-grounded, citazioni native
  claude     → `claude -p --allowedTools WebSearch` (usa la subscription Claude Code)

Output: .state/aeo_report.{json,md}.
Dipendenza locale: ddgs nel venv sviluppo/seo-tools/.venv (auto re-exec sotto).
Uso: source ~/.secrets/adoff-stores.env && python3 aeo_probe.py
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))

# --- auto re-exec sotto il venv se ddgs non è importabile (cron usa python3 nudo) ---
def _ensure_venv():
    try:
        import ddgs  # noqa
        return
    except Exception:
        venv_py = os.path.join(HERE, ".venv", "bin", "python")
        # sentinel per evitare loop infinito (venv/bin/python ha lo stesso realpath del system python)
        if os.path.exists(venv_py) and not os.environ.get("AEO_VENV_REEXEC"):
            os.environ["AEO_VENV_REEXEC"] = "1"
            os.execv(venv_py, [venv_py] + sys.argv)


STATE = os.path.join(HERE, ".state")
OUT_JSON = os.path.join(STATE, "aeo_report.json")
OUT_MD = os.path.join(STATE, "aeo_report.md")
DOMAIN = "adoff.app"
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "127.0.0.1:11434").replace("http://", "").rstrip("/")
OLLAMA_MODEL = os.environ.get("AEO_OLLAMA_MODEL", "fast-max:latest")
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/home/mrxxx/.local/bin/claude")

# Query di fallback (usate se GSC/keyword research non danno abbastanza segnale).
DEFAULT_QUERIES = [
    "best invisible ad blocker that bypasses anti-adblock 2026",
    "best free undetectable ad blocker for Chrome",
    "how to block video ads without being detected",
    "miglior ad blocker invisibile contro l'anti-adblock",
]


# Token che rendono una query "AEO-rilevante" (intento ad-blocker, multilingua).
_REL_TOKENS = ("block", "adblock", "ad blocker", "ads", "pubblicit", "anunci", "anúnci",
               "werbung", "annonce", "реклам", "광고", "広告", "广告", "إعلان")
_BRAND_NOISE = {"adoff", "ads off", "ad off", "add off", "adof", "ad-off"}


def _relevant(q):
    ql = q.lower()
    return len(q.split()) >= 2 and any(t in ql for t in _REL_TOKENS) and ql not in _BRAND_NOISE


def _build_queries(n=6):
    """Query AEO derivate dai DATI REALI invece che hardcoded: le opportunity GSC ad alto
    intento + le gap keyword PERTINENTI (multi-parola, a tema ad-blocker; la lista gap grezza
    è rumorosa, quindi filtra). Tiene sempre ≥2 default tematiche per stabilità. Fallback
    completo alle DEFAULT se i dati non bastano. Misura la citabilità sulle query che contano."""
    picked = []
    try:
        snap = json.load(open(os.path.join(STATE, "gsc_snapshot.json"))).get("snapshot") or {}
        opp = sorted(snap.get("opportunities", []), key=lambda r: -r.get("impressions", 0))
        for r in opp:
            q = (r.get("key") or "").strip()
            if q and _relevant(q) and q not in picked:
                picked.append(q)
            if len(picked) >= 2:
                break
    except Exception:
        pass
    try:
        kw = json.load(open(os.path.join(STATE, "keyword_report.json")))
        # gap pertinenti e ricche (≥3 parole = intento chiaro), saltando il rumore alfabetico
        for g in sorted(kw.get("gaps", []), key=lambda s: -len(s.split())):
            g = (g or "").strip()
            if g and len(g.split()) >= 3 and _relevant(g) and g not in picked:
                picked.append(g)
            if len(picked) >= n - 2:    # lascia spazio ad almeno 2 default
                break
    except Exception:
        pass
    # completa/garantisce le default tematiche (sempre ≥2, fino a n)
    for d in DEFAULT_QUERIES:
        if len(picked) >= n:
            break
        if d not in picked:
            picked.append(d)
    return picked[:n] or DEFAULT_QUERIES


QUERIES = _build_queries()


SEARXNG_URL = os.environ.get("SEARXNG_URL", "").rstrip("/")  # es. http://127.0.0.1:8888


# ---------- Backend LOCALE (ddgs + Ollama), con fallback SearXNG ----------
def _ddgs_search(query, n=10):
    from ddgs import DDGS
    try:
        return DDGS().text(query, max_results=n) or []
    except Exception:
        return []


def _searxng_search(query, n=10):
    """Retrieval via istanza SearXNG self-host (JSON API). Schema risultati normalizzato
    a {href,title,body} come ddgs. Attivo se SEARXNG_URL è settato; usato come fallback
    automatico quando ddgs torna vuoto (rate-limit DuckDuckGo su IP cloud)."""
    if not SEARXNG_URL:
        return []
    qs = urllib.parse.urlencode({"q": query, "format": "json", "language": "en", "safesearch": "0"})
    req = urllib.request.Request(f"{SEARXNG_URL}/search?{qs}",
                                 headers={"User-Agent": "adoff-aeo-probe/1.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8", "replace"))
        out = []
        for it in (data.get("results") or [])[:n]:
            out.append({"href": it.get("url", ""), "title": it.get("title", ""),
                        "body": it.get("content", "")})
        return out
    except Exception:
        return []


def _web_search(query, n=10):
    """ddgs prima; se vuoto (verosimile rate-limit) e SearXNG è configurato → fallback."""
    res = _ddgs_search(query, n)
    if not res and SEARXNG_URL:
        res = _searxng_search(query, n)
    return res


def _ollama_pick(query, results):
    """Dati i risultati web, l'LLM locale sceglie quali domini citerebbe."""
    ctx = "\n".join(f"- {r.get('title','')} ({r.get('href','')}): {r.get('body','')[:160]}"
                    for r in results[:10])
    prompt = (
        f"Query utente: {query}\n\nRisultati web:\n{ctx}\n\n"
        "Agisci come un motore di risposta AI: per rispondere alla query, quali "
        "domini (tra i risultati) citeresti come fonti? Rispondi SOLO JSON: "
        '{"cite_domains":["dom1","dom2","dom3"]}'
    )
    body = json.dumps({"model": OLLAMA_MODEL, "messages": [{"role": "user", "content": prompt}],
                       "stream": False, "format": "json", "options": {"temperature": 0.2}}).encode()
    try:
        req = urllib.request.Request(f"http://{OLLAMA_HOST}/api/chat", data=body,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.loads(r.read().decode("utf-8", "replace"))
        content = (out.get("message") or {}).get("content", "{}")
        doms = json.loads(content).get("cite_domains", [])
        return [d.lower() for d in doms if isinstance(d, str)]
    except Exception:
        return []


def probe_local(searcher=None, label=None):
    searcher = searcher or _web_search
    results_out, cited = [], 0
    for q in QUERIES:
        res = searcher(q)
        retrieval_hit = any(DOMAIN in (r.get("href", "") + r.get("body", "")).lower() for r in res)
        picks = _ollama_pick(q, res) if res else []
        llm_cited = any(DOMAIN in d for d in picks)
        hit = retrieval_hit or llm_cited
        cited += hit
        results_out.append({"q": q, "cited": hit, "retrieval_hit": retrieval_hit,
                            "llm_cited": llm_cited,
                            "citations": [r.get("href", "") for r in res
                                          if DOMAIN in r.get("href", "")][:2] or picks[:3]})
        time.sleep(0.5)
    engine = label or ("ddgs→searxng" if SEARXNG_URL else "ddgs")
    return results_out, cited, f"local ({engine}+{OLLAMA_MODEL})"


# ---------- Backend Perplexity ----------
def probe_perplexity(key):
    api = "https://api.perplexity.ai/chat/completions"
    model = os.environ.get("AEO_MODEL", "sonar")
    results, cited = [], 0
    for q in QUERIES:
        try:
            body = json.dumps({"model": model, "messages": [{"role": "user", "content": q}],
                               "temperature": 0.2}).encode()
            req = urllib.request.Request(api, data=body, headers={
                "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.loads(r.read().decode("utf-8", "replace"))
            msg = (d.get("choices") or [{}])[0].get("message", {}).get("content", "")
            cites = [c for c in (d.get("citations") or []) if isinstance(c, str)]
            hit = DOMAIN in msg.lower() or any(DOMAIN in c.lower() for c in cites)
            cited += hit
            results.append({"q": q, "cited": hit, "citations": cites[:5]})
            time.sleep(1)
        except Exception as e:
            results.append({"q": q, "error": str(e)[:120]})
    return results, cited, "perplexity:" + model


# ---------- Backend Claude Code (subscription) ----------
def probe_claude():
    qlist = "\n".join(f"{i+1}. {q}" for i, q in enumerate(QUERIES))
    prompt = (f"Sei un misuratore AEO. Per OGNI query, cerca sul web e determina se "
              f"il dominio {DOMAIN} compare nella risposta o nelle fonti.\n\n{qlist}\n\n"
              'Rispondi SOLO array JSON: [{"q":"...","cited":true|false,"sources":["dom"]}]')
    try:
        out = subprocess.run([CLAUDE_BIN, "-p", "--allowedTools", "WebSearch",
                              "--output-format", "json"], input=prompt,
                             capture_output=True, text=True, timeout=600)
        d = json.loads(out.stdout)
        m = re.search(r"\[.*\]", d.get("result", ""), re.S)
        arr = json.loads(m.group(0)) if m else []
        results, cited = [], 0
        for it in arr:
            hit = bool(it.get("cited")); cited += hit
            results.append({"q": it.get("q", ""), "cited": hit, "citations": it.get("sources", [])[:5]})
        return results, cited, f"claude-websearch (${d.get('total_cost_usd')})"
    except Exception as e:
        return None, 0, f"claude error: {str(e)[:160]}"


def write(results, cited, backend):
    n = len(QUERIES)
    json.dump({"configured": True, "ts": int(time.time()), "backend": backend,
               "citedCount": cited, "total": n, "results": results},
              open(OUT_JSON, "w"), ensure_ascii=False, indent=2)
    lines = [f"# Sonda AEO — adoff.app citato in {cited}/{n} query  ({backend})", ""]
    for r in results:
        mark = "✅" if r.get("cited") else ("⚠️" if "error" in r else "❌")
        extra = ""
        if "retrieval_hit" in r:
            extra = f"  [web:{'sì' if r['retrieval_hit'] else 'no'} · LLM:{'sì' if r['llm_cited'] else 'no'}]"
        lines.append(f"{mark} {r['q']}{extra}")
        if r.get("citations"):
            lines.append("   fonti: " + ", ".join(str(c) for c in r["citations"][:3]))
    open(OUT_MD, "w", encoding="utf-8").write("\n".join(lines))
    print(f"[aeo_probe] adoff.app citato in {cited}/{n} ({backend}) → {OUT_MD}")


def main():
    backend = os.environ.get("AEO_BACKEND", "local")
    if backend == "perplexity" and os.environ.get("PERPLEXITY_API_KEY"):
        res, cited, name = probe_perplexity(os.environ["PERPLEXITY_API_KEY"])
    elif backend == "claude":
        res, cited, name = probe_claude()
    elif backend == "searxng":
        res, cited, name = probe_local(searcher=_searxng_search, label="searxng")
    else:
        res, cited, name = probe_local()
    if res is None:
        open(OUT_MD, "w").write(f"# Sonda AEO — errore\n\n{name}\n")
        print(f"[aeo_probe] {name}")
        return
    write(res, cited, name)


if __name__ == "__main__":
    _ensure_venv()
    main()
