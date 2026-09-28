# Plugin 1.10.9 corrective release

28 September 2026. **Qualified for manual corrective installation. Production acceptance remains pending.** Plugin 1.10.8 with the split game is on hold because its virtual asset URLs return 404 on the live host.

## Correction

Plugin 1.10.9 serves game asset URLs from the physical immutable uploads directory. The game ZIP remains byte-identical to 1.10.49. [Incident and request evidence](hosting-incident-2026-09-28.md). Production inspection was read-only; nothing was deployed or pushed.

## Exact artifacts

- Plugin: statefall-scores-1.10.9.zip, 212584 bytes; SHA-256 c3520f9091873f48e0b9cded7522b701546d69bf14671b5fc7f9a45fa89798bc.
- Existing game: statefall-release-1.10.49.zip; SHA-256 bcdcd534e3454939d34cebace3af7184bcc2ad89b95d8df0bd56d2c0a6dfc60a. No game reinstall is needed for this correction if 1.10.49 is already active.
- Base source commit: b4ce398; changed executable/test file hashes and gate results are in [qualification evidence](evidence/plugin-1.10.9/qualification.json).

## Verification

Dependency installation, syntax, simulation contracts and determinism passed. The primary browser suite passed 365 cases with 937 existing project exclusions. The initial aggregate verify command failed one display-scale readiness check because local development module requests remained pending. Its trace is retained locally and hashed in the evidence. The unchanged complete scaling suite then passed all 21 cases; prototype passed. No test limit was raised.

Reproducible builds, WordPress basic/security suites, package validation, replacement installation and exact artifact browser checks passed. Both plain /play/ and a host model returning 404 for all virtual asset paths loaded correctly, including stylesheet, artwork and terrain worker. The game archive checksum is unchanged, so previous game loading-budget and campaign qualification remain applicable. Docker shutdown and stopped-status checks passed.

## Installation

1. Retain the current site backup and previous packages. In WordPress Plugins, upload statefall-scores-1.10.9.zip and replace Statefall Scores.
2. Confirm plugin 1.10.9 is active. Keep game 1.10.49 installed.
3. Purge the host/page cache and reload /play/. Check anonymously and logged in that styling, game start, ships, fog and zoom work. Check save/replay and score submission through normal play.
4. Record live verification before calling production accepted. The agent has only read-only production authorization.

The previous plugin 1.10.8 remains held; do not use its old GO handoff for this host.
