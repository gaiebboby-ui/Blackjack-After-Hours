# Blackjack After Hours 1.0.0

Atmospheric blackjack for the browser and Android, featuring an animated dealer, an illustrated Retro Casino deck, and a responsive interface.

## Features

- Russian and English interfaces.
- Desktop and mobile layouts with dedicated title artwork.
- Saved balance and preferences.
- Table sound effects, title music, and separate music and effects volume controls.
- Bundled game assets for offline play in the Android app.

## Downloads

- `Blackjack-After-Hours-1.0.0.apk` — Android app for test installation. Requires Android 8.0 or later and an up-to-date Android System WebView.
- `Blackjack-After-Hours-1.0.0-web.zip` — web build ready for static hosting.
- `Blackjack-After-Hours-1.0.0-source.zip` — source snapshot from tag `v1.0.0`.
- `SHA256SUMS-1.0.0.txt` — SHA-256 checksums for the three archives and packages above.

GitHub Pages is coming soon.

## Validation

- 59 TypeScript tests and 4 artwork export tests passed.
- Clean dependency installation, TypeScript checks, artwork verification, and the production web build passed.
- Chrome checks covered the title screen, dealing, round completion, settings, subdirectory hosting, and a 390 px mobile layout, with no JavaScript or resource loading errors.
- Android APK built successfully with version name `1.0.0` and version code `6`.

## Notes

The APK uses a debug signature and is intended for test installation. Android instrumentation tests were not run on a device for this release.

The release dependency audit reported three advisories in the Vitest testing toolchain: one moderate and two critical. The suggested automatic fix requires a major Vitest upgrade and is not included in this release. These development dependencies are not bundled with the game.
