# AdOff Android App

Ad blocking for Android via local VPN.

## Status

**Phase 1** ✅ — DNS guide live at adoff.app/android-dns
**Phase 2** ✅ — Flutter scaffold (license, VPN API client, crypto keys)
**Phase 3** 🚧 — VPN + blocking logic (IN PROGRESS)
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
