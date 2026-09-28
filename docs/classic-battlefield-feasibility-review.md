# Classic battlefield visual direction: implementation feasibility

**Current candidate update:** 1.10.49 / plugin 1.10.8 is now undergoing qualification for the approved GO objective. See [the current release record](release-record-1.10.49.md). References to 1.10.48 below describe the prior candidate. No publication has occurred.

Updated 28 September 2026: game 1.10.48 / plugin 1.10.8 is the current local candidate, with classic Canvas artwork enabled for production packaging. It is NO-GO; see [the release record](release-record-1.10.48.md) and [budget reassessment](performance-budget-reassessment.md). Production has not been accessed or changed. Earlier observations below remain historical evidence, not current release certification.

Review date: 2026-09-26 (America/New_York).
Reviewed local HEAD: 09ed1844d046582f696bb4aad5866f3d4d60bb2e, including the existing uncommitted Phase G changes.
Target: the original 1996 Red Alert's overhead battlefield readability, with modern dimensional raster art, using Statefall's existing rules.

## Conclusion

Feasible as a substantial presentation upgrade on the existing 2D architecture. A full 3D engine or simulation rewrite is not required for this visual language. The current implementation cannot reproduce the concept by dropping in a background image or replacing a few icons. It needs authored sprites, terrain detail, revised presentation scale, ordering, hit testing, and asset integration.

This is an end-to-end feasibility assessment of the relevant code paths and existing tests, not certification that the generated concept already runs or that future assets meet performance budgets. The generated image is visual direction only.

## Scope and boundaries

Inspected the application entry and legacy browser integration, simulation authority and actor schemas, command and replay boundaries, map generation and pathing, construction, land/naval/air/support systems, fog, camera and viewport, Canvas/Pixi dispatch, layer models and ordering, atlas registry, terrain worker, platform adapter, Vite/finalizer, WordPress release asset handling, and associated verification contracts. Other gameplay systems were traced through their interfaces and exercised by the existing suite; this is not an unrelated security audit or a claim that every line of the repository was independently proven correct.

No game implementation, simulation rule, existing artwork, approved golden, release artifact, or production setting was changed by this review. Existing Phase G modifications were left in place. Browser test output is under .artifacts/classic-direction-audit-browser and .artifacts/classic-direction-audit-atlas. This report is the only new review document.

## Findings and required design decisions

### 1. The simulation is reusable

game/src/sim/engine.mjs creates authoritative state, exposes read-only presentation views and detached render buffers, and supplies interpolation snapshots. The browser uses a 720 x 414 tile world and 100 ms ticks. Camera, animation, sprite frames, and decorative details can remain presentation concerns.

Preserve authoritative positions, ownership, commands, fog, and targeting. Decorative variation must use its own seeded hash/randomness. game/src/sim/compatibility-effects.mjs intentionally preserves historical simulation RNG draws for effect descriptors; replacing their appearance must not remove or add those engine draws.

### 2. The mockup includes gameplay that does not exist

game/src/sim/authoritative-state.mjs has structures, warships, transports, traders, aircraft, trucks, planes, shells, missiles, interceptors, and aggregate attacks. It has no tank or individual infantry actor collections. land-combat.mjs advances frontiers using troop totals and tile ownership. Factory income does not correspond to tank production. There is no Red Alert-style power-grid economy.

Suitable real subjects: city, factory, missile command, radar, SAM, coastal battery, port, destroyer, aircraft, and repair truck. Revise the concept's generic headquarters/power facility to actual Statefall roles. Do not present freely controlled tanks or infantry as a graphics-only deliverable. Ground-front visual effects could be added later, clearly subordinate to actual territory combat.

### 3. Scale is the main visual integration constraint

camera.mjs limits scale to 0.35-12 CSS pixels per world tile. structure-layer-model.mjs uses radius max(6, scale * 2.4), giving a nominal base diameter of 19.2 CSS pixels at scale 4 and 57.6 at scale 12, excluding stroke, padding, and overlays. Structures disappear below scale 0.9.

rules.mjs sets STRUCT_SPACING=6; structures.mjs enforces center distance rather than a rectangular building footprint. At maximum zoom, minimum center spacing is 72 CSS pixels. Simply replacing those bases with the concept's 100-200 pixel compounds would obscure neighboring structures.

Define a shared presentation specification for ground footprint, roof overhang, anchor, shadow, selection bounds, and zoom detail. Keep world spacing unchanged initially. If more inspection zoom is needed, change the camera/presentation contract and requalify it; do not enlarge world footprints or alter placement rules just to accommodate art.

### 4. Artwork loading exists as infrastructure, not as a finished game pipeline

legacy-game.js:1964 generates each structure texture on a 64 x 64 canvas using drawIcon. Pixi caches these by type and faction color. Ships, aircraft, support actors, and projectiles largely use generated geometry rather than authored sprite sheets.

atlas-manifest.mjs and pixi-atlas-registry.mjs support PNG/WebP, frame rectangles, anchors, scales, reference accounting, caps, and cleanup. Source inspection found no live gameplay integration of that registry; its browser proof is synthetic. The registry must be connected to real units, loading readiness, failure handling, and context restoration.

Author separate transparent assets with consistent camera and lighting. Supply heading frames for dimensional moving units: rotating a single shaded roof-and-wall image in screen space would rotate the apparent light and wall perspective. Define construction, damage where supported, suppression, capture/faction changes, launch/fire, and destruction treatments. Not every entity has all these states; preserve actual game semantics. Connect menu/credit portraits to the same art family.

### 5. Terrain needs a different detail strategy

terrain-raster-model.mjs creates one whole-world raster at 4 pixels per tile: 2880 x 1656, or 19,077,120 RGBA bytes per buffer. The worker keeps additional buffers and copies. Ownership, fog, suppression, and highlights are composited into that raster. Ownership blending is 64% at strategic zoom and 47% at operational zoom.

There are no authored forests, roads, rocky shore objects, or height geometry in the map schema. Decorative terrain can be derived reproducibly from land/river/roughness and coordinates. It must respect existing topology and retain territory readability.

Do not solve close detail by blindly increasing the entire raster: 8 pixels per tile on this map produces 19,077,120 pixels, exceeding the current 8,000,000-pixel cap. Prefer visible-region detail/chunks or tiled textures above a bounded base, with dynamic political/fog information separately managed. Keep a readable strategic overview.

### 6. Decorative scenery cannot become implicit collision

naval.mjs routes through water tiles. logistics.mjs repair-truck paths follow owned tiles without testing decorative trees, roads, or building footprints. Map roughness affects land-combat cost; it is not a 3D elevation/collision system.

Keep roads and scenery cosmetic in the first implementation. Avoid placing visually solid trees, rocks, walls, or piers across apparent routes. Coast buildings can use presentation orientation/shore masks derived from real land/water, but must not move the authoritative coast. Actual terrain obstacles or road-dependent movement would be a separate gameplay change.

### 7. Ordering and selection need explicit work

pixi-hybrid-renderer.mjs:209 appends fixed category layers: structures, naval logistics, warships, projectiles, missiles, aircraft, labels, support actors, effects, and overlays. Structure entries retain item ordering, not a general ground-depth sort.

Taller buildings and trees need consistent ground-anchor ordering, separate shadows, and appropriate air/effect passes. A repair truck should not always draw on top of a roof simply because support actors are a later layer. Canvas fallback must follow the same policy.

legacy-game.js:768-769 picks structures/ships by distance to their centers, while tileAt uses the authoritative camera mapping. Replace visual hit regions where necessary with shared sprite bounds/anchors, resolve overlapping sprites deterministically, and still dispatch original tile/actor IDs. Fog and submarine visibility must also apply to shadows, damage, effects, and selection. Keep operational ranges, queues, and faction identity legible.

### 8. Pixi is currently excluded from production

vite.config.js aliases the renderer factory to renderer-factory-production.mjs for normal builds. That factory is Canvas-only. tools/finalize-game-build.js explicitly rejects production JavaScript containing Pixi or renderer-switch markers.

Canvas can render authored raster sprites too, so production Pixi is not a prerequisite for the first local scene. For a Pixi release, deliberately revise these gates with equivalent isolation/fallback coverage. Do not remove guards merely to make a build pass.

The repository WordPress plugin supports PNG/WebP/JSON, manifest inventory, hashes, release-qualified paths, and MIME handling. Default package limits are 64 MiB compressed, 128 MiB extracted, 32 MiB per file, and 2,000 files. That infrastructure can carry sprites; actual built URLs and exact installed packages still need verification.

### 9. Performance remains unproven for the proposed artwork

Atlas limits currently allow eight atlases, 4096 x 4096 source dimensions, 4096 aggregate frames, and 64 MiB of manifest source bytes. Compressed image bytes are not decoded/GPU memory: eight full RGBA atlases at those dimensions are about 512 MiB before additional copies/mipmaps.

Add explicit decoded texture budgets and bounded visible detail. Share faction masks/palettes instead of multiplying every full-resolution texture by every nation. Existing rendering allocates/rebuilds vector primitives in several paths; authored sprites may reduce that work, but this is a hypothesis until measured.

The general browser performance fixture has a 900,000-byte transfer/decoded resource ceiling; its decoded network size is not GPU memory. New assets must be measured against applicable budgets, and any budget revision must be documented rather than silently raised. Historical Phase E evidence is for the old artwork, not proof of this direction.

## Smallest credible in-game proof

Use the existing game and real map state, not a detached painted backdrop:

1. Introduce a local development-only candidate that loads a small authored atlas and a bounded terrain detail layer.
2. Show a factory or city, radar, SAM, coastal battery, port, destroyer, aircraft, and repair truck driven by existing entities.
3. Inspect strategic, normal, and close zoom on actual minimum-spacing placements and awkward coastlines.
4. Exercise construction/capture, faction colors, applicable damage/suppression, fog, selection, ship orders, repair movement, and combat effects.
5. Compare canonical state and replay results with the current renderer; preserve RNG and command behavior.
6. Verify Canvas fallback, missing assets, context loss, display scales, reduced motion, browser compatibility, loading, frame pacing, and sustained memory use with representative dense play.
7. Obtain a visual decision on the running scene before extending the artwork across every unit. The previous terrain approval remains historical evidence; this proposed visual direction is not automatically approved terrain or unit replacement.

## Verification in this review

- Node v22.23.2, within the repository's supported range.
- Complete npm test suite: PASS, including rendering contracts, runtime, engine isolation, relay, authority boundaries, system tests, replay validation, seven historical parity scenarios, map/mode smoke, restart/replay, and renderer independence.
- Production-grid determinism: PASS, both runs final legacy hash bc43ad4e and SHA-256 prefix 509ad7e54aa2, all 85/85 commands applied, divergence false.
- Existing Chromium browser test "Canvas and Pixi hybrid preserve state, input, camera, and bounded raster lifecycle": 1 passed, 18.1 s.
- Existing synthetic Pixi atlas browser test at DPR 1, 1.5, and 2: 3 passed, 5.2 s.
- Initial restricted runs encountered child-process/filesystem permission limits (relay child exit status null and browser spawn/mkdir EPERM). Re-running with approved local execution permissions passed; no source fix was made.
- Browser test servers were no longer listening on ports 4173/4174 after completion.

These tests verify the current foundation, not the unimplemented new artwork or its eventual performance.

No Docker/WordPress integration, release build, production access, new-art performance qualification, or full browser/golden matrix was performed. These remain implementation/release gates. Existing Node module-type and browser color-environment warnings were observed.
