# Statefall 1.10.11 Phase D2 Candidate Evidence

_Local verification record dated 18 September 2026. This records an exact candidate and a technical gate; it is not a production release record or handoff approval._

## Identity

- Branch: `recovery/phase-c-2026-09-17`.
- HEAD: `ad301888827571e57514766c9892f12943197d05` (`docs: record normalized phase C baseline`).
- Working tree: dirty. Candidate 1.10.11 Phase D implementation, tests, tools, package metadata, and documentation are uncommitted relative to HEAD. This is intentional evidence truth, not a clean source identity.
- Production baseline: game 1.10.7/plugin 1.10.6, verified in production 14 September 2026.
- Candidate game: 1.10.11, build `2026-09-18-phase-d2`.
- Candidate plugin: 1.10.7; rollback plugin: 1.10.6.
- `REQUIRES_PLUGIN`: 1.10.7.
- Simulation baseline: 1.10.8 approved behavior fixtures.
- Canonical schema: `statefall-authoritative-state/v1`; full checkpoint schema: `statefall-engine-checkpoint/v2`; canonical compatibility metadata: `statefall-canonical-compatibility/v1`. Checkpoint v1 is rejected because exact canonical label bytes between the 30-tick compatibility cadences cannot be reconstructed from authority alone.
- Parity oracle: commit `ad301888827571e57514766c9892f12943197d05`, fixture `tests/fixtures/phase-d-parity-corpus-ad30188.json`.
- Release owner/approver: not assigned. Handoff/release has not been requested.

## Exact Artifacts

| Component | Path | Size | SHA-256 | Internal identity | Exact artifact tested |
|---|---|---:|---|---|---|
| Game | `.artifacts/statefall-release-1.10.11.zip` | 1,001,297 B | `405c3d0379af2f841bccfe346297f33a5bd12cb43bdbc81bcfea4bcc2c476e5a` | game 1.10.11; build `2026-09-18-phase-d2`; minimum plugin 1.10.7 | Yes |
| Plugin | `.artifacts/statefall-scores-1.10.7.zip` | 212,033 B | `8ff25a201b60cec5c6c66b051a0dd6e67d06ab304f3975a4497649354af5d44e` | plugin 1.10.7 | Yes |
| Rollback plugin | `.artifacts/statefall-scores-1.10.6.zip` | 192,191 B | `fd68feca05c7023c8b7dcb120d1deb5884a210e294cb2e029770e3ca45f8ee20` | plugin 1.10.6 | Yes |
| Manifest | `dist/release.json` and exact ZIP copy | 3,791 B each | `78b569d21bd70748c31909ee003bb723d7d7b0c34644c1040b79395a6352890e` | schema 1; game 1.10.11; build `2026-09-18-phase-d2`; minimum plugin 1.10.7 | Yes |

- Manifest entry: `index.html`; flags: `flags.js`.
- Inventory: 23 manifest files and 24 ZIP entries; production browser-test bridge markers: zero.
- Rebuilt or repackaged after verification: No. These exact files are retained as verified.
- Superseded evidence: prior game artifacts with SHA-256 prefixes `e1fa7c...` and `7187ec...` are not current release evidence.

## Commands And Outcomes

| Command | Duration | Outcome |
|---|---:|---|
| `npm ci` | 2.036 s | PASS; pinned Node dependencies installed. |
| `npm run verify` | 424.931 s | PASS; syntax, direct engine/system contracts, old/extracted parity, replay/smoke/restart, renderer independence, determinism, browser main, desktop-scale, and graphics prototype gates passed. |
| `npm run test:trailer-smoke` | Not separately timed | PASS; isolated browser capture emitted both smoke frames and left production `dist/` byte-identical. |
| `npm run test:build-reproducibility` | 4.205 s | PASS; repeated builds reproduced 24 identical files and the manifest. |
| `npm run perf:browser` | 20.146 s | PASS; all retained ceilings passed with no required request failure. |
| `.\sandbox\start.ps1` | 30.742 s | PASS; localhost-only WordPress sandbox started. |
| `.\sandbox\verify.ps1` | 7.140 s | PASS; mounted plugin/PHP/routes/authenticated save integration passed. |
| `.\sandbox\security-regression.ps1` | 34.167 s | PASS; replay/XSS, immutable-kind, Autosave/quota, migration, and bot-record protections passed. |
| `npm run verify:artifacts` | 60.290 s | PASS; exact packages built/inspected/installed and artifact-backed checks passed. |
| `.\sandbox\stop.ps1 -DockerDesktop` | 14.614 s | PASS; services and Docker Desktop stopped. |
| `.\sandbox\status.ps1` | 0.375 s | Expected exit 1 after confirming services and Docker Desktop stopped; retained `docker info` probe could not connect to the deliberately stopped daemon. |

The final `sandbox/status.ps1` cleanup check reported Docker Desktop and sandbox services stopped but exited 1 because its retained `docker info` probe cannot connect when Docker has been deliberately stopped. This warning is retained verbatim in disposition: cleanup succeeded; the status script's post-stop probe semantics remain imperfect.

## Determinism And Architecture

- Production-grid result: legacy hash `bc43ad4e`, canonical SHA-256 prefix `509ad7e54aa2`, 85/85 command application, no divergence.
- Old-versus-extracted parity: 7 scenarios against the frozen `ad30188` oracle, no divergence.
- Parity final hashes: standard random `3fe9e126` / `4a559a11fc57`; fog world `a0b8763a` / `f302ebf1a87d`; garrisons land `94c4e860` / `7402870b5d07`; quick Europe `d8ceb5df` / `dbab8e35e823`; endgame Asia `45767b79` / `4d79214fd333`; risky draft random `b76753eb` / `d57baa8bee76`; combined-arms islands `76964ee7` / `ce2d0e639917`.
- Same-page restart hashes: standard `77683843` / `3cf3f0ded683`; fog `69bcdf18` / `b9811f9c8cbc`; garrison `81232aef` / `b1ea57c49266`.
- Browser-free direct engine imports passed with platform globals poisoned. Two complete engines passed interleaved setup, risky draft, commands, ticks, checkpoint/restore, peer reset/restart, and final isolation/invariant comparisons.
- Full v2 checkpoints preserve typed arrays, Sets, cycles, shared references, stable container identities, actor references, command/replay state, RNG state/draw count, setup scratch state, lifecycle, UID state, and separate canonical-compatibility label metadata. Invalid semantic or graph restores, including v1, fail atomically.
- Read-only live presentation views, detached copied render buffers, immutable copied event queues, frozen interpolation frames, and detached/frozen replay API results passed mutation and cadence contracts. The final read-only API audit found no production authority return leaks.
- Compatibility visual descriptors intentionally consume historical deterministic simulation RNG draws inside the engine. Renderer presence, drawing cadence, event drain/dispatch cadence, UI, audio, and interpolation consume none. Changing compatibility draws is a future versioned behavior change.
- Canonical v1 supplies historical `labelPos` only as a virtual serialization property at the established cadence. The field is absent from authoritative players/state; checkpoints store only the separate compatibility metadata needed to reproduce it. Presentation smoothing/interpolation is non-authoritative.
- Replay saves include periodic and final canonical digest, RNG draw count, command count, and replay cursor evidence. Watch and resume enforce exact-target completion, and post-end continuation is command-serialized; the prior continuation/resume divergence findings are closed.
- Trailer browser smoke used isolated `.artifacts/trailer-dist`, produced both 1280x720 capture paths, performed no source evaluation, and proved production `dist/` unchanged.

## Browser And Performance Evidence

- Main browser suite: 55 passed; 31 intentional project-selection skips; 86 total.
- Desktop display scale: 3 passed.
- Graphics prototype: 1 passed.
- Installed WordPress artifact browser: 1 passed.
- Desktop: load 102.2 ms; start 659.3 ms; 300 ticks 1,869.2 ms; frame p95 0.8 ms; transfer 242,431 B; post-GC heap 5,327,872 B.
- Pixel 7 emulation: load 108.0 ms; start 658.7 ms; 300 ticks 1,942.4 ms; frame p95 1.3 ms; transfer 242,431 B; post-GC heap 5,370,404 B.
- Mobile emulation is advisory for the desktop-first product; it is not physical-device qualification.

## Sandbox, Package, And Security Evidence

- Exact plugin 1.10.6 install and 1.10.7 upgrade retained data; exact game package installation and installed WordPress browser loading passed.
- Manifest/hash/version/minimum-plugin validation, malicious archive rejection, immutable activation pointers, rollback, retention/pruning, staging/locking behavior, signing-key health, and runtime MIME/cache paths passed.
- Mounted sandbox and security regressions passed against WordPress 7.1/PHP 8.4/MariaDB 11.4 with localhost-only publication and external HTTP/email blocking.
- Final state: Docker Desktop stopped and all sandbox services stopped.

## Warnings And Skips

- 31 Playwright skips are intentional project-selection skips, not skipped applicable tests.
- Trailer smoke duration was not captured separately; its outcome and output isolation were captured.
- Pixel 7 results are browser emulation, not a physical mobile release claim.
- Windows Chromium pixel references do not qualify other operating systems.
- Retained non-blocking warnings: deprecated `prebuild-install`, Vite module reparsing, a 705.13 kB Vite chunk, the disposable database SSL warning, and plugin-already-active output.
- The final status script exit 1 is the retained stopped-Docker probe behavior described above.
- Production smoke, upload, cache purge, live account/save/score checks, and production rollback were not run because no production access or deployment was authorized.
- Source review and clean committed-source identity are not complete.

## Disposition

**Phase D architecture is certified technically complete with no critical or high defects after final static review. NO-GO for handoff or release remains solely because the worktree is dirty/uncommitted at HEAD `ad301888827571e57514766c9892f12943197d05`, and review, commit, and handoff authorization are pending.** All recorded implementation and technical gates passed for the exact retained artifacts; this administrative blocker does not authorize publication.

- No commit was created.
- No branch or commit was pushed.
- No deployment or production access occurred.
- No artifact was published.
- No artifact was copied to `D:\One Drive\projects - local\statefall\working releases`.
- No release was installed or activated in production.
