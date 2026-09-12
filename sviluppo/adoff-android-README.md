# AdOff for Android

<p align="center">
  <img src="https://adoff.app/assets/icon128.png" width="128" alt="AdOff" />
</p>

<p align="center">
  <strong>Ads? Off!</strong> — Block ads and trackers on your Android phone via a local VPN.<br />
  No external servers. No VPN slot conflict. 30-day free trial.
</p>

<p align="center">
  <a href="https://github.com/eroslifestyle/adoff">Browser Extension</a> ·
  <a href="https://adoff.app/android">Website</a> ·
  <a href="https://adoff.app/android-dns">DNS Setup Guide</a> ·
  <a href="https://t.me/adoffapp">Telegram</a>
</p>

---

## What is AdOff?

AdOff is an open-source ad blocker for Android. It uses Android's **VpnService API** to intercept DNS queries locally and block ad/tracker domains before they load — system-wide, in every app.

Unlike proxy-based VPNs, AdOff is a **local VPN**: your traffic never leaves your device. There's no external server, no logging, and no conflict with your existing VPN apps.

**AdOff is the Android companion to the [AdOff browser extension](https://github.com/eroslifestyle/adoff)** — one Pro license covers both.

## Features

- **DNS-level blocking** — intercepts and blocks DNS queries to ad/tracker domains
- **200+ domains blocked** — blocklist updated regularly
- **Real-time stats** — see exactly how many ads and trackers have been blocked
- **Local VPN** — no external server, no VPN slot conflict
- **Open source** — audit the code, contribute, or fork
- **30-day free trial** — no credit card required

## Requirements

- Android 10 or later
- Unknown app installation enabled (Settings → Apps → Special access → Install unknown apps)

## Installation

### APK (recommended)

1. Enable "Install unknown apps" in Android settings
2. Download `adoff-android.apk` from [adoff.app/android](https://adoff.app/android)
3. Open the downloaded file and tap **Install**
4. On first launch, grant VPN permission when prompted

### F-Droid

AdOff will be published on F-Droid once the review is complete. Track progress at [gitlab.com/fdroid/fdroiddata](https://gitlab.com/fdroid/fdroiddata).

## How it works

AdOff creates a local VPN tunnel on your device. When any app requests an ad or tracker domain, AdOff returns `NXDOMAIN` — the ad simply doesn't exist. All filtering happens on-device.

```
App → DNS query for "ads.example.com" → AdOff VPN (local)
                                              ↓
                                    Check blocklist (200+ domains)
                                              ↓
                          Blocked → returns NXDOMAIN  |  Allowed → forwards to 1.1.1.1
```

## Limitations

- **Video ads**: DNS blocking covers most display ads and trackers. Some video ad platforms use first-party domains that may be harder to block at the DNS level.
- **HTTPS MITM**: not implemented in the MVP. AdOff focuses on DNS-level blocking, which covers the majority of ads without the privacy implications of decrypting HTTPS traffic.

## Pro Features

The free tier includes DNS-level ad blocking. **AdOff Pro** unlocks:

- Full VPN blocking with enhanced tracker protection
- Extended blocklist (500+ domains)
- Advanced filtering rules
- Priority support

Your AdOff Pro license from the browser extension also works on Android.

## Privacy

AdOff does **not** collect, log, or transmit your browsing data. The VPN is purely local — all DNS queries are processed on your device. See our [Privacy Policy](https://adoff.app/privacy) for full details.

## Building from source

```bash
# Clone the repository
git clone https://github.com/eroslifestyle/adoff-android
cd adoff-android

# Get dependencies
flutter pub get

# Run on a connected device or emulator
flutter run

# Build a release APK
flutter build apk --release
```

### Signing the APK

Release APKs must be signed. Generate a keystore:

```bash
keytool -genkey -v -keystore adoff-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias adoff
```

Configure signing in `android/app/build.gradle.kts`:

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("adoff-release.jks")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = "adoff"
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

## Project structure

```
lib/
├── main.dart                 # Entry point, routing
├── screens/
│   ├── onboarding_screen.dart # 5-step onboarding (VPN, DNS, privacy, trial)
│   ├── home_screen.dart      # VPN toggle, real-time blocked counter
│   └── settings_screen.dart  # VPN/DNS mode, MITM toggle
├── services/
│   ├── vpn_service.dart      # MethodChannel bridge → Android VpnService
│   └── license_service.dart  # Trial management, Pro license verification
└── theme/
    └── adoff_theme.dart      # Material theme (purple/white)
android/
└── app/src/main/
    ├── AndroidManifest.xml   # VpnService + INTERNET + FOREGROUND_SERVICE permissions
    └── kotlin/app/adoff/
        ├── MainActivity.kt   # MethodChannel handler
        └── VpnService.kt    # DNS interceptor (IPv4/UDP, blocklist matching, NXDOMAIN)
assets/
└── blocklist.txt            # 200+ ad/tracker domains (adservers, trackers, IMA SDK)
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## Related projects

| Project | Description |
|---------|-------------|
| [adoff](https://github.com/eroslifestyle/adoff) | Browser extension (Chrome, Firefox, Safari, Edge) |
| [adoff-site](https://github.com/eroslifestyle/adoff-site) | Website and landing pages |

## License

[FSL-1.1-Apache-2.0](LICENSE) — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <a href="https://adoff.app">adoff.app</a> ·
  <a href="https://t.me/adoffapp">Telegram</a> ·
  <a href="https://github.com/eroslifestyle">GitHub</a>
</p>
