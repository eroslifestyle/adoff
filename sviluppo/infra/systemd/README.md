# systemd — AdOff OWNER MODEL

Questo è il **proprietario** (SSOT) di tutti gli unit file systemd che fanno parte di AdOff.
`/etc/systemd/system/` e `~/.config/systemd/user/` contengono solo **symlink** che puntano qui.

## Layout

```
sviluppo/infra/systemd/
├── system/                 # unit di sistema (12 file)
│   ├── adoff-admin-ui.service           # Social Admin UI :8790 (FastAPI gate IG/FB/TikTok)
│   ├── adoff-imageworker.service        # Flux gen worker (queue → sdcpp)
│   ├── adoff-imageworker.timer          # trigger every 2 min
│   ├── adoff-imgserve.service           # HTTP static :8088 (/opt/n8n/local-files)
│   ├── adoff-media-server.service       # Media server (media.adoff.app, IG/FB media_public_url)
│   ├── adoff-scraper.service            # Review scraper Playwright :8788 (ENABLED + ACTIVE)
│   ├── adoff-sdserver.service           # Stable Diffusion Flux.1-schnell :7860
│   ├── adoff-sdserver-flux2.service     # FLUX.2-klein :1237
│   ├── adoff-sdserver-qwen.service      # Qwen-Image (text-in-image) :1238
│   ├── adoff-social-dispatch.service    # Pubblica job approvati IG/FB/TikTok
│   ├── adoff-social-dispatch.timer      # trigger periodico
│   └── cloudflared-adoff-admin.service  # Tunnel social.adoff.app -> admin UI :8790
│
├── user/                   # unit user-scope (2 file)
│   ├── adoff-content-studio.service     # Suite voice/image/edit :8780 (Chatterbox)
│   └── adoff-marketing-bridge.service   # n8n marketing bridge :8792
│
├── install.sh              # Crea symlink in /etc/ e ~/.config/ + daemon-reload
├── uninstall.sh            # Rimuove symlink (lascia file qui)
└── README.md               # questo file
```

## Dipendenze esterne (path non spostabili)

| Path | Usato da | Note |
|---|---|---|
| `/home/mrxxx/adoff` (symlink → progetto) | tutti gli unit `adoff-admin-ui`, `adoff-media-server`, `adoff-social-dispatch`, `cloudflared-adoff-admin` | Convenience access path |
| `/home/mrxxx/sdcpp/image-worker.py` | `adoff-imageworker.service` | Symlinked al progetto (vedi sviluppo/ai-autopilot/sdcpp/) |
| `/home/mrxxx/sdcpp/models/` + `stable-diffusion.cpp/build/` | tutti gli `adoff-sdserver*` | Resta su `~/sdcpp` (96G modelli AI) |
| `/opt/n8n/local-files/` | `adoff-imgserve` | Resta (Docker volume mount) |
| `/var/log/adoff-*.log` | tutti i service con `StandardOutput=append:` | Hardcoded |
| `/var/lib/adoff-scraper-state.json` | `adoff-scraper` | Hardcoded |
| `/home/mrxxx/.cache/adoff-chatterbox-venv/` | user units (`content-studio`, `marketing-bridge`) | venv Python esterno |
| `~/Dropbox/.../ChromePlugin/sviluppo/ai-autopilot/n8n-workflows/.secrets/*.env` | `adoff-admin-ui`, `cloudflared-adoff-admin` | EnvironmentFile (gitignored) |

## Come installare su una nuova macchina

```bash
cd ~/Dropbox/1\ Programmazione/Progetti/ChromePlugin/sviluppo/infra/systemd
sudo ./install.sh                       # installa
sudo ./install.sh --enable-scraper      # installa + abilita scraper al boot
```

## Come disinstallare

```bash
sudo ./uninstall.sh
```

## Verifica stato

```bash
systemctl is-enabled adoff-scraper.service        # enabled
systemctl is-active adoff-scraper.service         # active
sudo systemctl cat adoff-scraper.service          # mostra contenuto via symlink
sudo systemctl show adoff-scraper.service -p FragmentPath   # /etc/systemd/system/<name> (è symlink al progetto)
```

## Nota su `enabled=linked`

Quando un unit file in `/etc/systemd/system/` è un symlink, `systemctl is-enabled` ritorna `linked` invece di `disabled`. È **equivalente funzionalmente** a `disabled` — significa "systemd vede il file ma non è auto-startato al boot". Per attivare al boot serve `sudo systemctl enable <unit>`.

## Storia

- 2026-05-28: refactor OWNER-progetto — gli unit file si sono trasferiti da `/etc/systemd/system/` (root-owned) qui. Symlink creati in `/etc/` e `~/.config/`. Backup originali in `~/.claude/backups/audit-cleanup-20260528/systemd-*`.
