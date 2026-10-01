# Statefall 1.10.60 — illustrated help

## Identity and scope

- Date: 30 September 2026.
- Production baseline: game 1.10.59 / plugin 1.10.10.
- Source HEAD: `37a85e6ec0ac4e2dc22644973d7385109dce1bbe`, with intentional local changes. Exact executable inputs are recorded in `evidence/release-1.10.60/source.json`. Earlier audio, save/replay and score corrections were already present and are preserved.
- Game: 1.10.60, build `2026-09-30-illustrated-help`; minimum plugin 1.10.9. Plugin remains 1.10.10.
- Simulation baseline: 1.10.8; canonical schema and visual baselines unchanged.
- Change: 40 gameplay portraits and practical usage notes shared by Buildings, Ships and Air in the app and packaged website help. Portraits preserve proportions; website cards become one column on narrow screens.
- Owner: Ken; deployment authorized with “deploy when ready, looks good.”

## Qualification

- Locked dependency installation passed.
- Full syntax and Node/simulation suite passed, including `DETERMINISTIC ✓`. Final syntax and help-contract checks passed after the modal image-loading correction.
- Focused help browser matrix: 6 passed across Chromium, Firefox and WebKit. Every portrait and usage note is checked, including narrow website layouts.
- Initial broad browser run was interrupted after the Chromium block and part of Firefox. Art export during that run caused Vite reloads and interrupted three rendering cases plus the score-retry hooks. A fresh server rerun passed those rendering and score cases; logs are retained.
- The independent relay proof also exposed test resource-lifecycle problems. Completed proof servers now close before the next scenario, and the intentionally rejected Origin handshake is consumed and terminated with an error listener. Protocol and security assertions are unchanged; the isolated final relay test passed. No relay gameplay source changed.
- Established WordPress verification and security-regression checks passed.
- Remaining five-project browser matrix: 95 passed, 918 intentional project exclusions, one startup readiness race. The test now waits for asynchronous bridge registration rather than treating network idle as application readiness; all six source/built browser configurations passed the rerun. No product startup behavior changed.
- Display scale: 21 passed at DPR 1, 1.5 and 2. Prototype: 1 passed. Existing visual baselines retained.
- Build reproducibility: two clean builds matched all 138 files.
- Exact-ZIP WordPress installation: passed, including plugin replacement/data preservation, package validation, activation/rollback/retention and MIME/cache paths; all four installed browser scenarios passed. A temporary shortcode page in disposable artifact WordPress also rendered all 25 building cards with correctly proportioned portraits.
- Performance: all ceilings passed, deterministic across all scenarios. Three cold samples per scenario, including 25 Mbps/100 ms and 10 Mbps/150 ms. Report retained in `evidence/release-1.10.60/performance.json`. The network scenarios stayed within the approved 15 s and 40 s load-plus-start ceilings. Existing Vite chunk-size advice is informational; measured load/start budgets pass. Node FORCE_COLOR/NO_COLOR notices and Git CRLF notices are tooling-only.

The full verification chain was completed in recorded segments and targeted reruns after diagnosed harness failures; a single uninterrupted `npm run verify` did not pass. No required coverage was removed or skipped to obtain approval. Original failed/interrupted logs and passing reruns are retained.

## Artifacts and production

Final candidate is the unchanged ZIP produced and installed by the successful `npm run verify:artifacts` invocation:

| Component | Filename | SHA-256 |
|---|---|---|
| Game | `statefall-release-1.10.60.zip` | `d933fa3db8b64cdd76e308b22c86c4a9032024d0e93e49671887b526ee611d7b` |
| Plugin (unchanged, verification only) | `statefall-scores-1.10.10.zip` | `a3a34f7ff11fa2b50a4821ee1ab56766ad73cdd042f94b8d88dd1e18e46de289` |

Game archive inspected: 138 entries, root manifest schema 1, 137 payload files, version 1.10.60, build `2026-09-30-illustrated-help`, minimum plugin 1.10.9. Signing-key SHA-256: `c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53`. Root paths are `assets/`, `howto/`, `bundle-report.json`, `flags.js`, `index.html`, `release.json`, `VERSION.txt`. Not rebuilt or repackaged after verification.

Local qualification passes. Ken confirmed “backup complete” before activation. Only the game package was deployed; plugin remains 1.10.10.

Ken confirmed completion of the full backup on 30 September before activation. Game 1.10.60 was installed at **20:57:43 UTC** by Statefall Staff from the exact verified ZIP. Admin confirmed the matching signing key and plugin 1.10.10. WP Engine reported caches cleared at **20:58:02 UTC**. Previous release 1.10.59 remains available for rollback.

Anonymous public checks passed: version 1.10.60, exact manifest matching the qualified local build, all 137 payload URLs and all eight help tabs, including 25 building/support, 11 ship and four aircraft cards. Authenticated startup, website imagery, profile, leaderboard and save/resume passed. Test save 85 resumed at 0:20 and advanced. Existing 1.10.59 replay 73 played through at 8x and reported that it matched throughout. A fresh live match (seed HELP1060SCORE, Hungary, Impossible, custom start) ended Overrun at 4.1 minutes and posted successfully (#71 overall, #3 Custom start, credits 74). This synthetic acceptance record and test save remain under Statefall Staff. No console errors or warnings were reported by the test game tab. WordPress's existing in-game help navigation correctly opens the updated website guide. No rollback was needed. Production acceptance passed.

`sandbox/stop.ps1 -DockerDesktop` completed and `sandbox/status.ps1` confirmed Docker Desktop and the Statefall sandbox are stopped. No push occurred.
