# Release procedure

1. Update package.json and package-lock.json; increment Android versionCode.
2. Run a clean dependency installation, npm audit, npm test, artwork export tests, npm run build, browser smoke tests and Android device tests.
3. Generate THIRD_PARTY_NOTICES.txt with the normal build. Commit LICENSE, notices, sources and release notes.
4. Push the exact tested commit and create an annotated vX.Y.Z tag. Never move a published tag to change release contents.
5. Build with APP_RELEASE_TAG and APP_COMMIT set to that tag and commit. Build the signed Android release with explicit credentials, or clearly label a debug test APK.
6. Package dist/ as the web archive and use git archive on the tag for the source archive. Both must contain LICENSE and THIRD_PARTY_NOTICES.txt. Inspect the APK for matching licenses and audio assets.
7. Generate SHA-256 checksums, upload all files to a new private GitHub Release and compare GitHub asset digests with local hashes.

The source archive must match the binaries. The v1.0.0 tag predates the GPL and notice-packaging changes; keep it immutable and use v1.0.1 or later for corrected distributions. GitHub Pages remains disabled until the account supports Pages for a private repository and publication is explicitly enabled.
