# Statefall release readiness — 1.10.49 / plugin 1.10.8

28 September 2026. **Qualification in progress; not yet GO.** No push, deployment, or release tag is authorized.

Game build: 2026-09-28-release-performance. Minimum plugin: 1.10.8. The original simulation behavior baseline remains 1.10.8.

## Changes from the 1.10.48 candidate

- Preserve capture-front iteration/RNG behavior while eliminating repeated coordinates and direction branches.
- Skip unnecessary Canvas state writes for offscreen particles, with pixel-equivalence regression coverage at viewport edges.
- Isolate development Pixi support actors in their own render group to reduce GPU buffer upload stalls.
- Apply Ken-approved required network loading gates: maximum of three cold samples must be within 15 seconds at 25 Mbps / 100 ms, and 40 seconds at 10 Mbps / 150 ms. Other performance/correctness limits remain unchanged.

## Focused evidence so far

- Land-combat contracts PASS.
- Global-effects contracts and pixel-equivalence checks PASS.
- Middle East impossible/SOAK11B: full 6,000-tick campaign plus replay PASS in 308.53 seconds, below the unchanged 360-second watchdog.
- Pixi support-layer suite: 17/17 PASS, including resource/fallback behavior.
- Three isolated 1,800-frame stress repeats: 3/3 PASS; p99 11.0, 11.1 and 12.6 ms, versus the unchanged 33 ms limit. Tight-loop maximum stalls remain 868–941 ms; these tests measure synchronous submission, not live display smoothness.

Full current-source matrix, browser suites, required network performance, reproducibility and exact WordPress artifact qualification remain to be completed and recorded. Ken explicitly approved the current classic artwork for this release and deferred detailed Phase G animation/state reviews. This release-specific acceptance is [recorded with the reviewed boards](evidence/release-1.10.49/art-approval.json); no individual row approval has been invented.

The [1.10.48 release record](release-record-1.10.48.md) is historical and retains that candidate's exact ZIPs and failures. New final artifacts must be built and verified for 1.10.49.

## Startup follow-up

The first full verification passed 355 browser cases, 21 scale checks, the prototype check, deterministic Node contracts, reproducibility and all approved loading limits. A subsequent startup usability fix now displays loading status, prevents input until ready and offers retry after a failed module download. Its ten targeted checks pass across Chromium, Firefox, WebKit and source/built contracts. Full qualification is being repeated for this final source.

The first post-startup full run failed 33 older tests that accessed the test bridge before asynchronous startup completed (332 passed, 937 intentional project skips). Checkpoint 40439ad corrects readiness waits, including score reloads; all nine final score-retry cases pass. Failure evidence and follow-up results are [retained](evidence/release-1.10.49/startup-readiness-regression.json). A fresh full run is required and in progress.

## Complete source verification rerun

Checkpoint 40439ad passes npm ci, the complete npm run verify (deterministic Node contracts, 365 browser cases, 937 intentional project skips, 21 desktop-scale cases and one prototype case), and build reproducibility. No required case failed. The successful raw verification and reproducibility logs are retained as gzip files in the release evidence folder. Network, campaign and exact-package gates remain pending.

## Required loading performance

The final startup candidate passes all required performance checks with three cold samples per scenario. Maximum load plus match start is 11.500 seconds at 25 Mbps / 100 ms (15-second ceiling), and 27.103 seconds at 10 Mbps / 150 ms (40-second ceiling). Localhost median load plus start is 476.8 ms desktop and 487.7 ms mobile emulation (2,000 ms ceilings). All simulation digests agree. Raw samples and checks are in [performance.json](evidence/release-1.10.49/performance.json). These are modeled network measurements on this Windows desktop, not live-site or low-end-hardware certification.

## Dense campaign rerun

Both current-fingerprint campaigns reached 6,000 ticks and passed exact replay: Africa impossible/SOAK9B in 184.54 seconds, Middle East impossible/SOAK11B in 297.45 seconds. Both retain the 360-second watchdog. [Current evidence](evidence/release-1.10.49/dense-campaigns.json). The full 1,152-case matrix and remaining campaigns are still running.

## Comprehensive simulation and roster audit

The current-fingerprint summary passes all 1,152 map/difficulty/named-mode cases and all 84 extended campaigns, with no missing cases or replay failures. All 1,152 cases match the comparison baseline digest and command counts. Campaigns recorded 341,212 ticks: 47 reached 6,000 ticks and 37 ended earlier under normal rules. Matrix cases add 345,600 ticks. Complete-roster command scenarios pass on random/supereasy, world/normal and islands_m/hard; the island replay passes in Chromium, Firefox and WebKit with rendering purity and zero captured browser errors. [Summary](evidence/release-1.10.49/simulation-summary.json) and [gate results](evidence/release-1.10.49/simulation-gates.json). This covers named profiles and seeds, not every possible seed, option combination or action sequence.

## Gameplay and live browser follow-ups

All 19 follow-up gates pass, including upgrades, submarine base, naval menus, transport fog, credits replay, attack/credits/pan performance, terrain workers, culling, replay catch-up, cache stress and roster replay. Four dense 6,000-tick browser replays pass, followed by 12 seconds of live medium-zoom play. Frames/ticks: Atoll 715/120, Europe 715/120, Africa 675/120, Middle East 455/119. The densest Middle East case meets the unchanged minimum of 360 frames and 90 ticks, but still has p95 66.6 ms, p99 83.4 ms, maximum 250.1 ms and 35 frames above 50 ms. This is measured residual frame unevenness, not a claim of perfectly smooth play. [Results](evidence/release-1.10.49/late-game-performance.json) and [all follow-up gates](evidence/release-1.10.49/browser-followup-gates.json).

## Installation harness follow-up

The first Docker run passed basic WordPress and security checks, then stopped because its nested Windows PowerShell could not resolve Get-FileHash. Docker cleanup passed. Commit 1517d9e replaces only that checksum calculation with .NET SHA-256, preserving both descriptor comparisons and failure conditions. A known abc vector and both independently generated ZIP descriptors pass. The [source delta](evidence/release-1.10.49/checksum-harness-change.json) proves unchanged game/plugin/build/test inputs; six named test output files were regenerated. The exact package gate must pass after this fix. A subsequent Docker startup encountered the previously observed stale sailor-ingest socket; recovery and rerun are in progress.
