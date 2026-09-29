# Statefall Current Status

**Current debug patch: 1.10.55 / plugin 1.10.9.** Approved silo and SAM integrated and packaged; focused checks and exact-ZIP standard/end-game smoke passed. Full qualification and live combat acceptance pending. No new production GO or deployment. [Patch record](release-record-1.10.55.md).

## Prior motion patch

**Current debug patch: 1.10.54 / plugin 1.10.9.** Reviewed unit/building motions integrated and packaged. Focused animation, terrain, startup and exact-ZIP checks passed; replay 91WI5P still matches all 28 checkpoints. Full qualification remains deferred; no new production GO or deployment. [Patch record](release-record-1.10.54.md).

## Prior tree-coverage patch

**Current debug patch: 1.10.53 / plugin 1.10.9.** Removed the 180-tree cutoff that left lower screen areas bare. Focused tree coverage/cache, map-edge, syntax, exact-ZIP integrity/startup checks passed. User replay 91WI5P matched all 28 checkpoints. Full qualification remains deferred under Ken's debug/testing instruction. [Patch record](release-record-1.10.53.md).

## Prior map-edge patch

**Current debug patch: 1.10.52 / plugin 1.10.9.** Map-edge clipping corrected and focused rendering, syntax, exact-ZIP integrity/startup checks passed. Ken explicitly requested patch packaging without the full suite during debugging. Full release qualification is deferred; this patch is not declared production GO. [Patch record](release-record-1.10.52.md).

## Prior qualified credits correction

Updated 28 September 2026. **Game 1.10.51 with plugin 1.10.9 is qualified for manual corrective installation. Production acceptance remains pending.** [Release record](release-record-1.10.51.md).

This correction restores custom-nation credits/replays and implements the missing production Canvas layer-rejection method. The reported credits 52 recording matched all 62 checkpoints across 6287 ticks and 119 commands without modifying the recording. The exact ZIP passed four installed WordPress browser scenarios, including the credits regression. Qualification scope and preserved earlier failures are recorded with the release evidence. Docker is fully stopped.

Game 1.10.50 is superseded for the credits defect; its custom-flag startup fix remains included. Keep plugin 1.10.9. No production changes, push or deployment occurred. Ken remains the installer. Detailed Phase G review and dense-map frame pacing remain follow-ups.

## Historical status — 20 September 2026

The following notes describe the earlier state and are retained as history; they do not override the current candidate record.


## Repository and production

- Source authority: the local Git repository. Phase E is committed at `d0c92fb`; commit `27a2389` is the reviewed Phase F2 candidate baseline. Ken approved the in-game F2 terrain on 2026-09-20 by stating `approved proceed`. This final in-game decision is distinct from the earlier direction/prototype approval. Development game/package 1.10.32 build `2026-09-20-phase-f2-high-resolution-terrain` is approved locally with terrain-affected Canvas goldens accepted. The old 1x F1 candidate is superseded/changes requested. Plugin remains 1.10.7 and simulation baseline remains 1.10.8. No handoff, release, deployment, or production change occurred.
- F2 technical qualification is source-bound and covers framebuffer parity, authoritative input alignment, suppression convergence, named main-thread responsiveness, and the configured browser/Direction 02 matrices. Technical evidence plus Ken's named human decision accepted the in-game terrain. Worker compute time is not main-thread or input latency. Every individual Phase G row remains pending and Phase G has not started.
- Published GitHub state: `origin/main` remains at `de724b5`, the initial game 1.10.5/plugin 1.10.4 import. None of the later local history, including recovery, reconciliation, and normalization commits, has been pushed. GitHub must not be treated as a complete backup until publication is explicitly authorized and completed.
- Production remains game 1.10.7/plugin 1.10.6; a repository version does not prove deployment without a release record.
- Production: [WorldRTS.com](https://www.worldrts.com/) is a live public WordPress site. Ken confirmed successful installation and production verification of game 1.10.7/plugin 1.10.6 on 14 September 2026. The earlier authorized snapshot is retained as the pre-release baseline in `docs/production-baseline-2026-09-12.md`.
- Deployment owner: Ken uploads approved packages through the WordPress admin panel.
- Handoff directory: `D:\One Drive\projects - local\statefall\working releases`. This directory contains installable artifacts; it is not source authority.
- Production access is not part of normal local development. Do not access, upload to, or change production without Ken's explicit authorization.

## Local verification baseline

The repository now owns its Node test setup and lockfile. On Node `>=22.12 <23`:

```powershell
npm ci
npm run syntax
npm test
```

As of this update, Phase 0 modernization verification passes: comprehensive syntax checks, hardened harness assumptions, state invariants, pinned canonical SHA-256 simulation baselines, strict replay positive/negative checks, reduced-grid map and mode simulations, standard/fog/garrison same-page replay checks, production-size cold determinism, and Playwright Canvas checks in Chromium, Firefox, WebKit, mobile profiles, and reduced motion. The determinism result is `DETERMINISTIC ✓`. See `docs/testing-baselines.md`.

Phase A is complete. Evidence in `docs/phase-a-evidence.md` includes strategic/close references for every production map, major modes and input paths, dense late-game and historical replay scenes, desktop DPR 1/1.5/2 checks, performance ceilings, and an illustrated command-map vertical slice approved by Ken as the high-level direction. The full game is desktop-first; mobile/Playables remains optional and may become a separate Statefall Light track. Individual unit graphics remain unapproved until Phase G review.

Phase B is implemented in repository plugin 1.10.7. Schema-1 manifest packages are validated for exact file inventory, normalized safe paths, allowed extensions, count/depth/compressed/extracted/per-file limits, minimum plugin version, SHA-256/size integrity, and exact agreement between manifest metadata and the entry's game markers. A filesystem lock serializes staging, finalization, activation, deletion, and pruning. Activation and complete rollback append an atomic record under `uploads/statefall/release-pointers/`; no existing pointer is replaced, making publication safe on Windows and POSIX. Pruning retains the active release plus five inactive releases. Shared `audio/` and `cards/` data remain outside releases. The deployed root `index.html` remains readable and is imported into an immutable release before the first manifest update; new bare-HTML installs and mutable legacy-backup restores are retired.

Phase C was completed in repository game 1.10.9, preserved by recovery commit `97dcc76`, and normalized by `951db36`, `5583fc9`, and `0d1cae9`. At that gate, `game/index.html` was a Vite entry for a multi-file ES-module application; styles, maps, flag data/drawing, audio preference state, storage helpers, build/signing metadata, and Local/WordPress adapters were separate modules, while simulation and Canvas rendering still shared `game/src/legacy-game.js`. The adapter owns account requests, saves, score submission, identity/capabilities, navigation, and lifecycle notification; legacy media loading and response-sensitive credit/leaderboard paths remain deferred with the broader legacy split. `npm run build:release` reproducibly emits hashed assets, canonical static help, standalone flags from explicit module exports, bundle metadata, schema-1 `dist/release.json`, and the exact installer ZIP without evaluating or scraping the application. Production bundles exclude the browser test bridge. Source and built Playwright projects reject failed requests and missing chunks, and the built project exercises normal UI startup without test internals. Build metadata explicitly retains the approved 1.10.8 behavior oracle and existing screenshots. Recovery commands, environment, artifact hashes, and residual issues are recorded in `docs/phase-c-recovery-evidence.md`.

Phase D architecture, implementation, and technical gates are certified complete in candidate 1.10.11 with no critical or high defects after final static review. `game/src/sim/engine.mjs` composes isolated authoritative state and runtime, setup/map generation, command/replay routing with acting-seat identity, match flow, all world systems, strict full-state graph checkpoints, canonical oracles, immutable event queues, read-only presentation/query views, detached render buffers, and frozen interpolation frames. Replay-facing API results are detached and frozen, and the final read-only API audit found no production authority return leaks. The browser and CommonJS harness import the engine directly; no application-source rewriting or evaluation remains. Two engines pass interleaved setup/draft/commands/ticks/checkpoint/reset isolation. The old-engine corpus frozen from `ad30188` matches all 7 scenarios, and production-grid determinism remains `bc43ad4e` / `509ad7e54aa2` with 85/85 command application and no divergence.

The minimal Phase D2 technical proof remains complete. Phase E is technically complete locally: E17 completed development Pixi ownership of the legacy visual frame while preserving mounted-Canvas input and atomic Canvas fallback; E18 adds a versioned renderer-neutral atlas manifest plus isolated Pixi registry and named physical-GPU evidence. The final source-bound Chrome/Edge runs each exceeded 1,800 RAFs and 60 seconds with 1,801 raw CPU samples, 140 valid GPU samples, 61 normalized resource samples, and 12 exactly equal final stable samples spanning 11 seconds; the isolated full matrix passed 418 cases with 2,113 intentional skips and zero failures across 2,531 configured project cases, with its raw JSON retained as tracked deterministic gzip. Both reports bind to executable-manifest SHA-256 `46156b083fedbc89ec38810ce2e44a3e435c43bc910b450609608d726f2b705c`. Current migration visuals remain bounded generated/vector/raster registries. Canvas remains production/default and production has no selectable Pixi graph, atlas loader, Pixi chunk, or unexpected atlas/network load. Authored atlases/unit art are deferred to Phase G and named human approval; Landings remains separately unapproved. See `docs/phase-e-completion.md`.

Compatibility visual descriptor generation intentionally consumes the approved historical simulation RNG draws inside the engine. Rendering, event dispatch cadence, presentation queries, interpolation, UI, and audio never consume that RNG. Canonical v1's historical `labelPos` is synthesized as a virtual serialization-only property; authoritative players do not own it and interpolation is non-authoritative. Full checkpoint schema `statefall-engine-checkpoint/v2` carries canonical-compatibility label metadata so exact canonical bytes survive restores between label-refresh cadences; checkpoint v1 is rejected because it cannot reconstruct those bytes. Replay saves carry periodic and final canonical, RNG, command-count, and replay-cursor evidence, and watch/resume enforce the exact target tick. Changing compatibility behavior requires a future versioned behavior/oracle change. Full rationale and gate evidence are in `docs/phase-d-progress.md`.

The exact verified candidate outputs are `.artifacts/statefall-release-1.10.11.zip` (1,001,297 B, SHA-256 `405c3d0379af2f841bccfe346297f33a5bd12cb43bdbc81bcfea4bcc2c476e5a`), `.artifacts/statefall-scores-1.10.7.zip` (212,033 B, `8ff25a201b60cec5c6c66b051a0dd6e67d06ab304f3975a4497649354af5d44e`), and rollback `.artifacts/statefall-scores-1.10.6.zip` (192,191 B, `fd68feca05c7023c8b7dcb120d1deb5884a210e294cb2e029770e3ca45f8ee20`). `dist/release.json` and its ZIP copy are each 3,791 B with SHA-256 `78b569d21bd70748c31909ee003bb723d7d7b0c34644c1040b79395a6352890e`. The manifest has 23 files and the ZIP has 24 entries; production bridge-marker count is zero. Identity is game 1.10.11/build `2026-09-18-phase-d2`/minimum plugin 1.10.7. The earlier `e1fa7c...` and `7187ec...` game artifacts are explicitly superseded, not current evidence. These exact final files were not rebuilt or repackaged after verification.

`npm run verify:artifacts` builds deterministic plugin and game ZIPs plus the actual repository `1.10.6` plugin baseline and uses a disposable WordPress/PHP 8.4 table prefix. It covers a fresh database, exact `1.10.6` install and `1.10.7` upgrade with data preservation; exact production game and synthetic multi-file ZIP install; activate/rollback/reinstall/delete/prune; cross-platform pointer publication and request context snapshots; lock contention; legacy import/constraints; manifest/game-marker mismatches; bad hashes; traversal, duplicate/case-colliding and forbidden entries; package limits; stale versus current staging; admin/runtime path compatibility; release-qualified assets; and private HTML, JSON, JS, and CSS MIME/cache behavior. Immutable caching requires the requested filename fingerprint to match the manifest SHA-256. The existing mounted sandbox and security suites remain required.

Docker Desktop 4.90.0 and WSL2 are installed with Docker autostart disabled. The isolated sandbox runs WordPress 7.1, PHP 8.4, and MariaDB 11.4 from the explicitly authorized production snapshot, with local credentials, external HTTP/email blocking, and localhost-only publication. `sandbox/verify.ps1` passes all plugin PHP syntax, public routes, authenticated cookie/nonce REST access, and save create/read/delete persistence. `sandbox/security-regression.ps1` passes malicious replay rejection, legacy replay sanitization, safe display-name compatibility, immutable save kinds, all Autosave reservation paths, concurrent hard quotas, InnoDB migration, and bot-record isolation. Start, stop, preserved-data restart, full Docker shutdown, and on-demand Docker restart have been verified.

Candidate qualification passed: `npm ci` 2.036 s, `npm run verify` 424.931 s, reproducibility 4.205 s with 24 identical files, and browser performance 20.146 s. Browser evidence is 55 main passes/31 intentional project-selection skips/86 total, 3 desktop-scale passes, 1 graphics prototype pass, and 1 installed WordPress artifact pass. Desktop medians were 102.2 ms load, 659.3 ms start, 1,869.2 ms for 300 ticks, 0.8 ms frame p95, 242,431 B transfer, and 5,327,872 B heap; Pixel 7 emulation was 108.0 ms, 658.7 ms, 1,942.4 ms, 1.3 ms, 242,431 B, and 5,370,404 B respectively.

Sandbox start (30.742 s), mounted verification (7.140 s), security regressions (34.167 s), exact-artifact verification (60.290 s), and shutdown (14.614 s) passed. Docker Desktop and all services are stopped. The final status check took 0.375 s and exited 1 solely because its retained `docker info` probe cannot connect after successful full shutdown. Other retained non-blocking warnings are deprecated `prebuild-install`, module reparsing, a 705.13 kB Vite chunk, the disposable database SSL warning, and plugin-already-active output. Those timings describe the 1.10.11 candidate evidence run; Phase D was later committed locally at `16aec35`, but no handoff/release was authorized. No push, deployment, publication, production access, or copy to `working releases` occurred; production remains game 1.10.7/plugin 1.10.6.

Game 1.10.6 was rendered and inspected at 1440×900, 1280×720, and 390×844. No hotfix UI regression was found. The narrow viewport retains substantial pre-existing horizontal clipping and is not considered responsive-complete.

## Review findings

The disposition column records whether each finding is deployed, accepted, or still unresolved.

| Severity | Finding | Release disposition |
|---|---|---|
| Critical | Public replay data can inject stored HTML/JavaScript through unvalidated custom bot names rendered with `innerHTML`. | Fixed and deployed in game 1.10.7/plugin 1.10.6 with write validation, legacy public-data sanitization, safe client normalization, and text-only notice rendering. |
| Critical | The score HMAC key is delivered in public game HTML, so clients can forge leaderboard records. | Accepted and deployed product policy: game 1.10.7/plugin 1.10.6 explicitly label rankings and achievements as community-submitted and not independently verified. API score records expose `verified=false`; authoritative ranking is not claimed. |
| High | Unsigned `botNations` data can update arbitrary users' bot records. | Fixed and deployed in plugin 1.10.6 by ignoring non-authoritative client bot records. |
| High | Keep playing/Spectate was not serialized, so saves made after the first end state could not reconstruct later progress. | Closed in candidate 1.10.11: continuation is command-serialized, replay saves retain periodic/final canonical, RNG, command, and cursor evidence, and resume verifies the exact target without divergence. Not deployed. |
| High | Save/replay quotas can be bypassed by changing record kind or creating protected Autosave rows. | Fixed and deployed in plugin 1.10.6 with per-user locking, transactional hard limits, immutable kinds, and one reserved Autosave. |
| High | Seeded randomness was consumed inside a `sort` comparator, risking replay divergence between JavaScript engines. | Fixed in repository game 1.10.8 by precomputing one seeded key per candidate with deterministic tie-breakers; Chromium, Firefox, and WebKit canonical-state regression coverage was added. Not deployed. |
| Medium | Expired-login HTTP 403 score submissions are discarded although the UI promises a retry. | Non-security defect; fix before claiming reliable score retry. |

## Current production release

The combined game 1.10.7/plugin 1.10.6 release was installed and verified in production on 14 September 2026. Node syntax, full simulations, production-size determinism, PHP syntax, WordPress integration, security regressions, rendered screenshots, archive structure, embedded versions, checksums, and production verification passed. The expired-session score retry finding remains open; candidate 1.10.11 closes the post-end continuation/resume finding but is not deployed.

Release artifacts in `D:\One Drive\projects - local\statefall\working releases`:

- `statefall-release-1.10.7.zip`, SHA-256 `c7f0c0ad22b51dd8732f63acb53834de4f6d0844502124f2b6470c59b9908c86`.
- `statefall-scores-1.10.6.zip`, SHA-256 `12c08eb0960b9f423e2c9ba826d13aa6c8082e690f6484334fea28558c69f042`.

The earlier 1.10.6/1.10.5 package pair was superseded before deployment and must not be uploaded.
