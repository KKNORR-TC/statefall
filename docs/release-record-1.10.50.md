# Statefall 1.10.50 — custom flag correction

28 September 2026. **Qualified for manual installation with plugin 1.10.9. Live acceptance remains pending.**

## Fix

WordPress accepts an explicitly null optional emblem accent, but game 1.10.49 rejected it. A logged-in custom nation could stop startup; the same flag in the opponent pool could stop a guest match. Game 1.10.50 permits null only at the optional final accent position of a seven-element emblem layer. All other value validation remains in place, and flag data is preserved. No account or saved flag edits are required.

## Exact package

- Game: statefall-release-1.10.50.zip, 32439659 bytes.
- Build: 2026-09-28-custom-flag-fix; minimum plugin 1.10.9; simulation baseline 1.10.8.
- Game SHA-256: ad23b6c5d25d9b779499093de4a7519bfb0ea4090ae2c5a479593fb203c74476.
- Required plugin: statefall-scores-1.10.9.zip; unchanged SHA-256 c3520f9091873f48e0b9cded7522b701546d69bf14671b5fc7f9a45fa89798bc.
- Base source checkpoint: 0ba48b9. Changed source/test hashes, gate exit codes and raw logs are in [qualification evidence](evidence/release-1.10.50/qualification.json).

## Verification

All final required gates passed: dependency installation, syntax, engine contracts, determinism, replay/restart tests, 365 browser cases (937 existing project exclusions), 21 display-scaling cases, prototype, reproducible builds, loading performance, WordPress basic/security tests and exact artifact installation. The initial syntax run caught stale HTML release markers; these were corrected before the successful full rerun, and the failed log is retained.

The custom flag regression failed before the fix and passed afterward. It covers null/omitted/string accents, malformed null positions and objects, player/opponent engine start and checkpoint restoration. The exact installed build passed three browser scenarios: anonymous, static-file hosting, and real WordPress login with a synthetic custom flag. Guest tests force custom-opponent selection. Fixtures use disposable local accounts, not production data.

Worst cold load plus start: 11.550 seconds at 25 Mbps / 100 ms (limit 15); 27.169 seconds at 10 Mbps / 150 ms (limit 40). Three samples per profile. Existing limits were unchanged. Prior 1.10.49 campaign and artwork evidence remains historical; those full campaign matrices were not repeated for this narrow validation correction.

Docker shutdown and stopped-status checks passed. No production files/settings were changed, and nothing was pushed or deployed.

## Install this game update

1. Keep plugin **1.10.9** installed and retain the current site backup.
2. In WordPress, open **Statefall → Game package**.
3. Upload **statefall-release-1.10.50.zip** and install it. This is the game ZIP, not the plugin ZIP.
4. Purge the relevant page/host cache, then reload /play/ while logged in. Confirm version 1.10.50, your custom nation, and successful match start. Repeat logged out.
5. Verify normal save/resume/replay and score submission before recording production acceptance.

Game 1.10.49 remains held for the custom-flag defect; this update supersedes its installation instructions. Detailed Phase G art reviews and dense-map frame pacing remain previously documented follow-ups.
