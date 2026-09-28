# Statefall release readiness — 1.10.48 / plugin 1.10.8

Recorded 2026-09-28T14:21:02.658Z. **NO-GO.** Exact artifact installation passes, but performance qualification has unresolved failures. Nothing was pushed, deployed, or copied to the approved handoff folder.

## Identity

- Source commit: 09ed1844d046582f696bb4aad5866f3d4d60bb2e, with intentional existing and release-preparation working-tree changes.
- Source inventory: 413 files; SHA-256 16f2a0ad96aee3b95e4a7af775dfd580ca667f15e0e3fb3356d4ccbeda7bea46. See [source inventory](evidence/release-1.10.48/source-inventory.json).
- Game: 1.10.48, build 2026-09-28-classic-release. Classic artwork is enabled by default in production.
- Plugin and minimum required plugin: 1.10.8. Install this compatible plugin before the game if a later release is approved.
- Recorded production baseline: game 1.10.7/plugin 1.10.6 from prior documentation; live production was not accessed or revalidated.
- Simulation fixture baseline: 1.10.8; canonical schema statefall-authoritative-state/v1; checkpoint schema statefall-engine-checkpoint/v2.
- Simulation fingerprint: dcdf92704a921c4d797bc1613d33661bbcaa5fb9337d44ab45c79738908c2539.
- Visual references: retained Windows Canvas map goldens; the dense airfield capacity label was corrected from 2/4 to 2/6, with before/comparison evidence retained. No screenshot tolerance was widened.
- Owner: Ken. Release approval: not granted; automated readiness decision is NO-GO.

## Exact artifacts

| Component | File | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| game | statefall-release-1.10.48.zip | 32436822 | 2a8b174fb35bf95b0d9bd712b3a87ba333e6277cfbb3634ee79cc7b61f469437 |
| plugin | statefall-scores-1.10.8.zip | 212334 | 8b8a65ed1282d5a9440c01b908a187772c0e517260666c8d8d63241d29b539dc |

Game manifest SHA-256: 4391d6e07c9a44b43a6606110b4b7279a486d0a4f593ba9ba4078a60663971f7. Signing-key SHA-256: c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53.
The final artifact gate ran from 2026-09-28T13:59:46.1311811Z to 2026-09-28T14:00:58.3786497Z. Both ZIPs remain in .artifacts/. Their paths, embedded versions, payload lengths and hashes were independently inspected; the reproducible dist manifest matches the game ZIP. They were not rebuilt or repackaged after that successful verification. See [archive audit](evidence/release-1.10.48/artifacts.json).

## Verification

| Check | Result |
| --- | --- |
| Locked dependency installation | PASS; initial preview-server file lock was resolved, then npm ci completed. |
| Final syntax and complete Node suite (verify:fast) | PASS; DETERMINISTIC ✓, 85/85 replay commands, final legacy hash bc43ad4e and canonical prefix 509ad7e54aa2. |
| Full npm run verify | NOT PASS: Node passed; the six-project browser stage reported 353 passes, 935 intentional project skips and two failures. Its chained later suites were run separately. |
| Windows visual follow-up | Corrected the inspected airfield capacity reference; 3/3 reruns passed. |
| Pixi support-actor stress follow-up | Unstable: initial p99 42.5 ms versus 33 ms; three isolated repeats yielded 25.9, 32.3 and 33.8 ms. Limits unchanged. |
| Desktop scales 1 / 1.5 / 2 | 21/21 PASS. |
| Desktop prototype | 1/1 PASS. |
| Mobile advisory | 20 passes / 624 intentional project skips; mobile prototype 1/1 PASS. |
| Trailer capture | PASS; production output preserved. |
| Standalone terrain/source-evidence tests | PASS. |
| Two clean builds | PASS, 52 files; final manifest matches the exact ZIP. |
| Classic upgrade, submarine base, naval menus, transport fog, credits replay | All PASS; submarine-base checks cover Chromium, Firefox and WebKit. |
| Classic attack, credits and pan performance | PASS against existing gates; occasional long frames remain. |
| Map/difficulty/profile matrix | 1152/1152 PASS: 12 maps × 6 difficulties × 16 named profiles. |
| Long campaigns | 83/84 PASS; Middle East impossible/SOAK11B timed out twice at the unchanged 360-second record-plus-replay watchdog, including an isolated run. |
| Full unit roster | Three headless campaigns PASS; 2,100-tick replay and rendering purity PASS in Chromium, Firefox and WebKit. |
| Late-game browser runs | atoll: PASS; europe: PASS; africa: PASS; mideast: FAIL. |
| Worker, frontier, culling, timer and bounded cache regressions | PASS. |
| Local WordPress/PHP sandbox | PASS: public routes, synthetic authenticated identity, save CRUD, plugin syntax. |
| Security regression | PASS. |
| Exact ZIP lifecycle | PASS: current game and plugin checksums; fresh install, replacement upgrade from 1.10.6, data preservation, activation, rollback, retention, MIME/cache behavior and WordPress browser startup with classic assets/worker. |
| Final general performance gate | FAIL: download/decoded-resource budgets exceeded; see below. |
| Docker cleanup | PASS; sandbox and Docker Desktop stopped, no Docker processes remained. |
| Working-tree whitespace check | PASS. |

Matrix parity comparison: 1152 cases compared against the previous simulation revision, 0 differing command-count/digest results. Intentional project skips select one owning browser for specialized cases; they are not missing required test coverage. [Simulation summary](evidence/release-1.10.48/simulation-summary.json).

## Unresolved release findings

1. Artwork download size exceeds the inherited Phase A 900,000-byte regression thresholds. These predate the new art and are not a platform constraint. The [28 September reassessment](performance-budget-reassessment.md) proposes a measured loading-time replacement; existing thresholds remain active pending approval. Localhost loading/frame timing and JavaScript heap pass, but those do not establish acceptable internet download performance. No budget was raised.
   - desktop-1440x900, resourceTransferBytes: 31582416 bytes versus 900000.
   - desktop-1440x900, resourceDecodedBytes: 32292925 bytes versus 900000.
   - mobile-pixel-7-390x844, resourceTransferBytes: 31582416 bytes versus 900000.
   - mobile-pixel-7-390x844, resourceDecodedBytes: 32292925 bytes versus 900000.
2. The 1,800-frame development Pixi support-actor stress gate is unstable at p99. Pixi remains absent from the production artifact; this is still a failing repository verification gate.
3. The extreme Middle East headless campaign exceeds its six-minute verification watchdog even alone. It reaches tick 6,000 during recording; the combined record/replay process fails its deadline. The browser replay separately completed without divergence, but subsequent live play failed the 30 FPS average gate: 321 frames, 118 simulation ticks, frame p95 83.4 ms, p99 116.7 ms, maximum 300.1 ms, and 92 frames over 50 ms. This confirms late-game choppiness in that scenario. See [the late-game log](evidence/release-1.10.48/late-mideast.log).
4. The unit-art review register still contains pending human review rows. Ken explicitly authorized including the classic look in this candidate; this report does not invent per-row approvals or mark Phase G complete.

Performance environment: win32 10.0.26200, x64, Node v22.23.2, chromium 153.0.8010.12, headless, 3 cold samples per scenario. The harness now waits for asynchronous artwork initialization and includes that time in loading measurements. Synchronous render-submission measurements and live requestAnimationFrame measurements are reported separately. [Raw performance report](evidence/release-1.10.48/performance.json).

## Fixes made during preparation

- Enabled classic production art while keeping coastal controls, test bridges and selectable Pixi code out of the release.
- Preserved scores rejected by an expired WordPress nonce and retried them after refresh; invalid-score and signature failures remain non-retryable. Cross-browser regressions exercise initial submission, repeated expiry, successful retry and queue removal.
- Fixed release-relative module/worker paths and removed duplicate worker-emitted artwork files.
- Found that the old artifact harness installed 1.10.11 regardless of the current build. Replaced that stale selection with current game/plugin descriptors, repository version/build checks and ZIP checksums. Old-artifact successes are not counted for this release.
- Fixed WordPress canonical redirects that turned JavaScript file URLs into directories and broke relative imports. Plugin 1.10.8 disables those redirects only for Statefall asset routes; the browser gate rejects asset redirects.
- Replaced the basic sandbox test’s hard-coded 1.10.11 expectation with current repository metadata.
- Corrected the dense screenshot reference for the already-fixed six-slot upgraded airfield. [Inspected difference](evidence/release-1.10.48/dense-label-comparison.png).

## Docker recovery

Docker Desktop 4.90 failed on inaccessible stale runtime socket reparse points, matching a [reported Windows startup issue](https://github.com/docker/desktop-feedback/issues/676). After confirming Docker was stopped, only verified zero-byte socket directories were renamed to dated backups. No factory reset, data-volume deletion, image cleanup, production access, or diagnostic upload was performed. The preserved database remained available, and local verification subsequently passed. Runtime socket directories were preserved aside again after the final shutdown to avoid reusing the failed endpoints on the next startup. This is a recovery workaround, not a claim that the upstream Windows/Docker issue is permanently fixed.

## Production and scope

No production backup, upload, activation, cache purge or post-deployment acceptance was performed; those require separate release approval and authorization. No candidate was copied into working releases because this release is NO-GO.

Coverage is finite: named profiles and fixed seeds, not every possible seed, option combination, machine or action sequence. Historical phase-E/F hardware evidence was not relabeled as current classic-art qualification. Logs and attempted-run history remain under .artifacts/release-*. The failed initial screenshot, stale-package test, redirect failure, stress outliers and watchdog attempts are retained rather than erased.

## Subsequent qualification-only update — 28 September 2026

Supplemental network instrumentation and current documentation were added after this exact-artifact verification. The source inventory above identifies the original tested snapshot; it does not claim to inventory these subsequent tooling/documentation changes. Neither installation ZIP nor game/plugin runtime source was rebuilt or changed by this reassessment. Original failures remain recorded; the candidate remains NO-GO.
