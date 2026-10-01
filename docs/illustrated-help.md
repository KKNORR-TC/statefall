# Illustrated unit guide

The in-game Buildings, Ships and Air tabs and the packaged WordPress help use the same roster in `game/src/help-roster.mjs`. The existing notes and all other help tabs remain intact. Costs and build timings are read from `sim/rules.mjs`; advice is presentation-only and never changes game rules.

Coverage: 20 buildings, four building upgrades, the repair truck, eight combat ships, three logistics vessels and four aircraft. Each of the 40 entries has a gameplay portrait, descriptive alt text, key stats, a role description and practical advice about placement, orders, prerequisites or counters.

## Artwork

`tools/build-help-art.js` extracts a single frame from the existing classic gameplay atlases. The SAM and silo use their actual runtime painters in a ready-to-fire pose. The exporter fits each subject into a transparent 480 × 360 canvas without changing its proportions, then encodes WebP at quality 86. No new or retouched artwork is introduced. The 40 checked-in portraits total approximately 1.1 MB.

The exporter needs the existing `canvas` dependency and a `sharp` installation; set `STATEFALL_SHARP` to a local installed module path if it is not on Node's module search path. The Codex bundled image runtime supplied `sharp` for this export. Ordinary game and release builds use the checked-in portraits and do not need the exporter or `sharp`.

## Delivery

The game uses Vite-managed asset URLs and loads portrait images when help is opened. `tools/build-howto.js` renders the same roster into both static URL variants, embedding compressed portraits so the WordPress shortcode and standalone help require no theme or plugin asset-path changes. Cards reserve image space and use `object-fit: contain`, avoiding the fixed-height distortion found in the homepage screenshots.

In-game portraits load eagerly when their help tab is rendered. Native lazy loading could retain old scroll positions when replacing modal content, leaving visible portraits blank after a tab switch. Standalone website pages retain lazy loading. Three atlas frames (flight operations, missile cruiser and merchant) have detached neighboring fragments outside the subject; the exporter removes only those disconnected fragments while retaining the subject and its antialiased edge.

`tests/help-contract.js` checks roster coverage, advice, artwork format and source markers. `tests/browser/help-roster.spec.js` checks every portrait in the in-game tabs and built website pages, including the narrow-width card layout. The full app's existing desktop-first scope is unchanged.

Production help is part of an immutable game package. Publish it through the normal game release process, not by editing installed package files or changing the WordPress theme.
