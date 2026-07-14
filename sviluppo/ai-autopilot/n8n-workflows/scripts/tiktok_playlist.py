#!/usr/bin/env python3
"""
AdOff — Assegnazione TikTok playlist per lingua (Playwright, post-publish).

L'API ufficiale TikTok Content Posting (verifica 2026-05-19 sui doc developers.tiktok.com
+ changelog) NON espone alcun parametro playlist/folder/collection/series. L'unica via
fattibile resta automatizzare TikTok Studio Web sulla sessione autenticata del brand.

Modalità:
  bootstrap   → apre Chromium HEADED, l'utente fa login manuale a TikTok Studio (una volta).
                Sessione salvata in persistent_context dir (cookie + localStorage durevoli).
  assign      → apre Chromium HEADLESS con la sessione, trova il video <pid>, lo aggiunge
                alla playlist LANG_NAMES[lang], creandola se non esiste.

CLI:
  python tiktok_playlist.py bootstrap
  python tiktok_playlist.py assign <pid> <lang>

Chiamato da social_publish.py dopo PUBLISH_COMPLETE TikTok, con timeout di sicurezza.

NB selettori: TikTok Studio Web cambia layout senza preavviso. Il modulo prova più
fallback testuali (ARIA role + text). Se rompe, eseguire `bootstrap` con --debug per
tarare i selettori usando page.pause() in modalità ispezione.
"""
from __future__ import annotations
import os
import sys
import time
from pathlib import Path

# ============================================================
#  Configurazione
# ============================================================

HERE = Path(__file__).resolve().parent
# Persistent profile: cookies + localStorage TikTok Studio (post-login)
PROFILE_DIR = Path(
    os.environ.get(
        "TIKTOK_STUDIO_PROFILE",
        str(Path.home() / ".cache/adoff-playwright-venv/tt_profile"),
    )
)
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

STUDIO_POSTS_URL = os.environ.get(
    "TIKTOK_STUDIO_URL", "https://www.tiktok.com/tiktokstudio/content"
)

# Nome playlist per lingua (nativo, così l'audience lo legge nella propria lingua).
LANG_NAMES = {
    "it": "Italiano",
    "en": "English",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "pt": "Português",
    "ru": "Русский",
    "ar": "العربية",
    "zh": "中文",
    "tr": "Türkçe",
    "id": "Bahasa Indonesia",
    "pl": "Polski",
    "hi": "हिन्दी",
    "ja": "日本語",
    "ko": "한국어",
}

# Timeout (ms) — pessimisti, TikTok è lento.
T_NAV = 45_000
T_EL = 15_000


# ============================================================
#  Helpers
# ============================================================

def _log(msg: str) -> None:
    print(f"[tiktok-playlist] {msg}", flush=True)


def _launch(headless: bool):
    """Avvia Chromium con persistent context (la sessione resta dopo bootstrap)."""
    from playwright.sync_api import sync_playwright

    p = sync_playwright().start()
    # User-agent realistico desktop; lingua brand IT/EN va bene (la UI Studio è EN/auto).
    ctx = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=headless,
        viewport={"width": 1366, "height": 900},
        locale="en-US",
        user_agent=(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        args=["--disable-blink-features=AutomationControlled"],
    )
    page = ctx.new_page()
    return p, ctx, page


def _open_post_menu(page, pid: str) -> bool:
    """
    Trova nella pagina Posts il video con id `pid` e apre il suo menu "More" (⋯).
    Strategia: il link al video contiene /video/<pid>. Risaliamo al contenitore-riga
    e cerchiamo un bottone con aria-label "More" / "Actions" / icon-only.
    """
    link = page.locator(f"a[href*='/video/{pid}']").first
    try:
        link.wait_for(state="visible", timeout=T_EL)
    except Exception:
        return False
    # Risale al container riga (4 livelli sono solitamente sufficienti).
    row = link.locator("xpath=ancestor::*[self::div or self::tr][1]")
    for sel in [
        "button[aria-label*='More' i]",
        "button[aria-label*='Action' i]",
        "button[aria-haspopup='menu']",
        "button:has(svg)",
    ]:
        btn = row.locator(sel).last
        if btn.count() > 0:
            try:
                btn.scroll_into_view_if_needed(timeout=2000)
                btn.click(timeout=3000)
                return True
            except Exception:
                continue
    return False


def _click_menu_item(page, *texts: str) -> bool:
    """Clicca la prima voce di menu il cui testo contiene una delle stringhe."""
    for t in texts:
        item = page.get_by_role("menuitem", name=lambda n, t=t: t.lower() in (n or "").lower())
        if item.count() > 0:
            try:
                item.first.click(timeout=3000)
                return True
            except Exception:
                pass
        # Fallback testuale
        loc = page.locator(f"text=/{t}/i").first
        try:
            loc.click(timeout=2500)
            return True
        except Exception:
            continue
    return False


def _pick_or_create_playlist(page, name: str) -> bool:
    """
    Nel pannello "Add to playlist": cerca la playlist `name`. Se non esiste, clicca
    "Create playlist" / "New playlist", digita il nome, conferma. Poi seleziona e salva.
    """
    # Prima: cerca playlist esistente.
    existing = page.locator(f"text=/^{name}$/i").first
    try:
        existing.scroll_into_view_if_needed(timeout=2000)
        existing.click(timeout=2500)
    except Exception:
        # Non esiste: creala.
        if not _click_menu_item(page, "Create playlist", "New playlist", "Create"):
            _log("CREATE button not found")
            return False
        # Trova input nome (placeholder/aria-label "name"/"title").
        inp = None
        for sel in [
            "input[placeholder*='name' i]",
            "input[placeholder*='title' i]",
            "input[aria-label*='name' i]",
            "input[type='text']",
        ]:
            cand = page.locator(sel).last
            if cand.count() > 0:
                inp = cand
                break
        if inp is None:
            _log("CREATE name input not found")
            return False
        inp.fill(name, timeout=3000)
        # Conferma creazione
        for txt in ("Confirm", "Create", "Save", "Done"):
            if _click_menu_item(page, txt):
                break
        # Dopo create, la playlist appena creata di solito è già selezionata.
    # Salva la scelta
    for txt in ("Save", "Done", "Confirm", "Apply"):
        if _click_menu_item(page, txt):
            return True
    return False


# ============================================================
#  API pubblica
# ============================================================

def assign(pid: str, lang: str, debug: bool = False) -> bool:
    """
    Assegna il video <pid> alla playlist nativa per <lang>.
    Ritorna True se l'operazione UI è andata a buon fine.
    """
    name = LANG_NAMES.get(lang)
    if not name:
        _log(f"SKIP: lang '{lang}' non in LANG_NAMES")
        return False

    p, ctx, page = _launch(headless=not debug)
    ok = False
    try:
        page.goto(STUDIO_POSTS_URL, timeout=T_NAV, wait_until="domcontentloaded")
        # Sessione scaduta? Se vede form di login, abort.
        if page.locator("input[name='username']").count() > 0 or "login" in page.url:
            _log("LOGIN scaduto: rilanciare bootstrap")
            return False

        if not _open_post_menu(page, pid):
            _log(f"video pid={pid} non trovato nella Posts page")
            return False
        if not _click_menu_item(page, "Add to playlist", "Playlist"):
            _log("voce 'Add to playlist' non trovata")
            return False
        ok = _pick_or_create_playlist(page, name)
        _log(f"assign pid={pid} → '{name}' : {'OK' if ok else 'FAIL'}")
    except Exception as e:
        _log(f"assign error: {e!r}")
    finally:
        try:
            ctx.close()
        finally:
            p.stop()
    return ok


def bootstrap(debug: bool = False) -> int:
    """Apre Chromium HEADED per login manuale. Sessione resta salvata in PROFILE_DIR."""
    p, ctx, page = _launch(headless=False)
    try:
        page.goto(STUDIO_POSTS_URL, timeout=T_NAV, wait_until="domcontentloaded")
        _log("HEADED browser aperto. Fai login a TikTok Studio nella finestra.")
        _log("Quando vedi la lista dei tuoi POST, premi INVIO qui per chiudere.")
        if debug:
            page.pause()
        else:
            input("[INVIO per chiudere dopo aver completato il login]")
        # Verifica
        if "login" in page.url:
            _log("Sembra che il login non sia completato. Riprova bootstrap.")
            return 1
        _log(f"OK — sessione salvata in: {PROFILE_DIR}")
        return 0
    finally:
        try:
            ctx.close()
        finally:
            p.stop()


# ============================================================
#  CLI
# ============================================================

def _main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    cmd = argv[1]
    debug = "--debug" in argv
    if cmd == "bootstrap":
        return bootstrap(debug=debug)
    if cmd == "assign":
        if len(argv) < 4:
            print("uso: tiktok_playlist.py assign <pid> <lang>", file=sys.stderr)
            return 2
        pid, lang = argv[2], argv[3]
        return 0 if assign(pid, lang, debug=debug) else 1
    print(f"comando ignoto: {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(_main(sys.argv))
