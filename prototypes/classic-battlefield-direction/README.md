# Classic battlefield study 01

Local candidate for Ken's original-1996-Red-Alert-inspired direction. This is an opt-in renderer inside Statefall, using the existing simulation.

## Open
From the repository root run `npm run dev`, then open:
http://127.0.0.1:4173/?art=classic&scene=coast

It starts paused. Space runs the match. Drag pans; the wheel zooms. Strategic, Tactical and Close change scale. Compare art switches the same paused match between the current artwork and candidate. Right-click buildings or water for normal orders.

## Scope
Eight commanded buildings (port, battery, factory, city, radar, SAM, engineering command, airfield), one destroyer and a launched fighter. Generated original raster sprites have baked shading, faction recoloring and matching building picking bounds. Trees and concrete pads are cosmetic. Repair-truck artwork is connected but this healthy starting scene does not spawn a repair job. Other units retain their existing art.

Close and tactical views use textured terrain over the actual land/river/ownership/fog grid. Strategic zoom retains the existing political terrain. This is Canvas-only; the candidate forces Canvas locally. Production builds remove the development entry point and assets. The default game art is unchanged.

## Verification
`node tools/classic-battlefield-review.js` (with the local dev server running) checks real commanded sites and ship, unchanged canonical state/RNG during rendering/comparison/zoom, changed artwork pixels, a working factory context menu, 25 real simulation ticks, asset-load fallback, and absence of browser errors. It writes verification.json, a replay and in-game-example.png here.
The full npm test suite passed, including deterministic replay (bc43ad4e / 509ad7e54aa2). Syntax, production build, and the engine/adversarial checks were also run. This is candidate evidence, not release qualification.

Browser review exposed an existing undefined idleAircraft menu reference. The menu now reads the engine's validated, read-only aircraft query.

## Remaining art work
This proves the direction in the actual game; it is not a finished art set. Shorelines still follow square gameplay cells. Moving sprites use one rotated view rather than directional animation frames. Building/vehicle interleaving, detailed damage/construction frames, every unit class, and the Pixi atlas path need a later pass. No tank or infantry mechanics were invented.

Existing unrelated Phase G working changes were preserved. No production, deployment, or release handoff was performed.

## Study 02 — coast and ground (1.10.34)
The same match now uses marching-square coastal contours, subtle shallows, gravel shore edges, broad grass variation, worn slabs and cosmetic service access. Contours deviate at most half a tile from the gameplay grid. Roads only connect visible same-owner sites along sampled visible land; they confer no movement benefit. Static scenery uses one viewport-sized cache (5.2 MB at 1600×1000 with the 300px sidebar), invalidated for camera, sites, fog and ownership. Original study screenshot: study-01-before-terrain.png. Focused browser checks additionally verify cache reuse and visible updates after fog/ownership changes. Syntax and normal production-build gates run for this pass; the full simulation suite was not repeated because no simulation code changed.

## Study 03 — live play (1.10.35)
Detailed scenery and live ownership/fog now have separate bounded viewport caches. Changes at distant sites no longer invalidate the scenery. Tactical/close views skip the unused full-map raster update; switching back to standard art or strategic zoom requests it normally. Territorial tint/borders use interpolated contours at tactical/close zoom; attack fronts use contoured bands at every zoom. These are presentation changes only. The live Chromium test issues a real attack, runs for five seconds, records frame intervals and simulation ticks, and takes live-territory.png. Latest evidence: live-verification.json. These short local measurements are not large-battle or hardware qualification. Browser integration verifies rendering preserves canonical state/RNG and fog/ownership updates do not redraw static terrain. Syntax and production build pass; no simulation files changed in this pass.

## Study 04 — directional destroyer (1.10.36)
Eight generated destroyer views keep the camera and lighting fixed. Explicit rectangles and hull centers align the views; narrow crossfades bridge heading boundaries without rotating the artwork. The wake is a pair of fading stern trails derived from recent ship movement, omitted when stationary. Only the destroyer has this directional treatment.
Click Sail loop to send the existing destroyer to nearby open water and issue eight ordinary movement commands per lap. The camera focuses the loop and the clock resumes. Click again to stop issuing new waypoints; Space pauses normally. The controller is local-candidate-only. Existing gameplay orders and replay recording remain authoritative.
Run node tools/classic-destroyer-review.js with the preview server running. It verifies all eight zero-rotation draw directions, a complete real movement loop, stop control and absence of browser errors. Evidence: destroyer-headings.png, destroyer-loop.png and destroyer-verification.json. This is eight-direction candidate artwork, not a fully animated or firing-qualified naval set.

## Study 05 — smoother turns (1.10.37)
The destroyer now interpolates its visual heading along the shortest angular path using the existing frame interpolation fraction. The eight source views blend across each full 45-degree sector with smoothstep easing in a reusable 256px buffer, keeping overlapping pixels opaque and avoiding bitmap rotation. This remains an eight-view approximation; it does not add intermediate 3D-rendered views. Browser tests assert intermediate heading changes within simulation ticks, correct 170/-170 degree wraparound, and a full lap after the live sampling period. Gameplay heading and simulation state are untouched.

## Study 06 — measured command stalls (1.10.38)
CPU sampling of live Sail loop identified checkpoint graph encoding/decoding as the dominant work. Every atomic command previously encoded a full checkpoint and decoded it for rollback. Internal rollback now directly copies the trusted graph, bulk-copying typed arrays and preserving shared references, cycles, sets/maps and null prototypes. External save/restore validation still uses the existing graph codec. Rollback-copy equivalence/isolation tests and the full npm test suite passed, including adversarial rollback and deterministic replay bc43ad4e / 509ad7e54aa2.
Controlled 10-second browser comparison (rollback-performance.json): previous method 276 frames, 61 ticks, 13 intervals over 50 ms; direct copy 585 frames, 98 ticks, one interval over 50 ms. These are local short-run measurements, not a general hardware guarantee. Camera scenery now uses a viewport plus bounded 384px overscan; panning test (pan-performance.json) recorded six rebuilds over 80 moves, p95 16.8 ms with an occasional 66.7 ms spike. Pixel buffers remain bounded by viewport/DPR. Browser interaction, full ship lap, syntax and production build passed. No deployment performed.

## Study 07 — medium-zoom attacks and naval interaction (1.10.40)
Territory overlays merge uniform interior cells into row runs; attack outlines visit only cells adjoining actual frontiers. Canvas buffers are reused, and static ground is cached separately from site decoration. Ground cache keys include local land/river content and viewport dimensions. All caches remain bounded by viewport size and DPR. The stress tool uses testResources=standard so the resource advantage cannot conceal attack load.

The default coastal scene now uses the existing Billionaire test option, giving the player ample troops and gold. Right-click menus resolve the clicked building directly and query the engine for nearest-port pricing. Right-clicking a friendly ship selects it for fleet orders. Newly launched ships are omitted from rendering until their first positioned naval update, avoiding a render-loop exception when building while paused. tools/classic-naval-menu-review.js checks port roof picking, menus in both art modes, movement dispatch, battleship purchases, paused rendering, subsequent ticks, resource availability and browser errors. No combat rules changed.

Final local attack measurements (medium-attack-performance.json): 1178 frames and 198 simulation ticks over 20.2 seconds at scale 10 / 1600×1000, with two intervals above 50 ms. At 2200×1200 / DPR 1.5: 612 frames over 12 seconds, with four intervals above 50 ms. Occasional 300–317 ms spikes remain; these short runs are not hardware qualification. Naval interaction, classic integration, engine/query validation, rendering contracts, syntax and production build were checked.

## Traveling sight and fog return (1.10.43)
Friendly troop transports, merchant ships, active aircraft, spy planes and repair trucks now contribute direct vision at their current position. Existing fleet/patrol/radar ranges remain; radar ships additionally retain close direct sight under jamming. Ordinary mobile sight is 10 tiles, repair trucks 6. Vision is shared with allies using the existing friendship rule.

Terrain fog fades back over 20 simulation ticks (two seconds), immediately clears when sight returns, freezes while paused, and resets with the match. The fading buffer is presentation-only: current fog still controls enemy actor visibility and order validation. Both strategic raster and classic close-up overlay use the fade. A real transport-crossing browser check verifies reveal, loss, partial opacity, full fog return and render purity. Full npm test passed including replay/restart, parity and DETERMINISTIC; fog/terrain tests, scene integration, syntax and build passed.

## Credits reconstruction (1.10.44)
Reproduced canonical divergence at tick 100: reset cleared the selected country, so the France fixture restarted as Thailand. The credits path now captures replay settings before reset and reloads them afterward, preserving country/custom identity and match options. Saved-credit loading follows the same reset-before-load order. The local sail-loop controller is suppressed during replay. The regression reconstructs 301 ticks with exact canonical equality, both with 11 setup orders and with 104 recorded loop orders. Existing Chromium credits-reset test, replay checker, syntax and production build pass.

## Credits pacing (1.10.45)
Accelerated credits previously ran up to 15 ticks in one 100 ms timer callback. Credits now advance one tick per opportunity on an 8 ms timer, with due-time pacing and no accumulated burst after a stall. Ordinary play retains its 100 ms cadence and standard replay speed controls. Credits interpolation accounts for requested playback speed. On the local 15x stress case, scrolling improved from 164 frames/6.20 s to 319 frames/6.01 s; p95 dropped from 66.8 to 16.8 ms and intervals over 50 ms from 18 to 2. The replay advances more slowly under load (244 versus 720 ticks in those windows); no commands/ticks are skipped, and the existing end-of-credits catch-up remains. Occasional single-tick spikes remain. Exact 301-tick credits reconstruction with and without the sail loop, syntax and build passed.
