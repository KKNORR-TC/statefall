# Phase E Progress

_Development record for game/package 1.10.13, build `2026-09-18-phase-e1-pixi-foundation`, on 18 September 2026. This is not a release, handoff, production change, Phase E completion, or final-art approval._

## Implemented Slice

- Added pinned PixiJS 8.21.0 as an application dependency and renderer-neutral camera, viewport, renderer lifecycle, and diagnostics modules under `game/src/rendering/`.
- Camera and input remain in CSS pixels. Canvas and Pixi backing stores use device DPR capped at 2; resize preserves the old viewport-center world focus.
- Default and production rendering remain Canvas. Source development and capture serving may request `?renderer=pixi` or `pixi-hybrid`; unsupported names and Pixi initialization/context failure fall back to Canvas with bounded diagnostics.
- `pixi-hybrid` places one non-interactive `canvas.pixi-world` below `canvas#map`. Pixi transforms one nearest-neighbor texture sourced from the existing 720x414 terrain/ownership/fog raster. The transparent legacy Canvas retains all entities, structures, effects, labels, selection, alerts, credits, and input.
- Raster rebuilds remain driven by existing simulation/presentation invalidation. Pan, zoom, resize, and repeated frames transform or redraw without regenerating or re-uploading the raster.
- Persisted page lifecycle suspends one owned RAF and one viewport observer/listener lifecycle without destroying renderer state. Restore remeasures while preserving focus and camera center, and recreates missing Pixi resources without growth. A rejected Pixi restore releases partial and prior resources through the same idempotent path, switches the stable renderer controller to Canvas with a bounded reason, restores the observer/listener, and starts exactly one RAF without restarting or changing canonical state. Normal unload still destroys the runtime.
- Pixi screenshot sampling proves opaque sea/land/ownership pixels and a visible one-build/one-upload ownership invalidation. Real Chromium `WEBGL_lose_context` evidence proves bounded Canvas fallback without simulation, camera, input, hash, RNG, or tick changes.

## Safety Boundary

- The renderer receives presentation data only. Wall-clock, DOM input, Canvas, and Pixi remain outside the simulation engine.
- Vite replaces the development renderer module at build time. The production JavaScript module graph ignores renderer queries, contains no reachable renderer switch or browser test bridge, and emits no Pixi JavaScript chunk. Shared CSS still contains inert `.pixi-*` selectors; this exclusion contract does not claim that every emitted text asset is free of the word `pixi`.
- The current production build emits one 715.68 kB minified / 233.94 kB gzip application bundle plus `flags.js`, inventories and scans both JavaScript files, and emits no Pixi JavaScript chunk. A capture build that intentionally retains the switch emits a 125.83 kB / 39.06 kB Pixi entry plus lazy Pixi renderer support chunks; those chunks are development/capture cost, not production transfer cost.
- Plugin 1.10.7 and `SIMULATION_BASELINE_VERSION='1.10.8'` are unchanged. No simulation fixture changed. The dense late-game Canvas reference was regenerated because corrected `freezePresentation()` now cancels the pending RAF instead of capturing one extra frame; two focused repeats and the full matrix matched the new deterministic frame.

## Remaining Phase E Work

- Port and review dynamic world layers only after parity gates justify each step.
- Add texture atlases/loading policy, pooling, viewport culling, quality levels, reduced-motion policy, and sustained performance budgets.
- Expand capability/context recovery coverage across browsers and hardware. Current context loss is surfaced and falls back without touching simulation.
- Keep Phase F terrain/world art and Phase G entity art separate; this slice uses existing pixels and claims no final art.
