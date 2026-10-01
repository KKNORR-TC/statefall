# Statefall 1.10.59 — authored audio and paused-save compatibility

29 September 2026. **Published to production; live acceptance passed. Ready for Ken's play testing.**
Ken authorized production game/plugin updates and requested notification when the
game is ready for play testing. No push is authorized. Final paired plugin is 1.10.10.

## Identity and change

- Source base `37a85e6ec0ac4e2dc22644973d7385109dce1bbe` plus the audio work and
  paused-save correction captured in the release evidence.
- Game `1.10.59`, build `2026-09-29-audio-save-resume`, minimum plugin `1.10.9`.
- Plugin `1.10.10` accepts the game's existing `Overrun` defeat label. It preserves
  signing, duplicate protection, score formula and plausibility checks. No schema
  changes are introduced. This server compatibility patch also benefits older games.
- Simulation baseline `1.10.8`; canonical/checkpoint schemas, RNG, command stream
  and simulation rules are unchanged. Existing visual baselines retained.
- Includes all approved audio from [1.10.58](release-record-1.10.58.md): 36 locked
  effects, three combat layers, and situation selection over all 16 hosted tracks.
- Production 1.10.58 was installed at 16:39:11 UTC and rolled back to 1.10.57 at
  16:41:42 UTC when the new paused save failed acceptance. The smoke-test save's
  simulation, RNG, commands and legacy hash match exactly. Its canonical digest
  matches when only `paused` and `userPaused` are true, as they were on saving.

Single-player final verification now compares exact canonical states differing
only in those two controller pause flags. It does not mutate live authority or
change saved metadata. All other state, checkpoint, tick, RNG and command checks
remain enforced; duplicate final-digest fields must agree. Multiplayer proof
verification remains strict. This also recovers existing paused saves without
rewriting them. The CLI verifier uses the same engine comparison.

## Verification

The broad audio qualification is preserved in the 1.10.58 record: full Node suite,
386 passing browser cases followed by a clean 47-case affected-test rerun, 21
display-scale cases, prototype, local WordPress/security, reproducibility,
exact-ZIP installation and all performance ceilings. The replacement reruns full
Node/determinism, affected replay/audio/source/built browser coverage,
reproducibility, exact-ZIP WordPress installation, performance and Docker cleanup.
No unrelated rendering coverage was removed or baseline changed.

New engine regression covers all four pause-flag combinations, successful final
evidence, no authority mutation during comparison, and rejection of a non-pause
state difference. A browser regression saves after opening the real pause menu,
resumes to the exact target with verified final evidence, then advances live.
The downloaded smoke-test save passes the corrected CLI verifier unchanged.

Windows Playwright WebKit does not expose Web Audio. Its silent UI fallback is
tested; actual Safari audio decoding remains a coverage limitation. Chromium and
Firefox decode all 55 local audio recordings. Production original score files are
the already enabled shared MP3 recordings; no duplicate music upload is needed.

## Final artifacts and decision

| Check | Result |
| --- | --- |
| Locked dependencies, syntax, full Node suite | Passed; deterministic `bc43ad4e` / `509ad7e54aa2`, 85/85 commands |
| Affected browser matrix | 44 passed, 10 intentional exclusions; three new pause-menu cases initially stopped because the test attempted loading before returning to the start screen |
| Corrected pause-menu test | All three desktop engines passed after a real page reload, matching the production save/resume navigation |
| Reproducibility | Two clean builds matched all 98 files |
| WordPress/security | Both established suites passed |
| Exact-ZIP installer | Passed lifecycle/integrity/rollback and all four installed browser scenarios |
| Final ZIP audit | All 97 payload sizes/hashes, embedded versions and 39 effect files verified |
| Performance | All ceilings passed; three samples/profile; maximum 12.544 s at 25 Mbps / 100 ms and 29.616 s at 10 Mbps / 150 ms |
| Docker | Temporary socket startup failure recovered without data reset; repository stop/status confirms fully stopped |

Game `statefall-release-1.10.59.zip`: **37,413,809 bytes**, SHA-256
`6c0d82a39938c12e4e26b90e179c7144c80ebea9514bb851ca3bf1ddc438441a`.
Manifest SHA-256: `448b3b8707ec7b16226df180148e301994f53ea93494cf5c0664e741fc0c76b9`.
Plugin `statefall-scores-1.10.10.zip`: **212,776 bytes**, SHA-256
`a3a34f7ff11fa2b50a4821ee1ab56766ad73cdd042f94b8d88dd1e18e46de289`.
These exact ZIPs came from the final successful paired artifact gate and were not
repacked afterward. The game ZIP is byte-identical to the already installed game.
The plugin gate passed upgrade/data retention, all four installed browser cases,
signed Overrun submission, duplicate protection, and rejection of bad signatures,
unknown outcomes and winning-share Overrun claims. Security regression passed.
Keep the previous immutable 1.10.57 release available. The 1.10.58 archive is
preserved but is not approved. Evidence is in `evidence/release-1.10.59/`.

## Production

Ken confirmed a full WP Engine backup completed at 12:14 PM on 29 September:
"All content has been successfully backed up."

Game 1.10.59 was installed on 29 September at **17:23:58 UTC** by Statefall Staff.
Plugin 1.10.10 was subsequently installed through WordPress replacement upload;
the game admin confirms both versions and a matching signing key. This follow-up
plugin patch was required when live acceptance exposed the existing server's
rejection of the game's Overrun label. Caches were cleared after both changes.
The earlier 1.10.58 rollback is recorded above; 1.10.59 remains active and the
previous approved 1.10.57 remains available for rollback.

Live acceptance passed: authenticated startup and gameplay, all 16 score tracks,
situation/Radio switching, effect playback, defeat music, leaderboard, profile,
save/resume, replay, and all eight how-to pages. The original paused smoke save
now loads and resumes without divergence. A real short match under Statefall Staff
ended Overrun and posted successfully (#61 overall, #3 Custom start); the fresh
test tab reported no console warnings or errors. Its synthetic test record remains.
Anonymous HTTP checks confirmed version 1.10.59 with no authenticated user,
the exact release manifest hash, all 97 payload requests, and audio MIME types.
Anonymous interactive startup was covered by the exact-ZIP local browser gate.

Docker Desktop and the sandbox are fully stopped. Final evidence is preserved in
`evidence/release-1.10.59/`, including the public production check. No Git push
was performed. Human audio balance/play testing remains Ken's next step.
