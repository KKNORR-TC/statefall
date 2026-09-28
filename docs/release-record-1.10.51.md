# Statefall 1.10.51 — custom-nation credits correction

28 September 2026. **Qualified for manual corrective installation with plugin 1.10.9. Production acceptance is pending.** Release owner/installer: Ken.

## Problem and correction

The existing custom-nation country marker (-1) was rejected by replay readers, including credits 52. Readers now accept it only with a custom flag; invalid flag contents remain subject to identity validation. A second failure occurred when credits called a missing production renderer method. Canvas implements the no-op layer rejection and the production wrapper forwards it.

Simulation rules, recording contents, canonical schema and simulation baseline 1.10.8 are unchanged. The public credits 52 recording from game 1.10.50 passed all 6287 ticks, 119 commands and 62 checkpoints, final digest 72f4dea9. No new match or recording is needed. Production-derived replay data remains in ignored local artifacts only.

## Exact artifacts and source

- Game: statefall-release-1.10.51.zip, 32439812 bytes; SHA-256 1328cc26883d1d87be2994cec3ae8901a39d2601405af544f05755a9bd8ee8ba.
- Build: 2026-09-28-custom-credits-fix; minimum plugin 1.10.9.
- Unchanged plugin: statefall-scores-1.10.9.zip; SHA-256 c3520f9091873f48e0b9cded7522b701546d69bf14671b5fc7f9a45fa89798bc.
- Source base bb1a59d plus the source/test hashes in [qualification evidence](evidence/release-1.10.51/qualification.json). The local correction commit contains this record.
- Exact artifact gate completed 2026-09-28T22:09:50Z. Internal paths, manifest, signing metadata, embedded versions and payload hashes passed installer validation. ZIP copied without rebuilding or repackaging after verification.
- Existing replay fixture public-v1.10.7-focus is used with synthetic custom-nation data in committed regressions. Visual and simulation baselines were not changed.

## Verification and scope

Dependency installation and full npm verify passed: syntax, engine contracts, replay/determinism gates, 365 main browser cases (937 existing project exclusions), 21 display-scaling cases and one prototype case. After that full run, a single forwarding method was added to the production renderer wrapper; the rendering contracts, reproducibility, performance, WordPress basic/security and complete exact-artifact gate were rerun successfully against that final correction. The full browser matrix was not rerun a third time after the wrapper-only delta. Earlier failing artifact logs are preserved and superseded by the final passing gate.

The exact installed ZIP passed four browser tests: anonymous, static hosting, authenticated custom flag and custom-nation credits. Credits coverage restores the existing -1 marker and checks rendering for runtime errors and failed requests. Package lifecycle, install/upgrade data preservation, activation/rollback/retention, MIME and cache checks passed. No verification limits were relaxed.

Final performance maximum of three samples: 11.503 seconds at 25 Mbps / 100 ms (15-second limit), 27.112 seconds at 10 Mbps / 150 ms (40-second limit). Environment and full samples are in the evidence directory. Prior broad campaign and artwork qualification was not repeated for this focused correction. Detailed Phase G art review and dense-map frame pacing remain previously documented follow-ups.

Docker stop and status passed; independent process inspection found no Docker processes. No production writes, push or deployment occurred.

## Manual installation and live acceptance

1. Retain a restorable current WordPress database, plugin and uploads backup.
2. Keep plugin **1.10.9**. Open **Statefall → Game package** and install **statefall-release-1.10.51.zip**. Do not upload the plugin ZIP here.
3. Purge relevant caches, confirm game 1.10.51 and reopen https://www.worldrts.com/play/?credits=52 while logged in and logged out.
4. Verify credits playback, normal startup, save/resume/replay, leaderboard/profile, how-to and a complete score submission. Record the installer, timestamp and production acceptance afterward.
5. If a new regression requires rollback, select the prior immutable release in Game package; 1.10.50 retains the known credits defect.

Production backup, installation, cache purge, live acceptance and rollback fields remain pending; local qualification does not establish production acceptance.
