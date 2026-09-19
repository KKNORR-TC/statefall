# Changelog

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
