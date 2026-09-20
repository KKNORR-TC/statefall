# High-Resolution Terrain And Unit Directions

This directory contains isolated, non-production art-direction prototypes for human review. They do not import, modify, or represent the Statefall game runtime. Terrain and unit directions are reviewed independently. Neither prototype approves production art or any Phase G row.

Human direction for this revision is recorded in [`DECISIONS.md`](DECISIONS.md).

`terrain.html` compares two useful scales in one 1440x900 review plate:

- A detailed operational coast map showing relief, contours, woodland, rivers, coast character, shallow shelf, territorial washes, and an unexplored edge.
- A strategic overview showing how detail progressively resolves inside the selected extent.

`units.html` presents a separate animated in-world unit-language direction over a subdued operational terrain context. It demonstrates representative Statefall naval, submarine, air, coastal, air-defense, support, and projectile categories; restrained ambient and class-specific transit motion; general state treatments; and progressive simplification at strategic scale. It is not a sprite catalog, gameplay UI proposal, individual-unit approval, or Phase G row approval.

All artwork is original deterministic Canvas 2D drawing generated from fixed data and seeds in `terrain.js` and `units.js`. Unit animation is derived only from the current presentation time, with no accumulated simulation state. CSS supplies the review compositions and visual keys. There are no downloaded fonts, external assets, photographs, third-party artwork, or runtime dependencies. Canvas backing resolution follows device pixel ratio capped at 2.

The shared `styles.css` scopes unit-specific rules separately so the terrain study remains independent.

## Review

From the repository root, the absolute-relative review paths are:

- `prototypes/high-resolution-direction/terrain.html` for independent terrain-direction review.
- `prototypes/high-resolution-direction/units.html` for independent general unit-direction review.

Open either file directly in a browser. The target review format is Windows Chromium at 1440x900 with device scale factor 2.

The unit page animates through `requestAnimationFrame` in normal use. Deterministic review and screenshot capture call `window.__UNIT_DIRECTION_ANIMATION__.setFixedTime(8400)`, which pauses live animation and redraws the exact same frame on every run. `resume()` returns to live presentation. Reduced-motion preference suppresses decorative animation and retains all semantic unit/state rendering.

## Verification

From the repository root:

```powershell
node --check prototypes/high-resolution-direction/terrain.js
node --check prototypes/high-resolution-direction/terrain.spec.js
node --check prototypes/high-resolution-direction/units.js
node --check prototypes/high-resolution-direction/units.spec.js
node --check prototypes/high-resolution-direction/playwright.config.js
npx playwright test --config prototypes/high-resolution-direction/playwright.config.js
```

The Playwright tests check browser errors, exact DPR-sized Canvas backing stores, sampled color complexity, document overflow, isolated prototype markers, terrain-only isolation, representative unit category/state markers, deterministic animation states and anchors, and reduced-motion behavior. Terrain and unit pages have separate deterministic desktop snapshots inside this directory.
