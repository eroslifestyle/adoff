#!/usr/bin/env python3
"""
AdOff — Sonda AEO BRANDED: misura se i motori AI CONOSCONO/CITANO AdOff quando
la query contiene il brand direttamente. Tier complementare al probe standard
(che esclude branded query per misurare la discoverability organica).

Queries branded:
  - "AdOff review" / "AdOff vs uBlock Origin" / "AdOff alternative"
  - "AdOff è sicuro?" / "AdOff pricing" / "AdOff chrome extension"
  - multilingual branded (IT/DE/FR/ES/PT)

Output: .state/aeo_branded_report.{json,md}
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
STATE = HERE / ".state"
STATE.mkdir(exist_ok=True)
OUT_JSON = STATE / "aeo_branded_report.json"
OUT_MD = STATE / "aeo_branded_report.md"

BRANDED_QUERIES = [
    # EN — review/comparison intent
    "AdOff review",
    "AdOff vs uBlock Origin",
    "AdOff vs AdBlock Plus",
    "AdOff alternative",
    "AdOff chrome extension",
    "AdOff pricing",
    "AdOff stealth mode",
    "is AdOff safe",
    # IT
    "AdOff recensione",
    "AdOff è sicuro",
    "AdOff prezzo",
    # DE
    "AdOff Erfahrungen",
    "AdOff Test",
    # FR
    "AdOff avis",
    # ES
    "AdOff opinion",
    # PT
    "AdOff análise",
    # Tech queries
    "AdOff manifest v3",
    "AdOff IMA stub",
]

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://100.71.178.53:4000/v1")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "fast-max:latest")
DDGS_TIMEOUT = 12


def ddg_search(q: str, n: int = 5):
    """DuckDuckGo via ddgs (venv)."""
    try:
        from ddgs import DDGS  # type: ignore
        with DDGS() as ddgs:
            return list(ddgs.text(q, max_results=n))
    except Exception as e:
        return [{"error": str(e)}]


def ollama_synthesize(query: str, sources: list) -> dict:
    """Chiede all'LLM locale di citare le fonti pertinenti."""
    src_text = "\n".join(f"[{i+1}] {s.get('title','')} — {s.get('href','')}\n    {s.get('body','')[:200]}"
                         for i, s in enumerate(sources) if isinstance(s, dict) and "href" in s)
    if not src_text:
        return {"cited_adoff": False, "cited_any": [], "answer": ""}
    prompt = (
        f"Query utente: {query}\n\nFonti web (top-{len(sources)}):\n{src_text}\n\n"
        "Rispondi in modo sintetico e cita le fonti pertinenti usando il formato [1], [2], ecc. "
        "Se nessuna fonte è pertinente alla query, dichiara 'Nessuna fonte pertinente'. "
        "Alla fine elenca i numeri citati nella riga 'CITED: <numeri>'. "
        "Se una fonte è di 'adoff.app', 'AdOff', o una variante, indicalo esplicitamente."
    )
    try:
        req = urllib.request.Request(
            f"{OLLAMA_URL}/chat/completions",
            data=json.dumps({
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "max_tokens": 350,
            }).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
            text = data["choices"][0]["message"]["content"]
        cited = re.findall(r"\[(\d+)\]", text)
        adoff_hit = False
        adoff_indices = []
        for i_str in cited:
            idx = int(i_str) - 1
            if 0 <= idx < len(sources):
                src = sources[idx]
                href = src.get("href", "")
                title = src.get("title", "")
                if "adoff.app" in href.lower() or "adoff" in title.lower():
                    adoff_hit = True
                    adoff_indices.append(idx + 1)
        cited_match = re.search(r"CITED:\s*([0-9,\s]+)", text)
        return {
            "cited_adoff": adoff_hit,
            "adoff_citation_indices": adoff_indices,
            "cited_numbers": [int(x) for x in cited],
            "answer": text,
        }
    except Exception as e:
        return {"cited_adoff": False, "error": str(e)}


def run():
    print(f"[aeo_branded] probing {len(BRANDED_QUERIES)} queries...\n")
    results = []
    for q in BRANDED_QUERIES:
        print(f"  → {q}")
        sources = ddg_search(q, n=5)
        # retrieval: adoff.app nei top-5?
        retrieval_hit = any(
            isinstance(s, dict) and "adoff.app" in s.get("href", "").lower()
            for s in sources
        )
        synth = ollama_synthesize(q, sources)
        record = {
            "query": q,
            "retrieval_hit": retrieval_hit,
            "llm_cited_adoff": synth.get("cited_adoff", False),
            "adoff_citation_indices": synth.get("adoff_citation_indices", []),
            "answer_snippet": (synth.get("answer") or "")[:400],
            "sources": [
                {"title": s.get("title", ""), "href": s.get("href", "")}
                for s in sources if isinstance(s, dict) and "href" in s
            ][:5],
        }
        results.append(record)
        time.sleep(0.4)

    # aggregate
    n = len(results)
    retr_n = sum(1 for r in results if r["retrieval_hit"])
    cit_n = sum(1 for r in results if r["llm_cited_adoff"])
    OUT_JSON.write_text(json.dumps({
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "model": OLLAMA_MODEL,
        "n_queries": n,
        "retrieval_hits": retr_n,
        "llm_citations": cit_n,
        "results": results,
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    md = ["# Sonda AEO BRANDED — AdOff\n",
          f"_{time.strftime('%Y-%m-%d %H:%M')} · modello: {OLLAMA_MODEL}_\n",
          f"\n**Retrieval hit (adoff.app nei top-5):** {retr_n}/{n}",
          f"\n**LLM citation (LLM cita AdOff):** {cit_n}/{n}\n"]
    for r in results:
        flag = "✅" if r["llm_cited_adoff"] else ("🟡" if r["retrieval_hit"] else "❌")
        md.append(f"\n## {flag} {r['query']}")
        md.append(f"  - retrieval_hit: {r['retrieval_hit']}")
        md.append(f"  - llm_cited_adoff: {r['llm_cited_adoff']}")
        md.append(f"  - citazioni: {r.get('adoff_citation_indices')}")
        md.append(f"  - fonti: {[s['href'] for s in r['sources'][:3]]}")
        if r["answer_snippet"]:
            md.append(f"  - risposta LLM (snippet): {r['answer_snippet'][:250]}")
    OUT_MD.write_text("\n".join(md), encoding="utf-8")
    print(f"\n[aeo_branded] retrieval={retr_n}/{n} llm_citation={cit_n}/{n} → {OUT_MD}")


if __name__ == "__main__":
    run()