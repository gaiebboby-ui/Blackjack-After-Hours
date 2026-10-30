# Full-bleed Blackjack table — UI revision 1.1

The header and ornamental table perimeter were removed to recover usable space. The dealer portrait is in the upper-right corner; the speech bubble and enlarged dealing shoe are upper left. Player balance and round status form a compact bottom HUD. The existing table master is cropped to its felt centre so baked decorative panels do not compete with the new positions.

Wager controls are a progressive disclosure panel anchored to a chip button. aria-expanded, aria-controls and inert stay synchronized; Escape/native Back close it. Betting remains accessible before/after a round and fades away during play. Controls retain 48px targets, including the short-phone layout.

CRT treatment lives in separate Pixi rendering groups. Applying the same monochrome conversion to an entire canvas erased colour separation and compressed pale court artwork into the card paper. The cards now receive a mild, highlight-safe tone matrix and keep suit/art colour differences; dealer, shoe and chips keep the stronger phosphor palette. Card image masters and source prompts are preserved. Inspection/raised-card layers share the same card treatment.

Result emotion timing is a one-way sequence: enter via the intermediate expression (150ms blends), hold the final expression from 240ms to 3400ms, then return through intermediate/idle (320ms blends), reaching idle by roughly four seconds. Breathing is stopped during the expression. The next blink is deferred beyond the reaction. Round/phase guards prevent resize/settings/card updates from replaying the event.

The speech-bubble preference defaults to enabled, merges safely into existing settings, persists, and does not disable result expressions. Phrase changes animate once, respecting reduced motion.

Validation: 32 unit tests, DOM viewport audits at eight widths/heights, keyboard card inspection, actual Android touch tests on regular and small emulated phones, native Back, speech preference persistence, and million-bankroll scrolling. Physical device frame-rate and accessibility-service testing remain outside this validation.

Revision 1.2 restores a purely decorative, responsive perimeter without changing the full-bleed layout dimensions. A vector dealer recess and static CSS upholstery add depth while preserving usable space. See the Table finish section of ANDROID.md for details and validation.
