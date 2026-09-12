# AdOff Android App

Android app: UI e struttura del progetto presenti; la protezione VPN NON è ancora funzionante (packet forwarding non implementato) — **rimossa dal build**: il `<service>` VpnService NON è più dichiarato nel manifest (non avviabile nemmeno via adb/intent), i permessi FOREGROUND_SERVICE sono commentati e il MethodChannel ritorna "UNAVAILABLE". Il sorgente `VpnService.kt` resta nel repo come base per lo sviluppo futuro (vedi flag `VPN_FEATURE_SHIPPABLE`).

## Status

**Phase 1** ✅ — DNS guide live at adoff.app/android-dns
**Phase 2** ✅ — Flutter scaffold (license, VPN API client, crypto keys)
**Phase 3** 🚧 — VPN + blocking logic (IN PROGRESS — VPN removed from build: service not declared in manifest, packet forwarding not implemented, echo-loop risk; source kept for future work)
**Phase 4** ⬜ — Build + test
**Phase 5** ⬜ — Publish (F-Droid + APK)
**Phase 6** ⬜ — Metrics + monitoring

## Requirements

- Flutter 3.x
- Android SDK 34+
- JDK 17+

## Setup

```bash
flutter pub get
flutter run
```

## Architecture

- `lib/main.dart` — App entry point
- `lib/screens/` — UI screens (onboarding, home, settings)
- `lib/services/` — Business logic (license, vpn)
- `lib/theme/` — AdOff theme (dark, purple)
- `android/app/src/main/kotlin/app/adoff/VpnService.kt` — Native VPN service

## License

Same Pro subscription as AdOff browser extension.
