# Phase C Recovery Evidence

_Recorded 17 September 2026. This is repository recovery evidence, not a production deployment record._

## Identity

- Recovered branch: `recovery/phase-c-2026-09-17`
- Pre-recovery committed head: `682c356` (`feat: add immutable game release foundation`)
- Exact recovered source checkpoint: `97dcc76` (`feat: recover phase C modular build`)
- Verified normalization commit: `951db36` (`fix: normalize phase C verification`)
- Performance lifecycle hardening commit: `5583fc9` (`fix: harden performance qualification cleanup`)
- Complete resource-inventory validation commit: `0d1cae9` (`fix: validate performance resource inventory`)
- Published `origin/main` observed during recovery: `de724b5`
- Repository components: game 1.10.9, plugin 1.10.7
- Production components remained unchanged at game 1.10.7/plugin 1.10.6.

The recovered worktree contained 29 modified tracked files and 42 untracked files. The untracked set included the complete `game/src/` module tree, Vite configuration, build finalization tools, and Phase C browser tests. `game/index.html` already depended on those files, so preserving only tracked changes would have produced an incomplete application. Git history and reflogs showed no hidden or dangling Phase C commit and no interrupted Git operation.

## Scope Recovered

- Vite development and production builds rooted at `game/`.
- Extracted styles, map and flag data, audio preferences, storage helpers, build/signing metadata, static help, and Local/WordPress platform adapters.
- The unchanged simulation and Canvas renderer retained together in `game/src/legacy-game.js`; Phase D engine extraction has not started.
- Reproducible hashed production assets, schema-1 release metadata, bundle report, static help, standalone flags, and exact ZIP generation.
- Source/built browser contracts, platform-boundary tests, WordPress exact-artifact browser coverage, help contracts, build reproducibility, and exact signing-key checks.

No missing imports, conflict markers, truncated source, staged fragments, syntax corruption, or partial Git operation were found. The recovery checkpoint intentionally preserves the exact discovered state before paperwork corrections.

## Verified Environment

- Windows 11 Pro `10.0.26200`, x64
- Intel Core Ultra 9 290HX Plus
- 127.4 GB RAM
- NVIDIA GeForce RTX 5090 Laptop GPU, driver `32.0.16.1692`
- Intel Graphics, driver `32.0.101.8509`
- Node `22.23.2`; npm `10.9.8`
- Playwright `1.63.0`
- Git `2.55.0.windows.3`
- Docker CLI/engine `29.7.2`
- WordPress 7.1, PHP 8.4, MariaDB 11.4 sandbox

## Recovery Verification

The exact recovered source passed:

- `npm run verify:fast`: syntax, harness hardening, help and browser-server contracts, security, seeded ordering, strict replay checking, all smoke scenarios, standard/fog/garrison restart replay, and production-grid determinism.
- `npm run verify:browser`: the `test:browser` constituent passed 34 applicable tests across Chromium, Firefox, WebKit, reduced motion, source contract, and built contract, with 16 intentionally inapplicable project/test combinations skipped; its three desktop-scale tests and one Phase A prototype test also passed.
- `npm run test:build-reproducibility`: two builds produced identical 24-file output.
- `.\sandbox\verify.ps1`: WordPress/PHP versions, public routes, authenticated REST, and save CRUD passed.
- `.\sandbox\security-regression.ps1`: replay XSS, immutable kind, Autosave uniqueness, and bot-record isolation regressions passed.
- `npm run verify:artifacts`: exact plugin/game installation, upgrade, data preservation, manifest validation, activation, rollback, reinstall, staging, retention, signing-key behavior, runtime MIME/cache paths, and WordPress browser startup passed.

The first artifact invocation was made while Docker Desktop was stopped and failed before container startup. After `.\sandbox\start.ps1`, the complete command passed. This exposed a runbook prerequisite, not a package failure. Docker Desktop and all sandbox containers were stopped after verification and `sandbox/status.ps1` confirmed cleanup.

## Exact Artifacts

- `.artifacts/statefall-release-1.10.9.zip`: SHA-256 `9e672143330e0ca35935d10c4be6e3fd255bab73b8f28613bb7afe739cebf209`
- `.artifacts/statefall-scores-1.10.7.zip`: SHA-256 `8ff25a201b60cec5c6c66b051a0dd6e67d06ab304f3975a4497649354af5d44e`
- `.artifacts/statefall-scores-1.10.6.zip`: SHA-256 `fd68feca05c7023c8b7dcb120d1deb5884a210e294cb2e029770e3ca45f8ee20`
- `dist/release.json`: 23 payload files, manifest SHA-256 `d19ffcf49b5650d508bbeedf9b15b00498dcd37b25f41cbf5c5f57dda31b659d`

These are recovery-verification outputs, not approved handoff or production artifacts. Any source change or rebuild invalidates their use as exact verified candidates.

## Open Items

- The production JavaScript chunk is 550.73 kB (180,294 bytes gzip), reflecting the still-monolithic legacy game.
- Some media, credits, and leaderboard requests remain outside the platform adapter by documented deferral.
- Runtime and generated help have multiple representations whose equivalence is only partially checked.
- The asset finalizer must be revisited before introducing interdependent code-split chunks.
- Post-victory save serialization and expired-session score retry remain unresolved product defects.

## Normalization Follow-Up

Commit `951db36` corrected the desktop-scale URL to the canonical Vite root, aligned package and lockfile engines to Node `>=22.12 <23`, and changed `perf:browser` to measure a fresh production-optimized qualification build instead of Vite development modules. Commit `5583fc9` made browser, preview-server, temporary-build, and report cleanup independent across failure paths. Commit `0d1cae9` requires every resource loaded through the complete measured workflow to belong to the exact temporary build inventory. The harness retains guarded test instrumentation only in its temporary bundle. Normal release output continues to omit the test bridge.

The final hardened run passed all unchanged ceilings. Desktop medians were 303.8 ms load plus start, 885.6 ms for 300 ticks, 0.5 ms rendered-frame p95, 193,089 transfer bytes, 589,024 decoded bytes, and 4,026,096 bytes post-GC heap. Mobile-emulation medians were 306.1 ms load plus start, 891.1 ms for 300 ticks, 0.4 ms rendered-frame p95, the same payload, and 4,034,560 bytes post-GC heap. The earlier 4.29 MB source-module result remains recorded as the reason for correcting the methodology; no ceiling was raised.

After commit `951db36`, `npm run verify`, `npm run test:build-reproducibility`, `npm run perf:browser`, the mounted sandbox, security regressions, and `npm run verify:artifacts` all passed. After lifecycle and inventory hardening in `5583fc9` and `0d1cae9`, syntax and the full three-sample performance qualification were rerun and passed, with no temporary qualification directory left behind. Exact release artifact and manifest hashes remained unchanged by the normalization.

## Recovery Decision

Phase C is preserved and its required correctness, browser, reproducibility, sandbox, security, and exact-artifact gates pass. It is a local repository milestone, not a deployed release. Phase D remains the next development phase. No Pixi or production visual migration should begin until the Phase D deterministic engine boundary and its gate are complete.
