# Phase F2 High-Resolution Terrain Review

**Status: Pending human review**

Candidate: game/package 1.10.32, build `2026-09-20-phase-f2-high-resolution-terrain`. Source baseline: Phase E commit `d0c92fb821c848bf362ed3c830f464e3c4ca5a56`. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged. The old 1x F1 candidate is superseded with changes requested. Terrain Direction 02 is approved as the visual language, but this in-game F2 translation remains pending human visual approval.

## Scope

F2 replaces only the terrain/political presentation source: the world remains 720 x 414 while Canvas and development Pixi consume the same deterministic 2880 x 1656, 4-pixels-per-tile offscreen Canvas. Canvas requests high-quality image smoothing; Pixi uses bilinear/linear texture sampling. A dedicated module Worker builds the deterministic static terrain and dynamic composite; render, input, zoom, and simulation paths only enqueue/coalesce state and continue displaying the last completed raster. Static Direction 02 water, shelf, wetline/keyline, rivers, relief, contours, grain and presentation marks remain subordinate to dynamic ownership, allied/hostile borders, suppression, fixed pick/highlight, and final fog treatment. Political ownership and ownership borders intentionally remain public under fog for map context. Suppression, pick, and highlight are private: they are gated before fog and cannot alter hidden pixels or leak through a hidden tile into visible neighbors. A discrete camera threshold selects strategic or operational ownership without rebuilding static terrain. Camera/input world geometry, simulation, assets, units, and production renderer selection are unchanged.

Phase F remains open. “Proceed” approved the general Terrain Direction 02 and Unit Direction 02 for production translation, not final in-game terrain, an individual Phase G row, a release, deployment, or a golden update.

## Evidence Index

Generated candidate evidence belongs under ignored `.artifacts/phase-f2-review/`:

- Review manifest: `.artifacts/phase-f2-review/manifest.json`
- Start here: `.artifacts/phase-f2-review/review-start-here.png`
- Strategic, mid, close, and very-close candidate captures and contact sheets: `.artifacts/phase-f2-review/candidate/` and `.artifacts/phase-f2-review/contact-sheets/`
- Raw technical evidence and retained Playwright JSON gzip streams: `.artifacts/phase-f2-review/raw-evidence.json`, `.artifacts/phase-f2-review/configured-browser-matrix.raw.json.gz`, and `.artifacts/phase-f2-review/direction-02-prototype.raw.json.gz`

The machine-readable manifest retains a deterministic SHA-256 source manifest with every included path/content hash, file count, HEAD, game version, and build. Run `npm run verify:phase-f2:review` to recompute the source binding and retained artifact hashes. Existing committed F1/Canvas goldens remain untouched.

Capture records retain scene/seed/camera/viewport/DPR/renderer, PNG SHA-256, baseline path, and exact pixel-delta statistics. Each large representative plate reports changed-pixel percentage plus mean and maximum absolute RGBA channel delta, includes a 6x amplified absolute-difference heatmap and legend, and pairs native 1:1 baseline/candidate crops selected from the densest changed-detail region. These measurements locate and quantify change; changed-pixel count is not a visual-quality score or approval signal. Existing committed PNGs are read-only inputs and must not be overwritten. Missing captures remain explicitly pending rather than being described as passed. The CVD plate is generated only from the explicit fixture: for each normal/protanopia/deuteranopia/tritanopia transform it measures the closest pair in the exact 14-color game palette, renders that pair through the F2 terrain model with both same-team and hostile boundaries, and records exact colors, palette indices, transformed RGB distance, and border factors in the manifest. It is not an ordinary random scene.

## Human Questions

1. Does ownership remain immediately readable over low, mid, and high relief at strategic and close zoom?
2. Are same-team borders clearly softer than hostile borders without disappearing?
3. Are coast corners, narrow peninsulas, islands, and rivers legible without excessive noise?
4. Does fog hide information appropriately while preserving coastline and navigation context?
5. Are the worst political color pairings distinguishable on normal and protanopia/deuteranopia/tritanopia review plates?
6. Is the texture restrained enough that borders, targeting, units, labels, and action effects dominate?

Approval requires a named reviewer and actionable disposition recorded here. Direction 02 approval does not satisfy this in-game gate. Current disposition remains **Pending human review**.

## Technical Gate

The F2 gate compares terrain-only Canvas-high and Pixi/WebGL-linear framebuffers at integer and fractional camera origins/scales and DPR 1/1.5/2. It separately probes authoritative coast, controlled one-tile island, narrow channel, peninsula, and controlled river-mouth inputs through the production screen-to-tile mapper on both renderers; sustains 10 Hz suppression updates long enough to force coalescing; and retains raw samples for enqueue, both zoom-threshold directions, hover enter/plateau/leave, pick enter/cancel, and paused Escape. Canvas high-quality resampling is implementation-defined while Pixi uses linear texture sampling, so parity permits small bounded sampler color differences but does not permit geometry drift, terrain/background occupancy drift, gross color error, or incorrect scale.

Worker compute latency and main-thread responsiveness are different measurements. A terrain build may take hundreds of milliseconds in its Worker while synchronous enqueue, interaction, and publish operations remain responsive; neither measurement is GPU presentation latency or end-to-end input latency. If the first raster is still pending after 400 ms, a pointer-transparent loading status appears and clears on publication/failure or after a four-second bound, so it cannot block input or hide gameplay indefinitely. Exact latest completions always publish their returned bytes, including Worker cache hits. During sustained invalidation, a stale completion may publish only when its retained fog snapshot exactly equals the newest request's fog; these safe intermediate publications keep the display moving while a final exact-latest publication remains mandatory after settling. Fog-incompatible stale work and every pre-reset completion are discarded. Cold Worker/CSP/module/runtime failure installs a deterministic neutral 1x-per-tile emergency terrain upscaled into the shared 4x canvas; an existing valid raster is retained instead. Reset immediately clears old ownership/fog to a neutral loading surface for both Canvas and Pixi.

The source-bound schema-4 manifest independently verifies raw sample arrays, thresholds, convergence generations and drained state, exact command exit status, browser/project coverage, Playwright pass/skip/failure counts, gzip payload hashes, candidate identity, source hashes, and unique IDs/paths. Intentional project-selection skips are reported separately and never counted as passes. Technical qualification only closes machine-checkable F2 gaps; it does not approve the visuals, update old goldens, authorize Phase G unit production, or constitute release/deployment approval.

Memory categories are separate and must not be summed as “38 MiB total retained.” At 2880 x 1656 RGBA, one source is 19,077,120 bytes. The worker model retains two raster arrays (38,154,240 bytes) plus about 3.6 MiB of static/dynamic model inputs. Its bounded composite/output-copy peak is about 80 MiB including model inputs, before browser Worker overhead. The main thread retains one 19,077,120-byte `ImageData`; the offscreen Canvas backing is estimated at another 19,077,120 bytes. Pixi additionally has one terrain texture whose RGBA8-equivalent estimate is 19,077,120 bytes, but actual GPU allocation is browser/driver-dependent and remains unknown. At most one dispatched input snapshot and one queued reference descriptor exist; the queued request has no typed-array copy.

The pure fixture pins exact 4x bytes plus coast/shelf/keyline, water, river center/edge, continuous relief/contours, non-repeated subpixels, strategic/operational ownership, allied/hostile borders, fog, suppression, pick/highlight, immutable handoff, reset determinism, invalid caps and static-cache reuse. Production remains Canvas-only. Exact rerun results and the final source-manifest SHA-256 are retained in the generated manifest; earlier F1 or pre-fix claims are not evidence for this binding. The existing general Phase E 2 x 60-second hardware gate is not required because F2 does not change that general gate.

Committed Canvas goldens were not changed. Their differences are expected candidate visual deltas, not accepted baselines. Exact per-image counts and channel deltas are in the ignored F2 manifest.
