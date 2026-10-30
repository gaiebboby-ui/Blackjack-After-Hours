# Portrait interface based on Android and Material guidance

The position/layout description below records the earlier UI. Version 1.1 supersedes it with `003-full-bleed-table.md`; the accessibility and window-size guidance still applies.

The game remains a browser application. Android dp/sp guidance is adapted to logical CSS pixels and rem text; this is not a native Compose implementation or Android-device certification.

The compact layout is the primary playing experience. Compact windows below 600 CSS px use 16 px side margins (8 px at 320–359 px to retain usable room), medium windows from 600 to 839 use 24 px, and expanded windows from 840 use side docks. Layout responds to the available window rather than a device name. Short windows may scroll instead of shrinking targets or disabling zoom.

All buttons and settings inputs have a target of at least 48×48 CSS px. Main actions are 56 px high, separated by 8 px. Settings checkboxes retain a 48 px target around a smaller visual indicator. Interface text uses rem sizes, normally 16 px body, 14 px action labels and 12 px supporting labels. Native dialogs supply modal focus containment and Escape; closing returns focus to the menu. DOM controls, accessible card summaries, hidden-card privacy, keyboard commands and reduced motion remain supported.

The table contains the status and all betting/play actions. Portrait layouts keep cards at a useful size and stack split hands vertically in a separately scrollable card region. The controls stay below that region, within the felt. On an active-hand change the card region scrolls to the relevant hand; reduced motion disables smooth scrolling. Layout tests cover all three hands at 85%, 100% and 120% card scale. Portrait geometry is centralized in `src/table-layout.ts`.

System insets use safe-area environment values and dynamic/small viewport units. The portrait dealer, dealer cards, score badges and player cards have separate reserved areas. Decorative payout copy is omitted on compact windows. Menu, rules, settings and reset use large controls and readable modal surfaces. Text and control colors use contrasting opaque surfaces; CRT monochrome affects the artwork, while controls retain their defined colors. Scan lines are intentionally faint.

Sources consulted:

- [Google Android accessibility: touch targets](https://support.google.com/accessibility/android/answer/7101858?hl=en) — at least 48 dp touch targets.
- [Android window size classes](https://developer.android.com/develop/ui/views/layout/use-window-size-classes) — compact below 600, medium below 840, expanded from 840; available window size drives adaptation.
- [Android accessibility: text visibility](https://developer.android.com/guide/topics/ui/accessibility/apps) — 4.5:1 for smaller text, 3:1 for larger text.
- [Android edge-to-edge and insets](https://developer.android.com/develop/ui/views/layout/edge-to-edge) — keep important controls clear of system bars and display cutouts; adapted here with web safe-area insets.
- [Material 3 typography](https://m3.material.io/styles/typography/type-scale-tokens) — semantic typography roles rather than independently shrinking every label.

Validation: automated rules/animation/layout tests; browser checks at 320×568, 360×800, 390×844, 600×960, 839×900, 840×900, 1440×1000 and 844×390. No horizontal overflow, all visible button/input targets at least 48 px, betting/action panels inside the field. Browser validation is not a substitute for testing TalkBack, gesture navigation, cutouts and font scaling on physical Android hardware.


## Revision: prioritize dealer expressions and embedded casino controls

The user requested a larger dealer and controls integrated into the felt. Portrait rendering now uses width-based scale (capped at 1.15 on medium windows) instead of shrinking the whole scene to fit its height. The dealer sprite is 240 logical units versus the previous 100, and 280 on expanded windows. Portrait cards occupy a narrower center column; the left dock holds stake adjustments/chips, and the right dock holds play actions/MAX. Labels and ranks remain upright, and card indices were enlarged again to compensate for the narrower column. The controls use dark green bevels, metallic outlines and physical chip styling while retaining 48 px targets. Very short screens scroll instead of shrinking the dealer and targets. Compact windows keep a 700 px minimum field; medium windows use 800 px. Result changes return the card region to its top so the dealer reaction is visible.
