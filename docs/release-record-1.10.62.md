# Statefall 1.10.62 — tactical pause

## Identity and scope

- Source: `f8c1ade044be697504d45913f76e9a31d08ed17c`, published to GitHub main with Ken's explicit authorization.
- Game 1.10.62 / `2026-09-30-tactical-pause`; plugin remains 1.10.10, minimum 1.10.9; simulation baseline 1.10.8 unchanged.
- Compact pause panel keeps the battlefield available for camera movement and inspection. Paused orders respect the match setting. Help pauses a running match and restores its previous pause state on closing. Space/Escape and restart cancellation are covered.
- About, shared guide and changelog updated. Tutorial campaign is a subsequent design deliverable, not part of this release.

## Qualification

- Fresh npm ci and full npm run verify passed: 434 browser cases, 940 intentional project exclusions, 21 display-scale cases and one prototype case. Node, syntax, replay and deterministic simulation checks passed: 85/85 commands, final state `bc43ad4e`, digest prefix `509ad7e54aa2`.
- Reproducibility: 138 matching files across two clean builds.
- Sandbox verification and security regression passed. Exact artifacts passed installation, upgrade/data preservation, activation, rollback/retention, MIME/cache paths and four installed browser cases, including packaged About.
- Performance passed all ceilings with three cold samples per scenario. Reported load/start: broadband 12,297/282.5 ms; constrained 29,412.1/257 ms. Full report in `evidence/release-1.10.62/performance.json`.
- Docker startup failed on stale Windows runtime socket entries. Socket-only directories were preserved under timestamped names and recreated; no factory reset or database/volume removal. Successful verification followed recovery. Docker Desktop and sandbox stopped after qualification, confirmed by status log.
- Existing prebuild-install deprecation is tooling-only; intentional browser project exclusions are unchanged. No unresolved qualification failures.

## Exact artifact and decision

Local release **GO**. `statefall-release-1.10.62.zip`, 42,583,242 bytes, SHA-256 `bce72f6c05bd62609c12386b107719651868c5d453f412786c2027bbfed1f336`. Independently verified all 137 payload hashes/sizes and 138 archive entries. Signing-key SHA-256 `c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53`. The exact tested ZIP was copied to working releases without rebuilding or repackaging.

## Production

Ken explicitly requested deployment. The restorable backup confirmation recorded in `release-record-1.10.61.md` applies to this release session; the hosting portal backup was not independently inspected.

Installed and activated 1 October 2026 at 01:58:14 UTC as Statefall Staff. Admin confirmed version/build and matching signing key. WP Engine caches cleared at 01:58:52 UTC. Plugin remains 1.10.10; immutable 1.10.61 retained for rollback. No rollback needed.

Production acceptance completed:

- Anonymous entry, matching manifest and all 137 payload URLs passed. All eight help fragments passed, with 40 roster portraits and current About metadata. Website navigation and packaged About checked visually.
- Authenticated startup shows game/site package 1.10.62. Profile and leaderboard load correctly.
- PAUSE1062LIVE synthetic match paused at 0:05. Camera movement/inspection worked while clock and resources stayed frozen; Help preserved manual pause and paused a running match. Saved from the pause panel, located the account save and resumed at 0:05 with normal advancement.
- Historical HELP1060SCORE from 1.10.60 completed at 8x with “The replay matched the recording throughout.”
- Resumed acceptance match finished Overrun at 4.2 minutes; “Community score posted” confirmed #81 overall, #3 Custom start, credits 86. Synthetic acceptance records retained under Statefall Staff. Live console had no errors/warnings.
- Screenshots: `evidence/release-1.10.62/live-install.png`, `live-pause.png`, `live-score.png`.

One additional historical recording, GUIDE1061LIVE from 1.10.61, was rejected before playback because checkpoint 100 is absent. The unchanged takeover path copies commands without earlier checkpoints; see `replay-resume-checkpoint-followup.md`. This pre-existing recording-integrity issue is documented separately; validation was not relaxed and no simulation divergence occurred in the established valid replay. Docker remains stopped.
