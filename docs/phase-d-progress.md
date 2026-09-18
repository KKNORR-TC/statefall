# Phase D Completion Evidence

_Certified technically complete on 18 September 2026 in local candidate game 1.10.11, build `2026-09-18-phase-d2`, with no critical or high defects after final static review. This is implementation and verification evidence, not release or production approval. Phase D was subsequently committed locally at `16aec35`; it was not handed off or released._

## Implemented Boundary

`game/src/sim/engine.mjs` is the browser-free engine composition root. `createEngine()` owns an isolated deterministic runtime and canonical state, setup and map generation, commands and replay, match flow, world systems, state oracles, full checkpoints, presentation events, read-only views and queries, detached render buffers, and interpolation snapshots. The browser application and the synchronous CommonJS compatibility harness both import this engine directly; the harness no longer rewrites or evaluates application source.

The public boundary provides setup/start/reset, tick, seat-aware command issue, replay configuration/takeover, lifecycle controls, read-only presentation access, presentation queries, canonical snapshot/hash/invariants, full and runtime checkpoints, event drain/dispatch, render-buffer synchronization, and interpolation frames. Replay-facing API results are detached and frozen. Mutable diagnostic access exists only behind the test-only `ENGINE_TEST_DIAGNOSTICS` symbol and is absent from production engines; the final read-only API audit found no production authority return leaks.

Extraction inventory:

- Runtime and authority: `deterministic-runtime.mjs`, `authoritative-state.mjs`, `state-reset.mjs`, `state-oracle.mjs`, `graph-codec.mjs`, and `engine-checkpoint.mjs`.
- Rules and orchestration: `rules.mjs`, `engine.mjs`, `world-setup.mjs`, `map-generation.mjs`, `world-loop.mjs`, `match-flow.mjs`, `command-router.mjs`, and `replay-schema.mjs`.
- World systems: `systems/ai.mjs`, `air.mjs`, `diplomacy.mjs`, `economy.mjs`, `fog.mjs`, `land-combat.mjs`, `logistics.mjs`, `missiles.mjs`, `naval.mjs`, and `structures.mjs`.
- Presentation boundaries: `simulation-ports.mjs`, `compatibility-effects.mjs`, read-only live presentation proxies, copied render buffers, immutable queued events, presentation-only label queries, and frozen previous/current actor interpolation frames.
- Geometry: deterministic centroid and label-layout calculations in `geometry.mjs`; setup and simulation decisions do not depend on renderer caches.

## Compatibility Seams

- Candidate 1.10.11 retains `SIMULATION_BASELINE_VERSION='1.10.8'` and the `statefall-authoritative-state/v1` canonical serializer. No approved simulation or visual fixture was changed.
- Compatibility visual descriptor creation still consumes deterministic simulation RNG inside the engine. Those draws reproduce approved historical draw counts and therefore preserve all subsequent simulation outcomes. The engine emits copied descriptors as queued events; whether a renderer is absent, drains events at another cadence, or draws at another cadence consumes no RNG and cannot alter authority. Removing, changing, or moving these compatibility draws requires a separately reviewed, versioned behavior change with new replay/oracle baselines.
- Historical canonical v1 included `player.labelPos`. Players no longer own that presentation field. At the legacy 30-tick points, the engine computes canonical positions independently and the serializer exposes `labelPos` as a virtual derived property solely to retain byte compatibility. Presentation label queries and smoothing are read-only and consume no RNG. Future canonical schemas should remove this compatibility seam explicitly rather than silently changing v1.
- Interpolation is non-authoritative. Frozen frames contain only previous/current tick, simulation time, and stable actor positions; render-time alpha and smoothing live in the Canvas presentation. Interpolation is reset on setup and checkpoint restore, does not advance on stopped ticks, is excluded from checkpoints and canonical state, and cannot mutate the engine.
- Commands carry optional acting-seat identity and route through the engine. The local UI still normally issues for its selected human seat; relay ordering, authentication, and multiplayer seat policy remain Phase D2 work.
- Replay saves contain periodic and final legacy hash, canonical digest, RNG draw count, command count, and replay-cursor evidence. Watch and resume both stop and verify at the exact recorded target tick; post-end continuation is serialized as a command, so post-end save continuation and resume divergence are closed rather than current high findings.

## Checkpoints And Events

Runtime checkpoints retain exact RNG state/draw count, command history, replay cursor and replay metadata. Full `statefall-engine-checkpoint/v2` checkpoints graph-encode the complete authoritative state plus runtime, including typed arrays, Sets, cycles, shared references, actor references, setup scratch state, map indexes, lifecycle, pending decisions, and UID state. V2 also stores `statefall-canonical-compatibility/v1` label metadata separately from authority so virtual canonical `labelPos` bytes resume exactly between the legacy 30-tick refresh points. V1 checkpoints are explicitly rejected because those between-cadence bytes cannot be reconstructed from authoritative state alone.

Restore validates schema, dimensions, tick duration, settings, commands, checkpoints, map aggregates, player/actor identities, graph references, diplomacy symmetry, garrison indexes, setup data, and other semantic authority before mutation. Invalid restores are atomic. Valid restores preserve stable top-level collection/buffer identities, clear stale presentation events, invalidate copied render state, reset interpolation history, and continue byte-identically both in the same engine and in an independently restored engine.

Simulation-side presentation calls now enqueue immutable copied events in emission order. Engines work without an event sink. Draining or dispatching during an engine operation and re-entrant dispatch are rejected; adapter failures are collected without changing simulation state. Browser UI/audio/controller work occurs only after engine operations through the adapter.

## Technical Gate Evidence

The Phase D implementation and technical gates pass:

- Direct import with poisoned browser globals; no DOM, Canvas, PixiJS, Web Audio, storage, network, wall-clock, or timer dependency under the engine.
- Two complete engines with different maps/settings run interleaved through setup, risky draft, commands, ticks, checkpoint/restore, peer reset/restart, and final invariants without shared mutable authority or output drift.
- Read-only presentation proxies reject object, array, Set, and typed-array mutation. Renderer buffers are detached copies with stable identity and refresh semantics.
- Full checkpoint round-trip, continuation, cross-engine restoration, cycle/shared-reference preservation, stable collection identity, semantic rejection, and atomic failure contracts pass.
- Headless/no-sink and sink/event-drain cadence runs produce identical canonical serialization, legacy hash, RNG draw count, and tick for standard and risky-start scenarios. Playwright covers Canvas render purity.
- The frozen old-engine parity corpus from commit `ad30188` passes all 7 scenarios with no divergence: standard random, fog world, garrisons land, quick Europe, endgame Asia, risky draft random, and combined-arms islands.
- Production-grid determinism remains legacy hash `bc43ad4e`, canonical prefix `509ad7e54aa2`, and 85/85 command application with no divergence.
- Same-page restart remains standard `77683843` / `3cf3f0ded683`, fog `69bcdf18` / `b9811f9c8cbc`, and garrison `81232aef` / `b1ea57c49266`.
- Trailer generation now uses browser/Playwright capture against an isolated capture build. Browser trailer smoke produced both 1280x720 JPEG paths without source evaluation and proved production `dist/` unchanged.

## Candidate Verification

Completed locally on 18 September 2026 with the repository's pinned Node/browser/container tooling:

- `npm ci`: PASS in 2.036 s.
- `npm run verify`: PASS in 424.931 s, including syntax, all direct-engine/system contracts, parity corpus, smoke/restart/replay, renderer independence, determinism, and browser gates.
- `npm run test:build-reproducibility`: PASS in 4.205 s. Two builds reproduced 24 identical files and the same release manifest.
- `npm run perf:browser`: PASS in 20.146 s. Desktop medians: load 102.2 ms, start 659.3 ms, 300 ticks 1,869.2 ms, rendered-frame p95 0.8 ms, transfer 242,431 B, post-GC heap 5,327,872 B. Pixel 7 emulation: load 108.0 ms, start 658.7 ms, 300 ticks 1,942.4 ms, frame p95 1.3 ms, transfer 242,431 B, heap 5,370,404 B.
- Required browser main suite: 55 passed with 31 intentional project-selection skips (86 total). Desktop-scale suite: 3 passed. Graphics prototype: 1 passed. Installed WordPress artifact browser check: 1 passed.
- `.\sandbox\start.ps1`: PASS in 30.742 s.
- `.\sandbox\verify.ps1`: PASS in 7.140 s.
- `.\sandbox\security-regression.ps1`: PASS in 34.167 s.
- `npm run verify:artifacts`: PASS in 60.290 s for exact ZIP install/upgrade, data preservation, manifest rejection, activation, rollback, retention, signing-key health, MIME/cache behavior, and installed WordPress browser loading.
- `.\sandbox\stop.ps1 -DockerDesktop`: PASS in 14.614 s. Docker Desktop and sandbox services were explicitly confirmed stopped. The final status check took 0.375 s and returned exit 1 only because its retained `docker info` probe cannot connect after a successful full Docker stop; this is an expected cleanup-reporting warning, not a running-service failure.
- Retained non-blocking warnings were deprecated `prebuild-install`, module reparsing, a 705.13 kB Vite chunk, the disposable database SSL warning, and plugin-already-active output.

Verified exact outputs, preserved without rebuild or repack:

| Output | Size | SHA-256 | Internal identity |
|---|---:|---|---|
| `.artifacts/statefall-release-1.10.11.zip` | 1,001,297 B | `405c3d0379af2f841bccfe346297f33a5bd12cb43bdbc81bcfea4bcc2c476e5a` | game 1.10.11, build `2026-09-18-phase-d2`, requires plugin 1.10.7 |
| `.artifacts/statefall-scores-1.10.7.zip` | 212,033 B | `8ff25a201b60cec5c6c66b051a0dd6e67d06ab304f3975a4497649354af5d44e` | plugin 1.10.7 |
| `.artifacts/statefall-scores-1.10.6.zip` | 192,191 B | `fd68feca05c7023c8b7dcb120d1deb5884a210e294cb2e029770e3ca45f8ee20` | rollback plugin 1.10.6 |
| `dist/release.json` and ZIP copy | 3,791 B each | `78b569d21bd70748c31909ee003bb723d7d7b0c34644c1040b79395a6352890e` | schema 1, game 1.10.11, build `2026-09-18-phase-d2` |

The game ZIP contains 24 entries representing the 23 manifest files plus the release manifest; source and built bridge-marker checks found zero production markers. The current game artifact supersedes both prior artifacts whose SHA-256 values began `e1fa7c` and `7187ec`; both are explicitly superseded and are not current release evidence. Browser transfer was 242,431 B in the final measured workflow.

## Disposition

Phase D architecture, implementation, and technical gates are certified complete with no critical or high defects after final static review. Phase D source and evidence were subsequently committed locally at `16aec35`, but candidate 1.10.11 was not handed off or released. Nothing was pushed, deployed, published, accessed in production, or copied to `working releases` as part of this evidence run.

Phase D2 relay/two-client proof and Phase E renderer work may now use the available engine prerequisites, but neither is part of this candidate's completed evidence.
