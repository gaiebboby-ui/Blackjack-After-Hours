# Desktop web table layout

Desktop web (viewport width at least 840 CSS pixels, excluding the Android WebView) uses larger cards and 56-unit bankroll chips instead of 40-unit chips. The existing card-size preference still applies. The viewport fits the complete table, so the visible card-size increase depends on the aspect ratio and bankroll reserve. Portrait web and native Android keep their previous geometry.

The speech position is projected from the dealer portrait into CSS coordinates on every resize. The portrait shifts left only when needed to leave speech space; the bubble width shrinks on narrow desktop windows. Split hands reserve a lane for the action panel and a left border margin. Dealer and player rows keep separate score badges and room for bankroll chips.

The action heading previously used CSS-generated Russian text. It is now an ordinary DOM text node handled by the existing reversible language switch. It retains uppercase styling. Auditing English interface text also covers closed dialogs; the Russian language option intentionally retains its native name.

Validation: 87 TypeScript tests; Chrome gameplay, English/Russian switching, six desktop split-hand viewports from 840 to 2560 pixels, portrait and short-phone geometry, and Android user-agent exclusion. Browser checks confirmed no action-panel overlap, speech clipping or horizontal document overflow.
