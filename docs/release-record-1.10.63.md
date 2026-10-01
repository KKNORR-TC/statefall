# Statefall 1.10.63 release record

## Identity and scope

- Candidate: game 1.10.63 / build 2026-10-01-guided-first-match. Plugin remains 1.10.10; minimum plugin 1.10.9. Simulation baseline 1.10.8 unchanged.
- Game source checkpoint: 28571a2. Subsequent qualification harness adjustments do not change the game artifact.
- Production baseline: 1.10.62. Ken explicitly requested production deployment and confirmed the backup is current on 1 October 2026. The hosting backup was not independently inspected.
- Ships the 25-step introductory lesson using the production engine and artwork, with native pause, camera, construction and attack actions. It explains land, gold/plunder, troops and income after conquest. Full nine-chapter campaign remains design work.
- Ships the tutorial introduction, four-step New match flow, Random Ready/Shuffle, clickable opening cards, saved-game continuation and Game guide return navigation. Eligible signed-in custom nations remain the native default.
- Tutorial and subsequent free practice use the local platform and suppress match recording, isolating account saves and score submission. No diagnostic globals ship.
- Includes reviewed existing restart corrections that preserve the active settings, country, custom opponents and unit restrictions.

## Qualification

- Clean npm ci passed after stopping the preview that held esbuild.exe open.
- verify:fast passed syntax, replay and deterministic checks: 85/85 commands, final bc43ad4e, digest prefix 509ad7e54aa2, DETERMINISTIC check passed.
- Focused startup/build/restart/tutorial: 11 passed. Opening menu: 4 passed. Exact production-build tutorial: 1 passed through conquest, unit guide, free practice and menu return; no test bridge, local score recording or save/score requests.
- Build reproducibility: 142 matching files across two clean builds.
- Sandbox application and security regressions passed. Exact ZIP installation, upgrade/data preservation, activation, rollback/retention and MIME/cache validation passed; four installed WordPress browser cases passed, including signed-in custom-country defaults and historical custom-nation credits.
- Docker's stale Windows runtime sockets recurred. After shutdown, the two verified socket-only directories were renamed to timestamped preserved copies and recreated. No database, volume or factory reset. Docker Desktop and sandbox were stopped and confirmed stopped after qualification.
- The main browser matrix completed with 469 passed, 940 existing project exclusions and one diagnostic-file collision. That single test passed in isolation (470 applicable cases passed overall). The collision came from two runners sharing test-results; WordPress diagnostics now have a separate output directory. Display-scale checks: 21 passed. Graphics prototype: 1 passed. Earlier guide selectors were updated for Game guide; packaged-walkthrough scroll/drag gestures were corrected and passed.
- Performance harness now waits for the opening module and boot completion, then navigates the wizard before timing Start. This includes the new menu in application-ready time; all approved budgets, samples and simulation fixtures are unchanged.
- Existing tooling warnings: prebuild-install deprecation, Node module-type inference, large main chunk, and NO_COLOR/FORCE_COLOR precedence. Runtime console failures remain disallowed.

- Performance passed all four scenarios with three cold samples each. Reported broadband load/start: 12,436.9/228.4 ms; constrained: 29,567.2/248.4 ms. Every sample is within the unchanged 15/40 second limits. Full report: evidence/release-1.10.63/performance.json.
- Final artifact rerun passed four installed WordPress cases again; its ZIP hash remains unchanged. Docker Desktop and sandbox confirmed stopped.
- Ken requested silent testing during qualification. The production browser was set to zero for all five channels and verified after reload; Chromium/Firefox launch settings and local preview defaults now enforce silence. Workspace instructions require silent agent testing and prohibit muting meeting/system audio.

## Exact artifact

Game ZIP: statefall-release-1.10.63.zip, 42,623,618 bytes. SHA-256: 9527785c572fa344729606bcac0f4ade076e4e368e5d81440a656b5c6d173e8a.
All 141 payload sizes/hashes and 142 archive entries independently verified. Signing-key SHA-256: c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53. See evidence/release-1.10.63/archive-inspection.json.

Release qualification: GO. All required checks passed. Exact final candidate retained without repackaging. Prior immutable 1.10.62 is available for rollback. Production installed; live acceptance remains partially pending as detailed below.

## Production deployment and acceptance

- Installed the exact qualified ZIP on 1 October 2026 at 14:02:51 UTC as Statefall Staff. WordPress confirmed activation and matching signing key. WP Engine caches cleared at 14:03:23 UTC. Prior 1.10.62 retained for rollback.
- Anonymous manifest matches qualified release. All 141 public payloads returned 200: 115 exact hashes, 25 hosting-recompressed PNGs with identical decoded pixels, and the entry page matching after removal of the injected Cloudflare challenge script. All eight public help tabs returned correct content, including current About.
- Authenticated opening/version, wizard Ready card, tutorial introduction, isolated tutorial startup/zoom lesson/menu return, in-game About, profile and leaderboard passed live inspection. All five audio levels were zero and persisted after reload.
- Production save/resume, replay and fresh score acceptance remains pending: automatic approval review rejected starting the prepared TUTOR1063LIVE match because it creates account records. Explicit approval was requested; no answer received and no test match started. This is not full production acceptance. Equivalent installed-artifact checks passed locally.
- Deployment and tutorial screenshots, public payload checks and performance results are retained in evidence/release-1.10.63.
- Docker lifecycle recovery passed two start/stop cycles and sandbox verification. Docker is stopped. See docker-runtime-recovery.md for scope and limitations.
