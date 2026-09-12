# AdOff VPN — Desktop Client

Estensione desktop del servizio VPN Premium AdOff. Costruito con Tauri 2.x (Rust + web frontend).

> ⚠️ **Stato**: scaffold iniziale. Non compila ancora — richiede il backend `/vpn/*` deployato su `api.adoff.app`.

## Prerequisiti

- **Rust** ≥ 1.70 (`rustup update`)
- **Node.js** ≥ 18
- **Tauri CLI v2**: `npm install -g @tauri-apps/cli`

Su Ubuntu/Debian:
```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Tauri CLI
npm install -g @tauri-apps/cli
# Deps sistema
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

## Build

```bash
cd AdOff-desktop

# Installa dipendenze frontend
npm install

# Build produzione (genera .exe/.app)
npm run tauri build

# Output: src-tauri/target/release/bundle/
```

Per dev locale (hot-reload):
```bash
npm run tauri dev
```

## Cosa c'è

- [x] `Cargo.toml` — Tauri 2.x + reqwest + serde + tokio
- [x] `tauri.conf.json` — "AdOff VPN", 800×600, CSP rigido
- [x] `main.rs` — 4 command bridge (verify_license, get_vpn_servers, get_vpn_config, create_vpn_account)
- [x] `src/` — UI minima (logo, status circle, server list mock, connetti button)
- [x] `.env` template (ADOFF_API_BASE)

## Cosa manca

- [ ] **Backend VPN** — `POST /vpn/create`, `GET /vpn/servers`, `GET /vpn/config` devono essere implementati nel Cloudflare Worker
- [ ] **VPN engine** — WireGuard o OpenVPN wrapper (librerie Rust: `wireguard-ui`, `openvpn-dco`, o named tunnel su Windows/macOS)
- [ ] **Tray icon** + menu system tray
- [ ] **Auto-start** su boot
- [ ] **Split tunneling** (app filter)
- [ ] **Kill switch** (blocco rete se VPN cade)
- [ ] **Server reali** — mock list è placeholder; servono dati veri dal backend
- [ ] **License import** dall'estensione Chrome (shared storage o file `~/.config/adoff-vpn/licenza.json`)
- [ ] **Icons** — `src-tauri/icons/` non presente; genera con `npm run tauri icon`
- [ ] **Windows installer** (NSIS/WiX) + **macOS .app bundle**
- [ ] **Auto-update** (tauri-plugin-updater)
- [ ] **Logs su file** (tauri-plugin-log)
- [ ] **macOS entitlements** (network extension, system extension)
- [ ] **Linux AppImage/flatpak**

## Architettura

```
AdOff-desktop/
├── src/                    Frontend web (HTML/CSS/JS vanilla)
│   ├── index.html
│   ├── main.js            ← bridge Tauri invoke()
│   └── main.css
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/main.rs        ← 4 command Tauri → backend HTTP
├── .env.example
├── README.md
└── CLAUDE.md
```

## Environment

| Variabile | Default | Note |
|---|---|---|
| `ADOFF_API_BASE` | `https://api.adoff.app` | Base URL backend |
| `RUST_LOG` | `info` | Livello log Rust |

## Deploy backend necessario

Il frontend Tauri fa HTTP a `api.adoff.app`. Servono questi endpoint:

| Method | Path | Note |
|---|---|---|
| `GET` | `/api/verify-mobile-license` | Verifica token, ritorna `bearer_token` |
| `GET` | `/vpn/servers` | Lista server con load/country/premium_only |
| `GET` | `/vpn/config` | Config WireGuard per `{account_id,server_id,device_id}` |
| `POST` | `/vpn/create` | Crea account VPN, ritorna `{account_id,device_id}` |

Vedi `src-tauri/src/main.rs` per i struct `LicenseInfo`, `VpnServer`, `VpnConfig`, `VpnAccount`.
