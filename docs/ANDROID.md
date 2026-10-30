# Android application

The `android/` project packages the existing game in an Android hardware-accelerated WebView. Game assets are bundled and work offline, with no INTERNET permission, analytics, remote scripts, or JavaScript/native bridge. Android 8.0+ (API 26) and an up-to-date Android System WebView are required. The build targets API 36.

Local assets use `WebViewAssetLoader` on `https://appassets.androidplatform.net/`, mounted at the origin root so game artwork and CSS paths resolve consistently. File/content access and mixed content are disabled; unmatched requests are blocked. The native root consumes system-bar/display-cutout insets once, keeping controls outside system gesture areas. The existing responsive interface supports both orientations. Configuration changes keep the current WebView/game in place. Back closes an open game dialog before exiting. Pausing the Activity pauses WebView timers; resuming restores them.

Build on Windows with Node.js, JDK 17+, Android SDK platform 36 and Build Tools 36:

```powershell
.\Build-Android.ps1 -WithTests
```

The script builds the web game, synchronizes `dist/` into Android assets, builds the APK, and saves `artifacts/Blackjack-After-Hours-1.2.1.apk`. It generates machine-local `android/local.properties`; do not commit it. Standard Gradle Wrapper scripts are included for other environments.

This is a debug-signed installable test build, not a Play Store release. Keep the same debug keystore for compatible development updates; a future distribution release needs a dedicated signing key. No signing keys or test APKs are included in the user-facing APK.

Android instrumentation tests in `android/app/src/androidTest/` exercise actual touch dispatch, complete a round, open settings, check native Back, test a million-chip balance, check persistence, audit 48px touch targets and horizontal overflow, and capture native screenshots. Tests seed only the emulator's local demo balance and restore it afterward. Test controls are not shipped in the app.

Sources:
- https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- https://developer.android.com/develop/ui/views/layout/edge-to-edge
- https://developer.android.com/guide/webapps/webview

## Version 1.0 verification — 2026-10-28

Validated the installable APK in Android 16 / API 36, Google Android WebView 133.0.6943.137, x86_64 emulator with host GPU. Native screenshots and instrumentation logs are retained under `artifacts/android-qa-release-final/`, `artifacts/android-qa-compact-final/`, and the corresponding `.log` files.

- Default phone: 1080×2400 physical pixels, 420 dpi, approximately 411 CSS px wide. Full native suite passed (2 tests): million bankroll with complete post-reload readiness, card-region scrolling, a real-touch complete round, new session, settings, native Back, and layout audits.
- Short phone: 720×1280, 320 dpi, 360×640 logical screen. Native round/dialog test passed. A dedicated short-screen layout keeps the entire first hand and active actions visible, uses a 180-unit dealer portrait, retains 48px/56px targets, and hides unavailable actions during play. Betting controls and the status/pile area remain reachable by vertical scrolling; split hands use the inner field scroll.
- 31 Vitest tests passed. Android build and Android Lint passed with 0 errors; 9 non-blocking lint warnings remain (including target SDK freshness and framework/backup advisories). APK Signature Scheme v2 verified; minimum SDK 26, target SDK 36; no network permissions requested.

Fixes from Android verification: consume native system insets so WebView CSS does not apply them twice; use standard compositor CRT filters in the native wrapper; limit sprite sampler batching for WebView drivers; reserve scroll clearance above the status rail; keep a small bankroll stack visible on a normal phone; shrink long balance text to its panel. The web version retains its SVG CRT filter. A navigation-aware native test wait avoids evaluating JavaScript in a document being replaced.

No physical handset, TalkBack, or device battery/frame-rate benchmarking was available. Emulator screenshots verify appearance and interaction, not frame-rate guarantees on every Android GPU.

## Version 1.1 — full-bleed layout

Version code 2, version name 1.1.0. The header and table perimeter are removed. The portrait moves to the upper right, the larger shoe and optional speech bubble to the upper left, and the bankroll to a compact lower-left HUD. Stakes live in a keyboard-accessible animated popover behind a chip button; opening/closing synchronizes aria-expanded and inert. The panel closes automatically and its trigger fades away during dealing/player/dealer phases. Native Back closes the popover before exiting.

The canvas no longer receives a single CSS monochrome filter. Pixi groups handle dealer/shoe/chips separately; cards receive a separate tone matrix with highlight headroom and retained suit/art colour differences. The static felt remains CRT-tinted. Court image masters are unchanged.

Dealer emotions progress through neutral → intermediate → final expression once, hold the final pose for about three seconds, then return through intermediate/idle with 320ms continuous blends. Reduced motion shows the held expression without tweening and then idle. Re-renders and settings changes do not replay the result reaction.

Verification: 32 unit tests pass, including hold duration and gradual return. Android 16/WebView 133 instrumentation passes on both 1080×2400 at 420 dpi and 720×1280 at 320 dpi. Coverage includes native touch wagering, native Back for the wager popover and settings, automatic stake hiding, full round, million bankroll, persisted speech disabling and restoration. Browser DOM audits cover eight viewport sizes from 320×568 to 1440×1000 with no horizontal overflow or visible buttons below 48×48 logical pixels. Android Lint has zero errors (existing non-blocking warnings retained). Final screenshots: `artifacts/android-qa-1.1-verified/`; short-screen screenshots: `artifacts/android-qa-1.1-small/`. Instrumented taps wait for the disclosure transition to settle before measuring target coordinates.

## Table finish — 1.2.0

Version code 3 adds a thin upholstered perimeter with paired brass seams and a recessed dealer bay matching the portrait position. The rail is decorative: it does not consume layout width or intercept pointer input. Phones use a narrow rim; desktop windows use a wider profile. The dealer bay extends to the actual visible canvas edges even when the logical scene is centred or scaled. Small brass fittings and low-contrast foil markings add depth without changing card colour filters.

Geometry is drawn with Pixi Graphics during resize only; no additional image assets, render-loop geometry, downloads or animation timers are introduced. The surrounding rail uses static CSS inset shadows. Cards, controls, card inspection and scrolling retain their existing layout.

Browser validation: production build, 32 unit tests, eight viewport sizes (320×568 through 1440×1000, including landscape), no horizontal overflow, all visible controls at least 48px, no browser console errors. Screenshots: `artifacts/table-rail-web.png`, `artifacts/table-rail-phone.png`. Android validation is recorded in `artifacts/android-qa-1.2.log`.

Android 1.2 verification: Android 16 emulator, both instrumentation tests passed (round/actions, wager popover/native Back, speech persistence, million-bankroll scrolling). Native screenshot `artifacts/android-qa-1.2/02-dealt.png` was visually checked. APK signature and copied-file SHA-256 verified: `8F1F9F1F4D7BD89A4EBC05A0494F48502AEF7E935C79A958F40E5552040DBA12`. The test emulator was stopped; the web preview remains available on port 5173. Physical-device performance has not been measured.

## Card phosphor adjustment — 1.2.1

Version code 4 strengthens card CRT monochrome mixing from 20% to 78% and changes the RGB phosphor tint to 0.60/1.00/0.70. The existing contrast gain, highlight headroom, and shared inspection filter remain intact. CRT-off rendering remains unfiltered. Production build and browser visual checks at desktop/mobile sizes passed; the Android APK was rebuilt with the same assets (no repeat emulator run for this colour-only change). Current browser proof: `artifacts/cards-crt-1.2.1.png`.
