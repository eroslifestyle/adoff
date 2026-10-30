#!/usr/bin/env python3
"""Test offline per _web_search() in aeo_probe.py: verifica che un errore di rete
(None) non venga MAI confuso con una ricerca riuscita ma vuota ([]).

Nessuna chiamata di rete: _ddgs_search e _searxng_search sono sempre mockate.
Eseguibile standalone: python3 test-aeo-error-vs-empty.py
"""
import os
import sys
from unittest.mock import patch

# AEO_QUERIES=1 PRIMA dell'import: limita _build_queries() a lavoro minimo
# (comunque già try/except-safe e senza rete, ma teniamo l'import deterministico).
os.environ.setdefault("AEO_QUERIES", "1")

HERE = os.path.dirname(os.path.abspath(__file__))
SEO_TOOLS_DIR = os.path.join(HERE, "..", "seo-tools")
sys.path.insert(0, os.path.abspath(SEO_TOOLS_DIR))

import aeo_probe  # noqa: E402


def check(condition, message):
    assert condition, f"FALLITO: {message}"


def with_searxng(url, fn):
    """Esegue fn() con aeo_probe.SEARXNG_URL forzato a `url`, poi ripristina."""
    with patch.object(aeo_probe, "SEARXNG_URL", url):
        fn()


def case_ddgs_has_results():
    """ddgs risponde con risultati -> ritorna la lista, senza toccare SearXNG."""
    fake_results = [{"href": "https://adoff.app", "title": "AdOff", "body": "..."}]
    with patch.object(aeo_probe, "_ddgs_search", return_value=fake_results) as mock_ddgs, \
         patch.object(aeo_probe, "_searxng_search") as mock_sx:
        out = aeo_probe._web_search("query di test")
        check(out == fake_results, f"con ddgs OK doveva tornare la lista ddgs, ha ritornato {out!r}")
        mock_sx.assert_not_called()
        mock_ddgs.assert_called_once()


def case_ddgs_error_no_searxng():
    """ddgs fallisce (None) e SearXNG non configurato -> None (errore), non []."""
    def run():
        with patch.object(aeo_probe, "_ddgs_search", return_value=None):
            out = aeo_probe._web_search("query di test")
            check(out is None, f"errore ddgs senza SearXNG doveva dare None, ha dato {out!r}")

    with_searxng("", run)


def case_ddgs_error_searxng_also_empty():
    """ddgs fallisce (None) e SearXNG configurato ma non recupera nulla -> resta None."""
    def run():
        with patch.object(aeo_probe, "_ddgs_search", return_value=None), \
             patch.object(aeo_probe, "_searxng_search", return_value=[]) as mock_sx:
            out = aeo_probe._web_search("query di test")
            check(out is None,
                  f"errore ddgs + SearXNG vuoto doveva restare None (errore), ha dato {out!r}")
            mock_sx.assert_called_once()

    with_searxng("http://127.0.0.1:8888", run)


def case_ddgs_empty_legittimo_no_searxng():
    """ddgs ritorna [] (ricerca riuscita, nessun risultato) senza SearXNG -> [] non None."""
    def run():
        with patch.object(aeo_probe, "_ddgs_search", return_value=[]):
            out = aeo_probe._web_search("query di test")
            check(out == [], f"vuoto legittimo senza SearXNG doveva dare [], ha dato {out!r}")
            check(out is not None, "vuoto legittimo non deve MAI diventare None")

    with_searxng("", run)


def case_ddgs_empty_legittimo_searxng_anche_vuoto():
    """ddgs ritorna [] (nessun errore) e SearXNG (se configurato) e' anch'esso vuoto -> [] non None."""
    def run():
        with patch.object(aeo_probe, "_ddgs_search", return_value=[]), \
             patch.object(aeo_probe, "_searxng_search", return_value=[]):
            out = aeo_probe._web_search("query di test")
            check(out == [],
                  f"vuoto legittimo ddgs + SearXNG vuoto doveva dare [] (non errore), ha dato {out!r}")

    with_searxng("http://127.0.0.1:8888", run)


def case_ddgs_error_searxng_recupera():
    """ddgs fallisce ma SearXNG risponde con dati -> ritorna i dati di SearXNG."""
    fake_sx_results = [{"href": "https://adoff.app", "title": "AdOff via SearXNG", "body": "..."}]
    query = "query salvata per searxng"

    def run():
        with patch.object(aeo_probe, "_ddgs_search", return_value=None), \
             patch.object(aeo_probe, "_searxng_search", return_value=fake_sx_results) as mock_sx:
            out = aeo_probe._web_search(query)
            check(out == fake_sx_results,
                  f"ddgs fallito + SearXNG con dati doveva tornare i dati SearXNG, ha dato {out!r}")
            mock_sx.assert_called_once_with(query, 10)

    with_searxng("http://127.0.0.1:8888", run)


def case_ddgs_vuoto_searxng_recupera():
    """ddgs vuoto (non errore) e SearXNG recupera dati -> ritorna comunque i dati SearXNG."""
    fake_sx_results = [{"href": "https://adoff.app", "title": "x", "body": "y"}]

    def run():
        with patch.object(aeo_probe, "_ddgs_search", return_value=[]), \
             patch.object(aeo_probe, "_searxng_search", return_value=fake_sx_results):
            out = aeo_probe._web_search("altra query")
            check(out == fake_sx_results,
                  f"ddgs vuoto + SearXNG con dati doveva tornare i dati SearXNG, ha dato {out!r}")

    with_searxng("http://127.0.0.1:8888", run)


def main():
    tests = [
        case_ddgs_has_results,
        case_ddgs_error_no_searxng,
        case_ddgs_error_searxng_also_empty,
        case_ddgs_empty_legittimo_no_searxng,
        case_ddgs_empty_legittimo_searxng_anche_vuoto,
        case_ddgs_error_searxng_recupera,
        case_ddgs_vuoto_searxng_recupera,
    ]
    for test in tests:
        test()
    print("PASS: errore e vuoto restano distinti")
    return 0


if __name__ == "__main__":
    sys.exit(main())
