# Blackjack After Hours 1.0.1

## Fixed and improved

- The 15-minute Midnight Circuit — Long Orbit score now plays at the table, loops, follows the music volume control and resumes after muting or returning from the background. Enable sound to hear it.
- Invalid saved history and malformed settings no longer prevent the game from starting.
- Web and Android packages now include GNU GPL v3 and third-party license notices, including PixiJS.
- Updated Vitest; the complete npm dependency audit reports no known vulnerabilities.
- Added Android build and emulator tests to GitHub Checks, plus artwork export tests and a dependency audit.
- Added explicit signed release builds and local signing setup with an access-restricted backup. The existing certificate is preserved for installation compatibility; release builds disable WebView debugging.
- Updated documentation and removed a duplicate banner and obsolete release reports from the active project.

## Downloads

- `Blackjack-After-Hours-1.0.1.apk` — signed Android release build, Android 8.0+ with a current Android System WebView.
- `Blackjack-After-Hours-1.0.1-web.zip` — web build for static hosting.
- `Blackjack-After-Hours-1.0.1-source.zip` — matching source code, artwork sources and license notices.
- `SHA256SUMS-1.0.1.txt` — checksums for the three files above.

## Validation

77 TypeScript tests, 4 artwork export tests and 3 Android instrumentation tests passed locally. Chrome checks covered corrupted save recovery, gameplay, 900-second music playback, looping, volume, background pause/resume and license downloads. The complete Android test run passed with network connectivity disabled.

GitHub Pages remains a placeholder. The source repository stays private; account plan restrictions on Pages and branch protection are documented in doc/GITHUB_PAGES.md.
