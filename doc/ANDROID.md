# Android application

The Android wrapper bundles the web game in a WebView and works offline. Android 8.0+ and an up-to-date Android System WebView are required. The application has no INTERNET permission or JavaScript/native bridge.

## Build and test

Use Node.js 22.12+, npm, JDK 21, Android SDK Platform 36 and Build Tools 36.

```powershell
npm ci
.\Build-Android.ps1 -WithTests
.\Build-Android.ps1 -RunTests
```

`-WithTests` compiles the debug app and instrumentation APK. `-RunTests` also executes instrumentation tests on a connected device or emulator; set `ANDROID_SERIAL` when several devices are connected. A failed device test fails the command. Debug output is `artifacts/Blackjack-After-Hours-<version>-debug.apk`.

GitHub Checks runs the web tests, artwork export tests, dependency audit, Android build and Android instrumentation tests on an API 36 emulator. Signed production keys are never needed by CI.

## Signed release

For the existing installation certificate, run `./Setup-AndroidSigning.ps1` once after explicitly approving local credential storage. It secures a copy with a random password and restricts access to the current Windows user and SYSTEM. The local configuration is stored in `artifacts/signing/signing.json`; the matching backup is in `_archive/android-signing-backup`. Both are excluded from Git. Keep an additional secure off-device copy of the key and its configuration. The configuration contains a local password and must not be shared or uploaded.

Alternatively provide `BLACKJACK_KEYSTORE_PATH`, `BLACKJACK_KEYSTORE_PASSWORD`, `BLACKJACK_KEY_ALIAS` and `BLACKJACK_KEY_PASSWORD` in the process environment. Then run:

```powershell
.\Build-Android.ps1 -Release
```

The command requires explicit signing credentials and produces `artifacts/Blackjack-After-Hours-<version>.apk`. The release variant disables WebView debugging. Passwords must not be passed as command-line arguments or committed. Keep the key and its recovery credentials in secure storage with an independent backup.

Existing v1.0.0 installations use a development certificate. Preserving that exact certificate is necessary for direct updates without uninstalling. Creating a replacement key silently would break update compatibility. Ordinary builds never create or back up credentials; the separate setup script must be run explicitly. A private sideload signing setup does not constitute Google Play enrollment.

`versionName` comes from package.json; increment `versionCode` in android/app/build.gradle for each new Android release. Machine-local SDK configuration, keystores, APKs and caches are ignored by Git.

## Bundled assets and licenses

The web build is synchronized into Android assets before compilation, including LICENSE, THIRD_PARTY_NOTICES.txt and the 15-minute table soundtrack. ANDROID_DEPENDENCIES.txt records resolved native dependency coordinates. AndroidX, Kotlin and JetBrains license notices are included in the distribution notices.

## Wrapper behavior

Local assets are served by WebViewAssetLoader at https://appassets.androidplatform.net/. External requests, file/content access and mixed content are blocked. Native Back closes dialogs and the wager panel before exiting. Window insets keep controls clear of system bars. Activity pause/resume pauses and resumes the WebView; the page also pauses music while hidden.
