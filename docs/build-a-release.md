# Building a Statefall release from these files

This is the authoritative local build and manual WordPress deployment runbook. The source game is the Vite application under `game/`; the source plugin is `plugin/statefall-scores/`. Approved artifacts are copied to `D:\One Drive\projects - local\statefall\working releases`, which is a handoff location rather than source authority.

## Release gate

1. Confirm the intended source commit and inspect `git status` so the artifact's exact inputs are known.
2. Update every changed component's version and changelog. Verify the game's `REQUIRES_PLUGIN` value against the plugin being deployed.
3. Run `npm ci`, `npm run verify`, and `npm run test:build-reproducibility`. Require `DETERMINISTIC ✓` for simulation changes.
4. Run `.\sandbox\start.ps1` before any Docker-backed command. Then run `.\sandbox\verify.ps1`, `.\sandbox\security-regression.ps1`, and `npm run verify:artifacts`. The artifact command builds deterministic game/plugin ZIPs, installs those exact files into disposable WordPress, and tests package lifecycle and headers.
5. Treat the ZIPs produced and installed by the successful `npm run verify:artifacts` invocation as the final candidates. Inspect their internal paths and embedded versions and calculate SHA-256 checksums without rebuilding or rezipping them.
6. Run applicable performance/device qualification, including `npm run perf:browser` for a changed game build. Review `docs/current-status.md`. Any unresolved release-blocking finding, failed check, skipped required check, applicable performance-budget failure, or unexplained warning makes the release NO-GO. Changing a measurement method or budget requires an evidence record and a passing rerun; do not merely raise a failing ceiling.
7. Complete `docs/release-record-template.md` with the commit, component versions, filenames, checksums, fixture/baseline revisions, test results, and GO/NO-GO decision. Keep a copy with the release artifacts.
8. Whether verification passes or fails, finish with `.\sandbox\stop.ps1 -DockerDesktop` and confirm `.\sandbox\status.ps1` reports Docker Desktop and the sandbox stopped.

## Game package

Build `statefall-release-x.y.z.zip`:

1. Complete the release gate above, using `npm ci` to install the locked tooling.
2. For development inspection, run `npm run build:release` for the game alone or `npm run build:artifacts` for all artifacts. For handoff, use only the exact ZIP produced by the successful `npm run verify:artifacts` gate. Do not manually rezip its output.
3. Use `.artifacts/statefall-release-x.y.z.zip`. The same build produces inspectable `dist/`; the ZIP contains root `release.json`, `index.html`, hashed `assets/`, `bundle-report.json`, `howto/`, `flags.js`, and `VERSION.txt` with deterministic entry order and timestamp.
4. Inspect `release.json`: schema `1`, game/build/minimum-plugin versions, signing-key SHA-256, entry and flags paths, and every payload file's byte size and SHA-256 must match the ZIP.
5. Rerun the complete Docker-backed artifact gate after any source or generated-file change. The exact ZIP installed by the passing invocation is the ZIP handed off.

## Plugin package

`npm run build:artifacts` writes `.artifacts/statefall-scores-x.y.z.zip`, preserving `statefall-scores/` as the top-level directory. Keep `Version:`, `STATEFALL_VERSION`, and `Stable tag` consistent. The artifact harness performs both fresh installation and replacement upgrade from this exact ZIP and verifies data preservation.

## Production handoff

1. Copy only approved, checksum-recorded ZIPs to `D:\One Drive\projects - local\statefall\working releases`.
2. Before uploading, obtain a restorable WordPress database backup and backups of the current plugin and Statefall uploads. Game releases are complete immutable directories, but they do not replace a site/database backup.
3. If both components change, upload the plugin first through Plugins → Add New → Upload Plugin → Replace current with uploaded.
4. Upload the game through Statefall → Game package → Install.
5. Do not dismiss signing-key, package-validation, or minimum-plugin warnings. Stop and investigate them.
6. Purge relevant caches and verify `/play/` anonymously and while logged in.
7. Verify the displayed versions, game start, leaderboard, profile, save/resume, replay, how-to pages, and one complete score submission.
8. Rollback by selecting an inactive immutable release under Statefall → Game package. This atomically appends to `uploads/statefall/release-pointers/`; it does not replace a pointer or copy package files.
9. Keep the previous approved artifacts and backups until post-deployment verification is complete. The plugin retains the active release plus the latest five inactive releases.

Record the deployed time, uploader, production versions, checksums, verification result, and any rollback in the release notes. Local success is not production acceptance.

Before any release that touches the simulation, `npm test` must pass and print `DETERMINISTIC ✓`. In PowerShell, customize a run with commands such as `$env:SEED='X'; $env:TICKS='2000'; npm run determinism`.

Always finish Docker-backed work with `.\sandbox\stop.ps1 -DockerDesktop`, then confirm `.\sandbox\status.ps1` reports Docker and the sandbox stopped.
