# Statefall 1.10.57 — loading screen unit showcase

Qualified 28 September 2026 (America/New_York). **GO for manual production handoff.** Ken requested production packaging; no upload, push, or production access occurred. Production acceptance remains pending installation.

## Identity and scope

- Source base: `d13549211faee2c3c6707a3bfb1ee239296edbaf`, plus the intentional changes captured in `evidence/release-1.10.57/source-final.patch.gz` and the new `loading-units.js.txt` source copy.
- Source checkpoint: `cd1faee` records the tested implementation and harness correction. Created after qualification; the exact installation ZIP was not rebuilt. The source patch remains the original qualification provenance.
- Game: `1.10.57`; build: `2026-09-28-loading-units`.
- Plugin: unchanged `1.10.9`; `REQUIRES_PLUGIN`: `1.10.9`.
- Simulation baseline: `1.10.8`; state schema: `statefall-authoritative-state/v1`; checkpoint schema: `statefall-engine-checkpoint/v2`.
- Existing Windows visual baselines retained. No artwork or simulation rules changed by this patch.
- Production baseline: not inspected; prior release records do not establish the currently installed production version.
- Release owner: Ken; manual installation only after qualification.

The startup screen rotates through six named unit images every three seconds using existing game artwork. Reduced-motion users see a static image. Startup completion or failure stops the showcase. Shared artwork metadata is packaged in a separate chunk to avoid circular asset fingerprints.

## Qualification history

Evidence is retained under `docs/evidence/release-1.10.57/`.

- The initial dependency refresh encountered an executable held by the local animation prototype preview. Stopping that preview allowed `npm ci` to pass.
- The first syntax run detected the old HTML version marker; it was aligned with the new game metadata before the full rerun.
- Docker startup encountered inaccessible Windows runtime socket files. The Docker runtime folders were preserved with `statefall-recovery` backup names and recreated together. No factory reset, database reset, or image deletion was used.
- Local WordPress public routes, authenticated REST, and save CRUD passed.
- The security harness expects Windows PowerShell's HTTP exception types. The initial PowerShell 7 invocation stopped on an expected invalid-replay rejection. The Windows PowerShell rerun passed replay XSS, immutable save kind, Autosave uniqueness, and bot-record isolation checks.
- The full browser run found one existing map-edge test that unconditionally called a worker-only helper in WebKit. The test now asserts that attachment matches browser capabilities and verifies the same edge pixels with or without a worker. All four browser modes passed the focused rerun; no runtime code or pixel assertions were weakened.
- An existing isolated silo-flight handoff had already used version 1.10.56 without bumping the primary checkout's metadata. This release was renumbered to 1.10.57. The historical 1.10.56 record and handoff were preserved. Initial qualification logs are retained under `initial-candidate/`; final version/build, reproducibility, exact installation, startup, and performance gates were rerun for 1.10.57.

## Verification

| Check | Result |
| --- | --- |
| Locked dependencies | `npm ci` passed after releasing the preview executable lock |
| Syntax and Node suites | Passed; `DETERMINISTIC` result `bc43ad4e` / `509ad7e54aa2` |
| Full browser matrix | Initial run: 394 passed, 935 intentional project exclusions, one harness failure; corrected map-edge test passed all four browser modes |
| Display scales and prototype | 21 display-scale cases and one prototype case passed |
| Final version source/built startup | 9 cases passed, including reduced motion, retry, and canonical simulation contracts |
| Reproducibility | Two clean final builds matched all 58 files |
| Local WordPress integration | Public routes, authenticated REST, save CRUD passed |
| Security regression | Windows PowerShell run passed |
| Final exact-ZIP WordPress gate | Passed fresh install, replacement upgrade/data preservation, manifest validation, activation, rollback, retention, signing key, MIME/cache, and all four installed browser scenarios |
| Final ZIP audit | All 57 payload sizes/hashes and embedded version/build verified; 58 total entries |
| Docker cleanup | Repository stop/status scripts confirm Desktop and sandbox stopped |
| Final performance | All existing ceilings passed; three cold samples per scenario; maximum load-plus-start 12.552 s at 25 Mbps / 100 ms (15 s ceiling), 29.618 s at 10 Mbps / 150 ms (40 s ceiling) |

The aggregate `npm run verify` initially exited on the documented WebKit harness error. Its failed case and remaining display-scale/prototype stages were rerun separately to completion. Passing unrelated cases were retained; the full suite was not rerun after the test-only correction or version-only renumbering.

Existing tooling notices are explained rather than suppressed: Vite's large-chunk advisory, the deprecated transitive prebuild-install package, Node module-type inference, and Playwright color-environment notices. Detailed art review and dense-scene pacing follow-ups from prior release records remain; this patch changes only startup presentation and build metadata.

## Final artifacts and decision

| Component | Filename | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Game | statefall-release-1.10.57.zip | 35,983,010 | `57a337c3246e94a63dae6d979e6ab317312da4c6623bd1b51a1631e3798e4050` |
| Unchanged plugin, tested for compatibility | statefall-scores-1.10.9.zip | 212,584 | `c3520f9091873f48e0b9cded7522b701546d69bf14671b5fc7f9a45fa89798bc` |

Game manifest SHA-256: `cedeaaed425b31ba7ff58d89e223c94040df30498585f5504a3841b58055e30e`. Signing-key SHA-256: `c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53`. Final artifacts came from the successful `npm run verify:artifacts` invocation and were not rebuilt or repackaged afterward. Only the game requires a new handoff; keep plugin 1.10.9.

Decision: **GO for manual handoff**, based on the completed gates above. The exact game ZIP, checksum, and this release record are copied to `D:\One Drive\projects - local\statefall\working releases`. No rebuild or repackaging followed the successful artifact gate.

Performance environment: Windows x64, Node 22.23.2, headless Chromium, fresh production-optimized build with guarded test instrumentation. Local desktop load-plus-start median was 536.2 ms; mobile emulation was 527 ms. These measurements do not certify every physical device or production network. Full environment and sample details are retained in `evidence/release-1.10.57/performance.json`.

Install through **Statefall → Game package**, keeping plugin 1.10.9. Before upload, retain a restorable WordPress database backup, current plugin/uploads backup, and previous immutable release for rollback. After installation, purge relevant caches and check anonymous/logged-in play, loading images, game start, score submission, leaderboard/profile, save/resume/replay, and how-to pages.

## Production

Not deployed. Production backups, upload, cache purge, live score submission, save/replay checks, and installed release-pointer verification remain the installer's responsibility.

## Handoff housekeeping

Ken requested local commits and cleanup after qualification. Current game/plugin ZIPs and checksums remain at the handoff root. Older top-level artifacts and notes are preserved unchanged in `superseded/2026-09-28-before-1.10.57/`; earlier archives remain in place. The cleanup inventory records hashes before and after each move. No archive was rebuilt or deleted. See `installation-handoff-1.10.57.md` for current instructions.

Raw logs and source patches are losslessly gzip-compressed. `compressed-evidence.json` records their uncompressed SHA-256 values; each compressed file was round-trip verified before retaining it.
