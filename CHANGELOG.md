# Changelog

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
