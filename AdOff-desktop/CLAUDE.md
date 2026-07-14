# CLAUDE.md — AdOff VPN Desktop

## Stack

**Tauri 2.x** (Rust backend + web frontend). Non è Electron — usa WebView2 (Windows), WKWebView (macOS), WebKitGTK (Linux). Binario standalone ~5-15 MB vs ~150 MB Electron.

## Regole ereditate dal progetto ChromePlugin

- **Niente secrets hardcoded** — token/license in `localStorage` o `~/.config/adoff-vpn/`
- **Version congruence** — versione SOLO in `tauri.conf.json`, mai altrove
- **Privacy**: mai esporre dati personali nel codice/UI (nome, email, IP reale)
- **Deploy rule**: ogni modifica → commit + push immediato
- **Brand**: color primary `#7252f8`, sphere logo SVG inline

## File critici

| File | Rischio se toccato |
|---|---|
| `src-tauri/src/main.rs` | Bridge API — romperlo = UI offline |
| `src-tauri/tauri.conf.json` | CSP e window size — CSP troppo largo = XSS |
| `src/main.js` | UI state — sincronizzato con `state` object |

## Backend contract

I 4 command Tauri fanno HTTP al backend. I struct Rust (`LicenseInfo`, `VpnServer`, `VpnConfig`, `VpnAccount`) sono la **source of truth** per i campi attesi. Se il backend cambia risposta → aggiorna struct + frontend parsing.

## Todo prioritario

1. **Deploy backend `/vpn/*`** su Cloudflare Workers (referenza: `sviluppo/license-system/`)
2. **VPN engine**: WireGuard native su Windows/macOS/Linux (wireguard-nt / `wireguard-rs`)
3. **Icons**: `npm run tauri icon` genera `src-tauri/icons/` da un PNG 1024×1024
4. **Tray/system**: `tauri-plugin-system-tray` + menu contestuale

## Comandi utili

```bash
npm run tauri dev      # dev con hot-reload
npm run tauri build    # production build
cargo check            # verifica Rust senza build
cargo clippy           # linter Rust
```

## Link progetto principale

Estensione browser: `../app/` (Chrome/Edge/Opera/Firefox/Safari)
Worker licenze: `../sviluppo/license-system/`
