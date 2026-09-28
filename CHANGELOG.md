# Changelog

## 1.10.50 — Custom flag startup fix

- Accept the optional null emblem accent already supported by WordPress flag validation. Preserve rejection of null in every other layer position.
- Cover custom player and opponent flags, deterministic start and checkpoint restoration, and authenticated WordPress startup using synthetic flags.
- Require plugin 1.10.9 for physical asset URLs on static-file hosts.

## Plugin 1.10.9 — Static hosting correction

- Use physical release URLs in uploads for startup scripts, styles, artwork and workers. The virtual /play/releases route returned 404 on the live host even though the installed files existed.
- Exercise plain /play/ and a static-file host model that rejects virtual asset paths in the exact-package browser gate.

## Release qualification — 28 September 2026

- Retain loading-budget provenance and qualification history.
- Trace the historical 0.9 MB limits, record measured startup and the approved replacement policy, and reconcile current classic-art status with historical modernization evidence.
- Document reviewed local checkpoints and release-specific artwork acceptance; all required local qualification gates pass for 1.10.49 / plugin 1.10.8.

## 1.10.49 — Release performance fixes

- Show loading status and prevent inactive controls during startup; offer a working retry after loading failures. Keep production preload helpers independently fingerprinted for reproducible builds.
- Remove repeated coordinate work and direction branching from capture fronts while preserving tile insertion order and random-number consumption.
- Avoid Canvas state writes for offscreen effects; pixel-equivalence checks include screen-edge overlap.
- Isolate changing development Pixi support graphics into a render group to reduce GPU-upload stalls; production remains classic Canvas.
- Adopt Ken-approved cold-network startup gates: 15 seconds at 25 Mbps and 40 seconds at 10 Mbps, with all other release limits retained.

- Harden local artifact checksum verification and Docker cleanup after crashed or unresponsive Desktop processes.

## Plugin 1.10.8 — Stable asset URLs

- Prevent WordPress canonical redirects from appending slashes to game asset URLs, which breaks relative imports, artwork and workers in split builds.
- Verify the current plugin ZIP by version and checksum during release qualification.

## 1.10.48 — Classic production candidate

- Include the classic terrain, full unit roster and building upgrade artwork in the production game by default; keep coastal test controls and development bridges out of the release. Require plugin 1.10.8 for correct immutable asset URLs.
- Preserve scores rejected by an expired WordPress nonce and retry after refresh; permanent score validation and signature failures remain non-retryable.
- Bind artifact verification to the newly built ZIP checksum/version/build instead of a stale 1.10.11 package; check release-relative artwork and worker paths through WordPress.

## 1.10.47 — Upgrade audit and visual tiers

- Add distinct classic artwork for level II ports and airfields, and level II/III bastions; fit cruise battleships with visible deck launchers.
- Fix instant battleship refits ordered at tick zero, show accurate refit timing, and display six hangar slots for upgraded airfields.
- Audit upgrade ownership, costs, timers, limits and unlocks with regression coverage.
- Keep ship-center right-click orders accessible where upgraded port artwork overlaps newly launched ships.

## 1.10.46 — Complete classic roster and simulation qualification

- Show submarine-base prerequisites in build menus and placement previews, offer construction from coastal water, and display the actual port upgrade timer.

- Fix replay catch-up timer races and defer obscured battlefield painting during loading.
- Advance classic smoke lifetimes independently of frame rate and composite full-resolution attack fronts off the display thread.

- Saved-game catch-up updates its loading progress without rasterizing obscured battles or rebuilding hidden sidebar lists; live controls and terrain refresh when loading completes.

- Classic terrain now builds in a bounded background worker with camera overscan, copied inputs, timeout recovery and synchronous fallback. Offscreen smoke/spark draws are culled without changing visible pixels. Worker timing samples are bounded.
- Checkpoint restoration accepts previously allocated garrison origins retained by attacks and transports after area merges, while rejecting malformed and never-issued IDs atomically.

- Add fixed-camera, eight-direction artwork for all 16 mobile unit types and complete the 20-building classic roster. Blend direction changes and interpolate moving support units. Classic art remains an opt-in development preview.
- Repair trucks return home after completing repairs or exhausting repair funds. Exhausted Risky drafts skip unavailable human picks. Surviving upgraded buildings retain their ground after bombardment.
- Keep ship, aircraft, and map calculations identical across browser engines using portable historical math; preserve historical Node reference replay bytes rather than rounding checksums.
- Bound high-frequency tile-capture, attack-start and HUD event payloads so fragmented garrison fronts do not repeatedly copy entire player graphs. Keep event snapshots immutable.
- Index fragmented garrison areas, batch exact-order combat troop totals, narrow fort queries to the active combat pass, and check AI placement distance before building spacing. Add eager-reference and cache-invalidation regressions.
- Reduce replay checkpoint stalls with identical-output SHA-256 arithmetic and byte-validated typed-buffer serialization caching. Optimize fog boundaries and garrison traversal without changing their results.
- Avoid quadratic polygon closure on fragmented attack fronts and repeated full-area scans in the garrison sidebar. Preserve rendered pixels and exact labels with browser/reference regressions.
- Add reusable Cartesian simulation, extended campaign, full-roster, and artwork qualification harnesses with canonical replay verification and stall watchdogs.

## 1.10.45 — Smooth credits playback

- Spread accelerated credits replay over individual timer callbacks instead of blocking the UI with up to 15 simulation ticks per burst. Adjust presentation interpolation to the credits playback rate; retain ordered replay and exact target completion.

## 1.10.44 — Credits replay setup

- Restore recorded country identity and match settings after the credits reset, avoiding canonical divergence at the first checkpoint.
- Reset before loading saved credits and suppress the local sail-loop controller during replay.

## 1.10.43 — Traveling vision and returning fog

- Friendly transports, merchants, trucks, traveling aircraft and spy planes reveal nearby terrain; radar ships retain direct sight under jamming.
- Terrain fog returns over two simulation seconds after sight leaves, pauses with the match, and clears immediately on reacquisition. Entity visibility and targeting still use current authoritative sight.

## 1.10.42 — Owned transport visibility

- Keep player-owned troop transports and their traveled routes visible through fog in both Canvas and Pixi; foreign transports retain fog checks. No terrain reveal or simulation changes.

## 1.10.41 — River water color

- Replace pale green river highlights in the zoomed-out terrain raster with muted blue-gray water; preserve river topology and gameplay.

## 1.10.40 — Naval menus and test resources

- Skip drawing newly launched ships until their first positioned naval update, preventing the battleship-build rendering freeze.
- Restore water/ship menus through the validated nearest-port query; resolve port artwork at right-click time and select a directly clicked friendly ship.
- Start the local coastal test scene in existing Billionaire mode for ample player troops and gold; performance stress tests retain standard resources.

## 1.10.39 — Medium-zoom attack rendering

- Merge uniform territory interiors into row runs and visit only frontier-adjacent cells for attack contours. This removes the Path2D bottleneck during medium-zoom attacks without changing simulation rules.

## 1.10.38 — Command and camera stalls

- Bulk-copy trusted in-memory rollback graphs instead of encoding and decoding save checkpoints for every command; retain external checkpoint validation and rollback semantics.
- Add a bounded overscan cache for local candidate scenery so small camera pans reuse the terrain image.

## 1.10.37 — Smooth candidate turns

- Interpolate destroyer headings over the shortest angular path between simulation updates and use a full-sector eased directional-art blend.

## 1.10.36 — Directional destroyer candidate

- Add eight fixed-camera destroyer views with aligned hull anchors and short heading crossfades; replace the oversized wake with a narrow stern trail. Add a local Sail loop control issuing ordinary movement commands, with all eight headings verified in a real lap.

## 1.10.35 — Candidate live play

- Separate live fog/ownership overlays from detailed scenery, scope site invalidation to the viewport, and skip unused full-map raster updates at tactical zoom. Replace square territory edges and attack tiles with continuous contours in the local candidate.

## 1.10.34 — Coastal ground study

- Refine the opt-in battlefield coast with interpolated shoreline contours, shallows, worn foundations and visible-land service roads. Cache static scenery and invalidate on fog, ownership, sites and camera changes. Simulation and default artwork remain unchanged.

## 1.10.33 — Local classic battlefield candidate

- Add an opt-in Canvas sprite-art study in the real game, with a commanded coastal example, authored military sprites, cosmetic terrain detail, faction recoloring, and close inspection zoom. Default artwork and simulation baseline remain unchanged.
- Candidate review only; no deployment or final-art approval.

## 1.10.32 - 2026-09-20

- Translated approved Terrain Direction 02 into a deterministic shared 4x terrain source with discrete strategic/operational ownership, Canvas high-quality image smoothing, Pixi linear sampling, and bounded static/composite caching. Ken approved candidate commit `27a2389` as the final in-game F2 terrain on 2026-09-20 by stating `approved proceed`; terrain-affected Canvas goldens are accepted locally. No Phase G row, package, release, or deployment is approved.

## 1.10.31 - 2026-09-19

- Added the bounded Phase F1 candidate shared map-resolution raster: deterministic cached water/coast/river/relief underpaint plus terrain-preserving ownership, allied/hostile borders, suppression, pick/highlight, and fog composition for the existing Canvas source and Pixi nearest texture.
- Exact value snapshots skip unchanged composites and uploads, including irrelevant coarse ticks; `suppressTicks`, teams, and every visual input participate in invalidation, while reset/restart invalidates both caches. Pick-mode exits immediately remove paused pick-area highlighting. Added direct semantic pixel fixtures and complete tracked/untracked source-manifest verification. CVD review uses an explicit measured closest-palette boundary fixture. This is production visual candidate work pending human review, not final art, a golden update, a release, or approval. Phase F remains open; plugin 1.10.7 and simulation baseline 1.10.8 are unchanged.

## 1.10.30 - 2026-09-19

- Completed the local Phase E technical gate with a renderer-neutral `statefall-atlas/v1` manifest and isolated development Pixi registry for future Phase G authored atlases. Validation covers relative same-origin paths, schema/version, dimensions, source bytes/MIME, unique nonoverlapping integer frames, scale/anchor metadata, hard caps, atomic fallback, refcounts, LRU eviction, teardown/context reset, and diagnostics. Synthetic Canvas atlas tests prove real Pixi subtextures at DPR 1/1.5/2 without adding art.
- Added repeatable headed Chrome/Edge physical-GPU qualification on named Windows hardware. Both browsers passed 1,800 real RAFs over at least 60 seconds after warm-up, canonical purity, resource stability, GL/context checks, CPU submission p95/p99 gates, and reliable disjoint GPU timing. RAF pacing is reported separately and is not claimed as 60 Hz.
- Phase E is technically complete locally, not released or handed off. Canvas remains production/default and production has no Pixi/atlas loader graph or atlas/network load. Authored atlases/unit art remain Phase G work subject to the human art gate; Statefall Landings remains a separate product decision.

## 1.10.29 - 2026-09-18

- Added bounded Phase E17 development-only Pixi ownership of the exact final Canvas rendering block after E16 `49967b0`: the garrison pick label, drag-selection box, draft banner, paused scrim and labels, and build cursor retain source order, conditions, screen/world coordinate formulas, snap/validity decisions, strings, fonts, strokes, fills, alpha, inherited dash/composite state, and final frame state.
- One immutable presentation descriptor captures pointer/input-derived values once per top-level frame. A pure renderer-neutral model provides full bounds/culling, stable semantic keys, emitted-dash accounting, hard reject-not-truncate entry/primitive/segment/label/character/container/Graphics/sprite/texture/source-byte caps, vector Graphics, and cached current-browser Canvas-raster labels. Any E17-only failure withdraws the complete slice and directly paints the uncapped Canvas block over retained Pixi notifications; fatal submission remains one synchronous nonadvancing full-Canvas replay. Pixi remains noninteractive and the aligned Canvas stays mounted for input.
- The visual-layer migration is complete through the end of the legacy frame. Phase E remains open for atlas/loading policy and final physical-GPU/hardware qualification. This is not final art; plugin 1.10.7 and simulation baseline 1.10.8 are unchanged.

## 1.10.28 - 2026-09-18

- Added bounded Phase E16 development-only Pixi ownership of the exact notification-overlay block after E15 `ef5633e`: credits, nuclear alerts, the song banner, and badges/notices retain source order, viewport anchoring, timing, fades, pulses, controls, styles, and Canvas state handoff. Pick, selection, draft, pause, and build-cursor overlays remain Canvas-owned above it.
- Added once-per-frame notification preparation at its legacy late-render boundary, preserving queued age-zero badge audio, same-frame age/alpha, and credits camera chronology. World layers use the frame-start camera; fatal final-submit replay restores that camera for world paint and reapplies the cached once-advanced credits camera only at notifications. Pixi ownership explicitly maps only compositionally equivalent transparent-preraster modes (`source-over` to `normal`, `lighter` to `add`). Destination-dependent and unknown modes reject before allocation and paint directly over the populated main Canvas. Every offscreen creation, context, resize, state, paint, capture, source, texture, update, and append failure withdraws only E16, releases partial resources, paints notifications directly in the same frame, and retries later while retaining E15 ownership. Canvas/default paints directly without allocating the raster; plugin 1.10.7 and simulation baseline 1.10.8 are unchanged.

## 1.10.27 - 2026-09-18

- Added bounded Phase E15 development-only Pixi ownership of the exact contiguous world-annotation block after E14 `de15e58`: the opening ring and label, zoomed-out region names, hovered owned/allied SAM site and ship network ranges, and the network summary retain source order, conditions, formulas, owner/fog/hover rules, geometry, dashes, styles, strings, and Canvas state handoff.
- A pure renderer-neutral model uses stable semantic/tile/ship/region keys, measured ink-overhang/crossing bounds, vector Graphics, and bounded Canvas-raster labels. Transactional refcounts preserve matching and recently unused text/DPR variants, deterministic age/idle limits remove stale zero-reference entries, and texture/source-byte pressure evicts least-recently-used zero-reference entries before allocation. Cumulative raster/allocation/reuse/destruction/eviction diagnostics are separate from live resource counts. Any annotation-only failure withdraws the complete block and direct uncapped Canvas paints it after valid Pixi nation overlays; fatal replay remains one nonadvancing frame.
- This remains migration art, not final art. Phase E remains open for alerts/UI overlays, atlas/loading work, and physical-GPU/hardware qualification. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged; no ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.26 - 2026-09-18

- Added bounded Phase E14 development-only Pixi ownership of the exact contiguous nation-overlay block after E13 `a1b1c39`: nation and neutral names, color marks, troop counts, procedural flags, fresh-alliance handshakes, heartbreak marks, team outlines, and painted `ALLY`/`PACT` glyphs retain exact cross-player Canvas chronology, conditions, formulas, transformed geometry, and final marker handoff.
- A pure renderer-neutral model uses stable player keys, measured full-group bounds, hard reject-not-truncate entry/label/character/primitive/segment/container/sprite/texture/source-byte caps, and bounded zero-reference texture eviction. Canvas-raster player groups preserve current-browser font-baseline behavior and exact procedural flag/text pixels; the extracted handshake and broken-heart painters retain their original geometry. Any E14-only failure withdraws every nation overlay and invokes the direct uncapped Canvas block after valid Pixi effects; fatal replay remains one nonadvancing frame.
- This remains migration art, not final art. Phase E remains open for opening/region/SAM-network markers, alerts/UI overlays, atlases/loading, and physical-GPU/hardware qualification. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged; no ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.25 - 2026-09-18

- Added bounded Phase E13 development-only Pixi ownership of the exact contiguous global-effects block after E12 `058051f`: scorches, sparks, smoke/puffs, fragments/bombs, tracers, wrecks, and flashes retain category/array/primitive order, formulas, styles, trajectories, rotation, fog rules, age/lifetime/pruning, and Canvas state handoff. Nation/global labels remain Canvas-owned above it.
- Moved all render-time effect advancement into one same-frame-idempotent presentation transaction. It retains one per-frame fog descriptor: hidden wrecks still age and expire at the legacy point but hidden air wrecks do not create threshold smoke, and retry/replay cannot recalculate visibility or create a second puff. A pure WeakMap-identity vector model provides complete crossing bounds and reject-not-truncate category/total/trail/primitive/segment/container/Graphics caps; any E13-only failure withdraws every category and invokes the direct uncapped Canvas painter after valid Pixi floaters. Fatal submit replay remains one nonadvancing frame.
- This remains migration art, not final art. Phase E remains open for nation/global labels, markers/network, UI overlays, atlases/loading, and physical-GPU/hardware qualification. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged; no ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.24 - 2026-09-18

- Added bounded Phase E12 development-only Pixi floating text after E11 `4bc1cb5`. Exact source order, text conversion, colors, big/small fonts and lifetimes, stroke/fill/alignment/baseline, age-driven rise/bob/fade formulas, pruning, and Canvas state handoff are retained; scorches, sparks, smoke, global effects, and all later labels remain Canvas-owned above it.
- Moved render-time floater age/pruning into one renderer-neutral, same-frame-idempotent presentation update. A pure WeakMap-identity model feeds bounded Canvas-raster sprites; legacy per-operation alpha is baked into style/text/font/DPR textures, stale fade variants are promptly evicted, and position uses sprite transforms without entering cache identity. Reject-not-truncate entry/label/character/source-byte/texture/container/sprite caps fall back to the direct uncapped Canvas painter.
- This remains migration art, not final art. Phase E remains open for global effects, later labels/selection, atlases, and physical-GPU/hardware qualification. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged; no ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.23 - 2026-09-18

- Added bounded Phase E11 development-only Pixi support actors after E10 `3d40023`: repair trucks with work progress, spy planes with owned orbit ranges, and defensive interceptors with ordered trails and bodies preserve exact collection/category/child order, raw stepped positions without new smoothing, fog/ownership exceptions, geometry, heading, colors, formulas, and Canvas state handoff. Floating text and every later effect/label remain Canvas-owned above them.
- Added one pure renderer-neutral vector model with WeakMap source identity plus occurrence keys, complete crossing bounds, and reject-not-truncate entry/trail/primitive/segment/container/Graphics caps. Ownership requires every layer through map labels; any prerequisite or support-only failure withdraws all three categories and directly paints the complete uncapped Canvas block after valid Pixi labels. Fatal submission retains synchronous full-Canvas replay.
- This remains migration art, not final art. Phase E remains open for floating text/effects, global labels/selection, atlases, and physical-GPU/hardware qualification. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged; no ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.22 - 2026-09-18

- Added the bounded Phase E10 development-only Pixi draft/garrison label slice after E9 `a4b6f33`: draft flags, pick badges, owner names, and own garrison counts preserve legacy array/area order, draft visibility and fade, player mapping, flag glyphs, exact text and zoom/area thresholds, hover styles, alphabetic baseline placement, and Canvas state handoff. Repair trucks and every later actor/effect remain Canvas-owned above it.
- Added a pure renderer-neutral model with stable semantic owner/pick and player/area keys, duplicate rejection, conservative culling, and reject-not-truncate entry/label/character limits. Bounded Canvas-raster texture sprites use measured actual bounding boxes at current DPR, explicit source-byte accounting, refcounted style/text/font/DPR cache keys, and bounded zero-reference eviction; Pixi Text remains unused and GPU bytes remain unknown.
- Draft fade alpha is rasterized separately into every legacy flag/text operation and included in cache identity while sprites remain at alpha 1; obsolete zero-reference fade textures are promptly destroyed and stable garrison textures remain reusable. Ownership requires every prerequisite through aircraft. Label model, measured font/source, byte/texture/container/sprite cap, constructor, raster, child append, final parent append, prerequisite, or context failure withdraws the complete E10 block and direct uncapped Canvas paints it after valid Pixi aircraft in the same frame. Font/glyph checks are current-browser baseline evidence, not a cross-hardware fallback/tofu guarantee. No final art, ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.21 - 2026-09-18

- Added the ninth bounded slice, Phase E9 development-only Pixi main aircraft after E8 `db6ab09`: stable-ID fighter, bomber, and carrier silhouettes retain interpolation, heading, bomber pull, faction color, own/fog visibility, own fighter patrol/hover rings, ceil-equivalent HP pips, exact array/child order, and Canvas state handoff. Hangar/refuel/heal remain omitted as before; draft/garrison labels, repair trucks, spy planes, interceptors, and all later layers remain Canvas-owned above aircraft.
- Aircraft ownership requires every prerequisite through missiles. Aircraft-only model, cap, constructor, paint, append, or prerequisite failure atomically withdraws the complete aircraft layer and invokes the direct uncapped Canvas-equivalent painter after valid Pixi missiles; fatal submission still uses the E7 synchronous full-Canvas replay policy. Input and list hover remain on the Canvas/controller path, Pixi remains noninteractive, and no final art or texture atlas is approved.

## 1.10.20 - 2026-09-18

- Added the bounded Phase E8 development-only Pixi missile slice after E7 `c6b2089`: normal silo/nuclear and cruise missiles preserve missile-array order, exact analytic arc/straight positions, historical trail sample ages, body heading and cruise scale, current-point fog/owner visibility, target radius, warning pulse from the shared frame timestamp, and Canvas stroke-state chronology. Main aircraft and every later layer remain Canvas-owned above it.
- Added a pure renderer-neutral model with WeakMap source identity and occurrence keys, full trail/body/ring viewport bounds, and reject-not-truncate entry/trail-sample/primitive/segment/container/Graphics caps. Ownership requires every prerequisite through projectiles; missile-only failure atomically withdraws all missile resources, Canvas paints the complete block in the same frame, and valid updates retry.
- Added pure formula/order/visibility/pulse/handoff/cap/immutability contracts; real isolated Pixi and Canvas fallback evidence at DPR 1/1.5/2; fail-after-paint/append, prerequisite, identity, reset/fatal-replay coverage; and labeled 1,800-frame synthetic churn. The final focused local synchronous submission soak measured p95 0.6 ms and p99 1.0 ms; heap remains advisory and GPU allocation bytes are unknown.
- This remains migration art. Phase E is open for main aircraft, later actors/labels/effects, atlases, and physical-GPU/hardware qualification. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged; no ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.19 - 2026-09-18

- Added the bounded Phase E7 development-only Pixi projectile slice after E6 `7cd64f4`: torpedo foam/body, AAM trail/body, arcing barrage rocket/trail, arcing artillery shell/ground tether, ordinary gun-shell trail/body, and short visual gun lines preserve legacy array/category/primitive order, stepped positions, fog decisions, height-bearing trails, arc/rise/delay/total formulas, styles, and inherited Canvas cap chronology. Strategic/cruise missiles and all later layers remain Canvas-owned above it.
- Added a pure renderer-neutral bounded model with WeakMap object identity, deterministic occurrence keys, renderer-owned arc-total fallback cleanup, crossing-geometry culling, immutable visual-shot frame descriptors, and reject-not-truncate entry/trail/primitive/segment/container/Graphics caps. Visual shots age and prune once per displayed frame before either backend, including Pixi failure fallback.
- Projectile ownership requires complete structures, naval logistics, and warships. Model, cap, constructor, paint, append, prerequisite, or context failure atomically withdraws every shell and visual shot, preserves valid Pixi warships, paints the complete Canvas projectile block in the same frame, and retries later without dirty resources or ghosts.
- This remains migration art. Phase E is open for strategic/cruise missiles, main aircraft, later layers/effects, atlases, and physical-GPU/hardware qualification. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged; no ZIP, Docker, commit, push, production access, or deployment is included.

## 1.10.18 - 2026-09-18

- Added the bounded Phase E6 development-only Pixi warship/submarine block after E5 naval logistics. All eight classes preserve array and child order, stable simulation identity, interpolated display input, fog/sub-detection decisions, class radii, owner ranges, selection/destination, wakes or submarine alpha, tick-derived lean/recoil, hull details and ceil HP pips, muzzle flash, refit arc, CM raster badge, and barrage cooldown. Canvas cap state advances exactly in visible warship-array order: pre-wake work uses the incoming cap, qualifying surface wakes transition subsequent work to round before culling, submarines and short/hidden wakes do not transition it, and retained Canvas layers receive the final cap.
- Added a pure renderer-neutral model with hard entry/wake/primitive/segment/label limits, crossing-geometry bounds, reject-not-truncate behavior, exact retained-Canvas stroke-state handoff, and duplicate/missing-ID rejection. Dedicated bounded pools reserve before attach and discard dirty partial resources.
- Warship ownership now requires complete structures and naval logistics in the same frame. A warship-only model, cap, constructor, paint, source, or context failure withdraws every warship and restores the complete Canvas warship block after valid Pixi naval logistics; retained Canvas shells stay above it and the next valid frame retries.
- Added pure and browser evidence for every class/status, exact chronological cap order, ID and cap failures, dependency fallback, rollback recovery, CSS-pixel DPR coverage, inherited butt/round selected-ring and cruiser-detail endpoints, and 1,800-frame class/color/state/selection/fire/HP/wake/cull/reorder churn. The corrected full-browser run measured local synchronous CPU/render-submission p95 3.6 ms and p99 14.5 ms; heap evidence is advisory and GPU bytes are unknown.
- Phase E remains open for shells/projectiles, missiles, aircraft, later layers/effects, atlases, and sustained physical-GPU/hardware qualification. No final art, plugin, baseline, production, ZIP, Docker, deployment, commit, or push is included.

## 1.10.17 - 2026-09-18

- Added the bounded Phase E5 development-only Pixi naval-logistics prefix after the complete E4 structure graph: each transport remains in array order with route, wake, hull, optional heavy HP, and zoom-gated troop label; merchants retain wake then hull/cargo; privateer boarding lines remain last. Canvas warships and all later layers still composite above Pixi.
- Added a pure renderer-neutral model with exact stepped positions, route sampling every eight path entries, legacy fog inputs, owner colors, heavy geometry/HP, Canvas alphabetic label semantics, complete route/wake/line bounds, shared CSS-pixel antialias margins, crossing-geometry culling, and hard entity/path/wake/primitive/segment/label/resource limits.
- Added bounded WeakMap-identity container, Graphics, and canvas-raster label pools. Naval ownership reserves resources atomically and withdraws to the complete same-frame Canvas prefix on structure, model, cap, constructor, source, or context failure; partially mutated Graphics/labels are discarded with live accounting decremented, and containers return to idle only after reset. The existing structure pools now use the same transactional rule. Valid Pixi structures remain owned when only naval logistics fails. Hulls use exact legacy vector joins: transport is locally rounded while merchant inherits global miter. Generated hull texture references are explicitly zero; GPU allocation bytes remain unknown.
- Added pure and focused browser evidence for geometry/order/fog/zoom/heavy/HP/caps/immutability, semantic pixels, exact merchant miter and inherited boarding-cap state including viewport-culled wakes, invalid paint and injected fail-after-mutation fallback, retained Canvas warship ordering, identity under reorder/compaction, reset/BFCache/context-loss recovery, DPR 1/1.5/2 miter-only corners and butt/round dash endpoints, and 1,800-frame create/remove/reorder/state/visibility churn. The recorded local p95 4.0 ms and p99 12.1 ms are synchronous CPU/render-submission measurements, not GPU/compositor/display latency; heap samples are advisory and GPU bytes are unavailable.
- Phase E remains open for warships, projectiles, aircraft, later labels/effects, atlases, and sustained physical-GPU/hardware qualification. No final art, plugin, baseline, production, package handoff, deployment, commit, or push is included.

## 1.10.16 - 2026-09-18

- Added the bounded Phase E4 complete ordered structure scene to the development-only `pixi-hybrid` renderer. Every tile-keyed pooled entry now interleaves pooled `Graphics`, the generated legacy base `Sprite`, and pooled canvas-raster label `Sprite` resources in the exact per-structure legacy order.
- Migrated building, upgrade, airfield/ship queue, and cooldown arcs; countdown/queue labels; pop and linked rings; level labels; suppressed X marks; and all remaining structure-only marks. Zoom, fog, quality, reduced-motion, camera/DPR, and input behavior remain presentation-equivalent, while Canvas retains later mobile entities, effects, labels, selection, UI, and input.
- Removed the active E3 split-canvas conflict fallback because complete structures now share one Pixi scene graph. Model, primitive, segment, entry, sprite, texture, text-cap, text-resource, source, and context failures still atomically withdraw ownership and synchronously draw the full legacy Canvas sequence.
- Added pure ordered-item/cap contracts and browser coverage for actual child order, level III's historical `stroke II` then `fill III` behavior, Canvas alphabetic baselines, real game states, constructor failures and cap-one recovery, lifecycle/context loss, every map and major mode, DPR 1/1.5/2 overlap pixels, reduced motion, quality, render purity, and 1,800 frames of real state/visibility churn. The churn fixture plateaued at 11 entry records, 23 graphics chunks, 17 label texture/sprite resources, and 27 generated base textures; Pixi text-cache references remained zero. Heap samples are advisory and no no-growth claim is made.
- Preserved every Canvas golden and the approved simulation hashes. Full browser verification passed 91 tests with 143 intentional project-selection skips; DPR passed 15/15; reproducibility matched 24/24 outputs with release-manifest SHA-256 `88914d42f05acc5e279791218a16e3b9e588311917d5b39bcae2181466eb7f97`. Production remains Canvas-only with no selectable Pixi graph or Pixi JavaScript chunk. No art approval, plugin change, package handoff, production access, or deployment occurred.

## 1.10.15 - 2026-09-18

- Added bounded Phase E3 pre-structure compositing to the development-only `pixi-hybrid` renderer. In scenes proven safe, two fixed global `Graphics` objects draw fronts and routes and each bounded tile-keyed structure entry owns one pooled pre-base `Graphics` and one pooled base `Sprite`.
- Added a renderer-neutral, deterministic presentation model with geometric viewport culling, 65,536 conceptual-primitive and 131,072 emitted-Graphics-segment limits, supplied presentation time, shared dash generation, and atomic pre-layer/structure fallback. Model accounting is the exact length of the immutable segment arrays consumed by Pixi, and cap failure occurs before drawing.
- Added source-default high quality plus guarded development/test `high|medium|low` route density controls. A renderer/controller motion policy supplies monotonic time normally and time `0` under reduced motion to both Pixi and every E3 Canvas fallback; route markers, route/focus dash phase, front pulse, and low-shield pulse then remain present but frozen. Diagnostics expose requested/effective quality, effective motion policy, exact counts, bounds, ownership, order, and failure reason.
- Added conservative bounds for every retained Canvas post-base mark and every later Pixi pre-base primitive/range/base. Structure base bounds use `max(r + max(1.5, 0.18r) / 2, typeExtent) + max(1, r / 24) CSS px`, where the final term safely scales generated-texture antialiasing and audited `typeExtent` is `1.13r` for the engineering-command hook, `1.12r` for the Bertha flare, and `r` otherwise. The same helper drives culling, conflicts, diagnostics, and edge tests. Any possible overlap synchronously withdraws all pre-structure and structure ownership for that frame, clears active Pixi entries, and renders full legacy Canvas order; diagnostics distinguish this from culling and resource limits and safe frames retry automatically.
- Added pure and browser coverage for generated segments and cap boundaries, exact stroke/AA edge culling and conflicts, safe ownership, fog-hidden missile focus pixels, explicit Canvas/Pixi focus phase at two times with supply present/absent, conflict/full-Canvas pixel parity, live normal/reduced conflict fallback, build/upgrade/queue text and rings, pop/level/suppression/linked/cooldown conflicts, crossing ranges, recovery, quality, reduced motion, real rasterized scaled-texture fringe at DPR 1/1.5/2, cap/Graphics/context fallback purity, lifecycle bounds, all maps/modes, Canvas goldens, and production Pixi exclusion. The dense Canvas golden intentionally changes because E3 now explicitly normalizes `lineCap`, `lineJoin`, dash offset, and dash phase; its 8,177 changed pixels are 0.797% of 1,026,000 pixels, with no tolerance weakening, while every other Canvas golden is unchanged. No art, simulation behavior, plugin, production, package handoff, or deployment changed.
- E3 preserves legacy ordering through Pixi where safe and through synchronous Canvas fallback where split-canvas ordering could differ. It does not close the migration: unconditional structure ownership requires migrating all post-base overlays or using a unified scene graph.

## 1.10.14 - 2026-09-18

- Added the bounded Phase E2 structure-base migration to the development-only `pixi-hybrid` renderer. Pixi now owns visible structure base icons while the transparent Canvas retains every shield, range, health, repair, build, upgrade, queue, level, linked, suppression, text, and input overlay in legacy order.
- Reused the existing `drawIcon` Canvas routine through an injected texture-canvas callback; no icon art was copied, rewritten, or approved as final art. Type and owner color identify the bounded generated-texture registry, with source validation, linear sampling, byte estimates, and reset/destroy/context-loss cleanup.
- Added a dedicated structure container, stable tile-keyed sprites, viewport/fog/zoom culling, a bounded 4,096-sprite live allocation with a 512-sprite idle pool, a 512-texture registry, atomic frame ownership fallback, building alpha/pop scale parity, and ownership/resource diagnostics.
- Added pure culling/key/pool contracts plus dense-scene semantic pixels, direct sprite alignment/hit targeting, sprite/texture-cap fallback, churn/eviction/reset, zoom/pan recycling, DPR, lifecycle, renderer-purity, and production-exclusion coverage. Canvas remains the default and production renderer; production has no Pixi module/chunk. E3 addresses the temporary hybrid line/base difference with safe-scene ownership and full-Canvas conflict fallback, not an unconditional closed migration. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged.
- This is E2, not Phase E completion, a release, a handoff, or final-art approval. E1 was implemented in `4361ad7` and documented in `e5c4228`.

## 1.10.13 - 2026-09-18

- Added the first bounded Phase E renderer foundation: renderer-neutral CSS-pixel camera and DPR-capped viewport services, a lifecycle/diagnostics interface, the unchanged default Canvas path, and a development/capture-only `pixi-hybrid` path.
- Pinned PixiJS 8.21.0 as an application dependency. Pixi renders the existing 720x414 terrain/ownership/fog raster as one nearest-neighbor texture beneath the transparent legacy Canvas overlay; entities, effects, selection, UI, and input remain Canvas-owned.
- Added DPR 1/1.5/2 backing stores, resize-center focus preservation, centralized coordinate conversion, bounded renderer fallback diagnostics, raster build/upload counters, camera/viewport unit contracts, dual-renderer simulation/input purity coverage, and a production query/tree-shaking contract.
- This is not Phase E completion, final art, a release, or a handoff. Production builds ignore `renderer=pixi`, retain Canvas, and omit the Pixi renderer chunk and guarded test bridge. Plugin 1.10.7 and simulation baseline 1.10.8 are unchanged.

## 1.10.12 - 2026-09-18

- Added the first bounded Phase D2 proof slice: explicit deterministic multi-human setup, a browser-free transport-agnostic relay room core, fixed delayed lockstep turns, seat/generation authorization, idempotency IDs, deterministic turn sealing, per-batch outcome consensus, exact-byte checkpoint consensus, and checkpoint-v2 recovery through sealed batch suffixes.
- Added a lockstep/recovery driver and Node proof covering a two-human no-bot duel for more than 400 ticks, state-invalid command continuation, arrival/property-order independence, frozen disconnect requirements, adversarial checkpoint/suffix rejection, terminal desync, strict resource bounds, and exact canonical/RNG/command recovery.
- Deferred and centrally rejected multi-human Risky mode until its draft protocol is defined; single-human Risky behavior and approved hashes remain unchanged.
- Added a localhost-only Node `ws` relay transport and an unwired pure-browser client. The Chromium source proof runs two isolated browser contexts through ready/start, deterministic command ordering, checkpoint consensus, ack timeout/resume, checkpoint-plus-suffix replacement recovery, terminal desync, and bounded hostile wire cases.
- Completed the minimal Phase D2 technical gate in build `2026-09-18-phase-d2-lockstep-proof`: capability-gated multi-human engines, canonical room fingerprints, terminal/pause lifecycle consensus, unresolved checkpoint reconnect, deterministic surrender in both directions, final evidence consensus, byte-identical shared replay export, fresh imports, and official replaycheck verification. This adds no lobby, auth/token integration, room secrets, chat, production hosting, general N-human/bot outcome policy, disconnect-to-bot, multiplayer UI, abuse operations, observability, deployment, or release package.
- Retained plugin 1.10.7 and the approved 1.10.8 simulation baseline. Existing single-player behavior and fixtures remain unchanged when `settings.humanSeats` is absent.

## 1.10.11 - 2026-09-18

- Repository-only Phase D candidate; verified locally but uncommitted, not handed off, and not deployed.
- Completed the browser-free engine boundary: isolated authoritative state, setup/map generation, command/replay routing, match flow, world systems, full graph checkpoints, read-only presentation/query views, immutable event delivery, detached render buffers, non-authoritative interpolation frames, and detached/frozen replay API results with no production authority return leaks in the final audit.
- Replaced the source-rewriting/evaluating Node harness with direct engine imports and added interleaved-engine isolation plus old-versus-extracted parity evidence across 7 scenarios from `ad30188`.
- Preserved canonical v1's virtual `labelPos` and historical deterministic RNG draws for compatibility visual descriptors without allowing rendering or event cadence to consume RNG.
- Assigned a fresh candidate identity and moved browser trailer capture output outside production `dist/`.
- Certified the Phase D technical architecture complete with no critical or high defects after final static review; handoff remains administratively NO-GO while the source is dirty/uncommitted and authorization is pending.
- Upgraded full checkpoints to schema v2 with canonical-compatibility label metadata; v1 is rejected because exact between-cadence canonical bytes cannot be reconstructed.
- Added periodic/final canonical, RNG, command-count, and cursor replay evidence plus exact-target watch/resume semantics, closing post-end continuation serialization and resume divergence.

## 1.10.10 - 2026-09-17

- Repository-only Phase D1 game version; it has not been deployed.
- Added an importable browser-free deterministic runtime seam for counted seeded RNG, command/replay bookkeeping, canonical v1 serialization, and exact tick ordering.
- Added explicit command reset/history, replay configuration/takeover, and versioned JSON-compatible runtime checkpoint/restore semantics with exact RNG continuation.
- Moved authoritative settings/allowed rules, match identity/difficulty, clocks, lifecycle, fog, draft, map/index storage, actor collections, hostility/proposals, garrison indexes, and the actor UID allocator behind a browser-free per-instance state factory with stable reset/filter identity and interleaved isolation contracts.
- Removed the presentation-centroid cache from authoritative setup/draft decisions and added a rendered-versus-headless cadence gate covering standard and risky-start simulations.
- Routed the legacy game and Node harness through the same runtime while preserving every approved 1.10.8 simulation, replay, and visual baseline.
- Added poisoned-browser-global, RNG compatibility, runtime isolation, canonical-v1, replay-order, pause-order, and checkpoint-order contracts.
- At the 1.10.10 checkpoint Phase D remained in progress: setup scratch state and world systems were still legacy callbacks, visual effects preserved historical simulation-RNG draws, and the compatibility harness still rewrote/evaluated the legacy application. Candidate 1.10.11 completes those extraction items while retaining the required RNG compatibility behavior.

## 1.10.9 - 2026-09-15

- Repository-only game version; recovered and normalized on 17 September 2026 with all Phase C correctness, artifact, and production-build performance gates passing. It has not been deployed.
- Added Vite development and reproducible production builds.
- Moved the unchanged Canvas game into ES modules with extracted styles, map/flag data, audio preferences, utilities, and Local/WordPress platform adapters.
- Added source-versus-built browser contracts, missing-chunk checks, bundle reporting, and schema-1 `dist/release.json` generation.
- Retained the approved 1.10.8 simulation and visual baselines through an explicit build metadata contract.
- Added manifest-backed signing-key health validation, functional Local/WordPress adapter boundaries, and production-only removal of browser test internals.

## Plugin 1.10.7 - 2026-09-15

- Repository-only plugin version; it has not been deployed.
- Added strict schema-1 game-package manifests, immutable release directories, serialized staging and activation, append-only release pointers, rollback, retention, and legacy-root import.
- Added exact-ZIP WordPress installation, upgrade, lifecycle, validation, MIME, cache, signing-key, and data-preservation coverage.

## 1.10.8 - 2026-09-15

- Repository-only game version; it has not been deployed.
- Added the Phase 0 deterministic state oracle, invariants, strict replay verification, cross-process determinism, and cross-browser canonical digest coverage.
- Removed seeded randomness from a JavaScript `sort` comparator and established the approved 1.10.8 simulation baselines.
- Added the Phase A Canvas visual matrix, display-scale coverage, performance harness, and isolated illustrated command-map prototype.

## Game 1.10.7 / Plugin 1.10.6 - 2026-09-14

- Production release installed and verified on WorldRTS.com.
- Hardened replay identity rendering, save ownership and quotas, Autosave handling, migrations, and bot-record isolation.
- Labeled scores, rankings, and achievements as community-submitted and not independently verified.
- See `docs/releases/1.10.7-1.10.6.md` for the authoritative deployment record.
