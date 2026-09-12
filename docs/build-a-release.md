# Building a Statefall release from these files

This is the authoritative local build and manual WordPress deployment runbook. The source game is `game/index.html`; the source plugin is `plugin/statefall-scores/`. Approved artifacts are copied to `D:\One Drive\projects - local\statefall\working releases`, which is a handoff location rather than source authority.

## Release gate

1. Confirm the intended source commit and inspect `git status` so the artifact's exact inputs are known.
2. Update every changed component's version and changelog. Verify the game's `REQUIRES_PLUGIN` value against the plugin being deployed.
3. Run `npm ci`, `npm run syntax`, and `npm test`. Require `DETERMINISTIC ✓` for simulation changes.
4. Run `.\sandbox\start.ps1` and `.\sandbox\verify.ps1` to syntax-check every plugin PHP file and exercise the local WordPress integration.
5. Review `docs/current-status.md`. Any unresolved release-blocking finding, failed check, or unexplained warning makes the release NO-GO.
6. Build the artifacts, inspect their internal paths and embedded versions, and calculate SHA-256 checksums.
7. Complete `docs/release-record-template.md` with the commit, component versions, filenames, checksums, test results, and GO/NO-GO decision. Keep a copy with the release artifacts.

## Game package

Build `statefall-release-x.y.z.zip`:

1. Complete the release gate above, using `npm ci` to install the locked tooling.
2. Run `npm run release:assets` to generate `pkg/howto/` and `pkg/flags.js`.
3. Put a copy of `game/index.html` at the archive root as `index.html`; also include `pkg/howto/` as `howto/`, `pkg/flags.js` as `flags.js`, and `VERSION.txt`.
4. Inspect the ZIP before handoff. Its root must contain `index.html`, `howto/`, `flags.js`, and `VERSION.txt`, not a wrapping project directory.

## Plugin package

Zip the `plugin/statefall-scores/` directory as `statefall-scores-x.y.z.zip`, preserving `statefall-scores/` as the archive's top-level directory. Keep `Version:`, `STATEFALL_VERSION`, and `Stable tag` consistent.

## Production handoff

1. Copy only approved, checksum-recorded ZIPs to `D:\One Drive\projects - local\statefall\working releases`.
2. Before uploading, obtain a restorable WordPress database backup and backups of the current plugin and Statefall uploads. The plugin's Game package → Previous versions feature is a partial convenience rollback, not a complete site or package backup.
3. If both components change, upload the plugin first through Plugins → Add New → Upload Plugin → Replace current with uploaded.
4. Upload the game through Statefall → Game package → Install.
5. Do not dismiss signing-key, package-validation, or minimum-plugin warnings. Stop and investigate them.
6. Purge relevant caches and verify `/play/` anonymously and while logged in.
7. Verify the displayed versions, game start, leaderboard, profile, save/resume, replay, how-to pages, and one complete score submission.
8. Keep the previous approved artifacts and backups until post-deployment verification is complete.

Record the deployed time, uploader, production versions, checksums, verification result, and any rollback in the release notes. Local success is not production acceptance.

Before any release that touches the simulation, `npm test` must pass and print `DETERMINISTIC ✓`. In PowerShell, customize a run with commands such as `$env:SEED='X'; $env:TICKS='2000'; npm run determinism`.
