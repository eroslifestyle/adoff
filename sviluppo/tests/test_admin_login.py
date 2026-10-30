"""
Test login admin su https://adoff.app/admin
Eseguito da Browser Automation Expert Agent
"""
from playwright.sync_api import sync_playwright
import os
import sys

SCREENSHOT_DIR = "D:/Dropbox/1 Programmazione/ChromePlugin/.claude/agent-memory/Browser Automation Expert"
SCREENSHOT_PATH = f"{SCREENSHOT_DIR}/admin_login_result.png"

def test_admin_login():
    print("[START] Test login admin adoff.app/admin")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            slow_mo=500
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            ignore_https_errors=True
        )
        page = context.new_page()

        # Step 1: Naviga su /admin
        print("[STEP 1] Navigazione su https://adoff.app/admin ...")
        try:
            page.goto("https://adoff.app/admin", timeout=30000, wait_until="domcontentloaded")
            print(f"  URL corrente: {page.url}")
            print(f"  Titolo pagina: {page.title()}")
        except Exception as e:
            print(f"  [ERROR] Navigazione fallita: {e}")
            page.screenshot(path=SCREENSHOT_PATH)
            browser.close()
            return

        # Screenshot pagina iniziale (pre-login)
        pre_login_path = SCREENSHOT_PATH.replace("result", "pre_login")
        page.screenshot(path=pre_login_path)
        print(f"  Screenshot pre-login: {pre_login_path}")

        # Step 2: Individua i campi di login
        print("[STEP 2] Ricerca campi login ...")
        page.wait_for_timeout(2000)

        # Dump contenuto pagina per debug
        content = page.content()
        print(f"  Lunghezza HTML: {len(content)} chars")

        # Cerca form di login con vari selettori
        username_selectors = [
            'input[type="text"]',
            'input[name="username"]',
            'input[name="user"]',
            'input[id="username"]',
            'input[placeholder*="username" i]',
            'input[placeholder*="utente" i]',
            'input[placeholder*="user" i]',
        ]
        password_selectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input[id="password"]',
        ]
        submit_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Accedi")',
            'button:has-text("Login")',
            'button:has-text("Entra")',
            'button:has-text("Sign in")',
        ]

        username_el = None
        password_el = None
        submit_el = None

        for sel in username_selectors:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=1000):
                    username_el = el
                    print(f"  Username field trovato: {sel}")
                    break
            except Exception:
                continue

        for sel in password_selectors:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=1000):
                    password_el = el
                    print(f"  Password field trovato: {sel}")
                    break
            except Exception:
                continue

        for sel in submit_selectors:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=1000):
                    submit_el = el
                    print(f"  Submit button trovato: {sel}")
                    break
            except Exception:
                continue

        if not username_el or not password_el:
            print("[WARN] Form di login non trovato. La pagina potrebbe non avere un form di login standard.")
            print(f"  Titolo: {page.title()}")
            print(f"  URL: {page.url}")
            # Mostra testo visibile della pagina
            try:
                body_text = page.locator("body").inner_text()
                print(f"  Testo pagina (prime 500 chars): {body_text[:500]}")
            except Exception:
                pass
            page.screenshot(path=SCREENSHOT_PATH)
            print(f"  Screenshot salvato: {SCREENSHOT_PATH}")
            browser.close()
            return

        # Step 3: Inserisci credenziali
        print("[STEP 3] Inserimento credenziali ...")
        username_el.fill("admin")
        password_el.fill("AdOff2026!")
        print("  Username: admin")
        print("  Password: [HIDDEN]")

        # Screenshot prima del click
        page.screenshot(path=SCREENSHOT_PATH.replace("result", "before_submit"))

        # Step 4: Clicca submit
        print("[STEP 4] Click su Accedi ...")
        if submit_el:
            submit_el.click()
        else:
            print("  [WARN] Submit button non trovato, uso Enter")
            password_el.press("Enter")

        # Attendi risposta
        page.wait_for_timeout(3000)

        # Step 5: Screenshot risultato
        print("[STEP 5] Screenshot risultato ...")
        page.screenshot(path=SCREENSHOT_PATH)
        print(f"  URL dopo login: {page.url}")
        print(f"  Titolo dopo login: {page.title()}")

        # Analisi risultato
        current_url = page.url
        body_text = ""
        try:
            body_text = page.locator("body").inner_text()
        except Exception:
            pass

        print("\n[RESULT ANALYSIS]")
        if "admin" in current_url.lower() and current_url != "https://adoff.app/admin":
            print("  STATUS: LOGIN RIUSCITO (URL cambiato)")
        elif any(word in body_text.lower() for word in ["dashboard", "benvenuto", "welcome", "pannello"]):
            print("  STATUS: LOGIN RIUSCITO (dashboard rilevata)")
        elif any(word in body_text.lower() for word in ["errore", "error", "invalid", "wrong", "incorrect", "sbagliato"]):
            print("  STATUS: LOGIN FALLITO (errore credenziali)")
            error_idx = max(
                body_text.lower().find("errore"),
                body_text.lower().find("error"),
                body_text.lower().find("invalid"),
            )
            if error_idx >= 0:
                print(f"  Messaggio errore: {body_text[max(0,error_idx-20):error_idx+100]}")
        else:
            print("  STATUS: INCERTO - vedere screenshot")

        print(f"  Testo pagina (prime 300 chars): {body_text[:300]}")
        print(f"\n  Screenshot salvato: {SCREENSHOT_PATH}")

        browser.close()
        print("\n[DONE] Test completato")

if __name__ == "__main__":
    test_admin_login()
