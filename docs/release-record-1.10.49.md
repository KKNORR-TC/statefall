# Statefall release record — 1.10.49 / plugin 1.10.8

28 September 2026. **GO for manual publishing: all required local release gates pass.** This is the technical readiness decision under Ken's approved release-preparation scope. No push, tag, production access or deployment has occurred. Ken remains the deployment owner.

## Identity and source

- Game: 1.10.49, build 2026-09-28-release-performance; minimum plugin 1.10.8.
- Plugin: 1.10.8. Last user-confirmed production baseline: game 1.10.7 / plugin 1.10.6 on 14 September 2026; not rechecked live.
- Qualified source HEAD: 4a7cab910bec42e4d5cacf68a3e46703fed36d39. Local checkpoints: a352b92 (combined candidate), ca83cdd (startup), 40439ad (test readiness), 1517d9e (checksum verifier), 0df4109 and 4a7cab9 (Docker lifecycle).
- Full game verification ran at 40439ad. Later changes affect only three local sandbox scripts; the exact-package/lifecycle gate was rerun afterward. All game, plugin, build and gameplay-test inputs remained byte-identical. Six performance output files were regenerated. [Source delta](evidence/release-1.10.49/final-harness-source-delta.json), [inventory](evidence/release-1.10.49/source-inventory.json).
- Simulation fixture baseline: 1.10.8; canonical state statefall-authoritative-state/v1; checkpoint statefall-engine-checkpoint/v2. Determinism: DETERMINISTIC ✓, final bc43ad4e / 509ad7e54aa2.
- Simulation fingerprint: 4eec78c079e5214879dfcf467b0cf441b4e5acb82395ae8533b622bbf1f05481.
- Visual baseline: existing Windows Canvas goldens, including the previously reviewed Airfield II six-slot correction. Ken approved current classic units, buildings and upgrade art for this release; detailed Phase G review remains deferred. [Approval](evidence/release-1.10.49/art-approval.json).
- Environment: Windows 10.0.26200 x64, Node 22.23.2; Chromium 153.0.8010.12 for loading measurements, plus Firefox/WebKit regression coverage. WordPress 7.1 / PHP 8.4 local Docker sandbox.
- Remaining working-tree changes at qualification were documentation and generated evidence, subsequently checkpointed for handoff. No installation archive was rebuilt after its successful exact-artifact gate.

## Exact installation artifacts

| Component | Filename | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Game | statefall-release-1.10.49.zip | 32,439,615 | bcdcd534e3454939d34cebace3af7184bcc2ad89b95d8df0bd56d2c0a6dfc60a |
| Plugin | statefall-scores-1.10.8.zip | 212,334 | 8b8a65ed1282d5a9440c01b908a187772c0e517260666c8d8d63241d29b539dc |

Game manifest SHA-256: d0caf9789f98bd0c58a3b7e9750fea0fd73b61d24e520ee036d9a23a7a8a9aed. Signing-key SHA-256: c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53. The game has 54 archive entries; the plugin has 17 entries under statefall-scores/. Every game payload size/hash, embedded version/build and minimum plugin were checked. Production excludes development bridges, coastal test controls and Pixi selection.

The successful npm run verify:artifacts invocation built and installed these ZIPs on 28 September, 19:06:37–19:07:42 UTC (15:06:37–15:07:42 EDT). They were not rebuilt or repackaged afterward. [Archive audit](evidence/release-1.10.49/artifacts.json). Handoff location: D:\One Drive\projects - local\statefall\working releases.

## Verification

| Required check | Result |
| --- | --- |
| npm ci; npm run verify | PASS: syntax, all Node contracts, determinism, 365 desktop/reduced-motion/source/built browser cases, 21 display-scale cases, one prototype case |
| Intentional browser project skips | 937; no required cases skipped or failed |
| npm run test:build-reproducibility | PASS |
| Required browser performance | PASS: every existing limit and both approved network profiles |
| Map/difficulty/mode matrix | 1,152/1,152 PASS; 12 maps × 6 difficulties × 16 named profiles; exact replay and zero comparison-baseline digest/command mismatches |
| Extended campaigns | 84/84 PASS; 341,212 recorded ticks; 47 reached 6,000 ticks, 37 ended earlier under normal rules |
| Dense isolated campaigns | Africa 184.54 s; Middle East 297.45 s, including replay, below unchanged 360 s watchdog |
| Complete roster | Three command scenarios PASS; 2,100-tick island roster replay PASS in Chromium, Firefox and WebKit with render purity and no captured errors |
| Gameplay follow-ups | All 19 gates PASS: upgrades, submarine base, naval menus, fog, credits, attack/pan performance, terrain, culling, catch-up, cache and dense replay/live checks |
| Additional coverage | Mobile advisory 20 PASS / 628 intentional skips; mobile prototype, terrain model/client/source-evidence and trailer smoke PASS |
| sandbox/verify.ps1 | PASS: local public routes, authenticated REST and save CRUD |
| sandbox/security-regression.ps1 | PASS: replay XSS, immutable save kind, Autosave quota/uniqueness and bot-record isolation |
| npm run verify:artifacts | PASS: exact ZIP fresh installation, previous-plugin upgrade and data preservation; manifest validation, activation, rollback, reinstall, staging and retention; score signing key; MIME/cache behavior; WordPress browser loading with no missing chunks |
| Final archive/source audit | PASS; required group results, source identities, approved board hashes and final archive checksums agree |
| Docker cleanup | PASS: repository shutdown/status scripts report stopped; independent process inspection found no Docker processes |

[Combined audit](evidence/release-1.10.49/qualification-audit.json), [source gates](evidence/release-1.10.49/source-gates.json), [simulation summary](evidence/release-1.10.49/simulation-summary.json), [browser gates](evidence/release-1.10.49/browser-gates.json), [final gates](evidence/release-1.10.49/post-gates.json), [Docker gates](evidence/release-1.10.49/docker-gates.json). Successful raw logs are retained as gzip files in the same evidence directory.

## Performance and reviewed limitations

All three cold samples per network profile pass: worst load plus match start is 11.500 s at 25 Mbps / 100 ms (15 s limit) and 27.103 s at 10 Mbps / 150 ms (40 s limit). Localhost medians are 476.8 ms desktop and 487.7 ms mobile emulation. The initial classic payload remains about 31.58 MB. These are emulated network measurements on this desktop, not live-site or low-end-hardware certification. [Raw performance](evidence/release-1.10.49/performance.json), [approved policy provenance](performance-budget-reassessment.md).

Twelve-second dense live runs produced frames/ticks of Atoll 715/120, Europe 715/120, Africa 675/120 and Middle East 455/119. Middle East meets the unchanged 360-frame/90-tick minimum, but retains p95 66.6 ms, p99 83.4 ms, maximum 250.1 ms and 35 frames above 50 ms. Frame pacing in the densest state and initial artwork payload size remain optimization follow-ups. Development Pixi support stress passes at p99 12.1 ms against 33 ms; it is excluded from production. [Live measurements](evidence/release-1.10.49/late-game-performance.json).

Detailed Phase G animation/state review is explicitly deferred by Ken. The full game remains desktop-first. This finite regression matrix does not prove zero bugs for every seed, option combination, device or player action sequence.

## Resolved findings and retained history

Startup now shows loading status, prevents premature input and offers retry after download failure. Older tests were corrected to wait for asynchronous readiness without weakening assertions. The checksum verifier now uses runtime SHA-256 when nested PowerShell lacks Get-FileHash. Docker cleanup now detects lingering Desktop processes and bounds hung health/shutdown requests. Stale socket folders were preserved as backups; no factory reset or database/image deletion was used.

Earlier failed attempts remain in [qualification history](evidence/release-1.10.49/qualification-history.md), [startup regression evidence](evidence/release-1.10.49/startup-readiness-regression.json) and the retained Docker failure records. Subsequent required reruns pass. Docker progress written to stderr appears as NativeCommandError formatting in Windows PowerShell logs; gate exit codes and explicit checks passed. NO_COLOR/FORCE_COLOR and module-type warnings are tooling diagnostics. Disposable local MariaDB SSL/passwordless warnings are not production configuration changes. The historical [1.10.48 NO-GO record](release-record-1.10.48.md) is unchanged.

## Production handoff

Follow [installation instructions](installation-handoff-1.10.49.md). Install plugin 1.10.8 before game 1.10.49. Verify the accompanying SHA-256 values before upload.

Production backup/restore point, uploader/time, installed versions, cache purge, anonymous/authenticated play, score submission, leaderboard/profile, save/resume/replay, how-to pages and active release pointer checks are **not yet performed**; Ken completes and records these during deployment. No rollback has been required on production because no deployment occurred. Retain previous packages and restorable backups until post-deployment checks pass.
