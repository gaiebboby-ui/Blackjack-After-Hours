# Project guide

Blackjack After Hours is an offline-first blackjack game for browsers and Android, with an animated dealer, an illustrated Retro Casino deck, Russian and English interfaces, saved preferences and virtual chips.

## Run locally

Node.js 22.12+ and npm are required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. Windows users can also use [Start-Blackjack.cmd](../Start-Blackjack.cmd).

## Validate and build

```sh
npm audit --audit-level=moderate
npm test
python -m unittest discover -s tests -p test_layered_export.py
npm run build
npm run preview
```

Python and Pillow are required for artwork tests and exports, but not for the normal web build. Deploy the contents of dist/ to a static HTTP(S) host. The build includes project and third-party licenses. Generated output, caches, credentials and local archives are excluded from Git.

## Gameplay

Six decks; dealer stands on soft 17 and checks for blackjack before player actions. Natural blackjack pays 3:2, other wins 1:1. Hit, stand, double and split equal ranks up to three hands. Split aces receive one card each; split 21 is not a natural. Bets range from 10 to 500 chips. There is no insurance or surrender.

Balance is saved after a completed round. Reloading cancels an unfinished round. Malformed saved history is discarded instead of preventing startup. Saves are local and editable, with no real-money value.

## Sound

Sound is off by default. Enable it using the sound button. The title screen plays Neon Stakes; entering the table switches to Midnight Circuit — Long Orbit, a 15-minute looping score. Music and effects have separate volume controls. Muting or hiding the app pauses table music, which resumes from the same position. See [audio notes](audio-demos.md).

## Further documentation

- [Android build, tests and signing](ANDROID.md)
- [Packaging a release](RELEASE.md)
- [GitHub Pages and repository restrictions](GITHUB_PAGES.md)
- [Artwork and provenance](ARTWORK.md)
- [Asset generation](ASSETS.md)
- [Editable artwork](EDITABLE-ART.md)

## Source code and materials

Source code is licensed under [GNU GPL v3](../LICENSE). Third-party libraries retain their own licenses; see [distribution notices](../THIRD_PARTY_NOTICES.txt). The code license does not grant rights to third-party characters, trademarks, references or artwork.
