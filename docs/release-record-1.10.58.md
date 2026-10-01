# Statefall 1.10.58 — authored battlefield audio

Qualified locally 29 September 2026, then **ROLLED BACK / NO-GO for production.** All required
local checks and the production backup prerequisite are complete. Ken explicitly
authorized game/plugin updates after signing in to production admin. No push is
authorized. Only the game requires an update; plugin 1.10.9 remains compatible.

## Identity and scope

- Source base: `37a85e6ec0ac4e2dc22644973d7385109dce1bbe` plus the intentional audio changes.
- Game: `1.10.58`; build: `2026-09-29-authored-audio`; minimum plugin: `1.10.9`.
- Simulation baseline: `1.10.8`; no rules, schema, RNG or tick changes.
- Existing Windows visual baselines retained.
- Production baseline inspected in authenticated admin: game 1.10.57, build
  `2026-09-28-loading-units`, plugin 1.10.9, installed 29 September at 03:06:08
  (admin display). The immutable active package remains available for rollback.
- Ken approved all 36 sound families, natural variants, through the field-test
  review. Exported Ogg hashes match the locked decisions. Three approved battle
  layers also ship. See [audio integration](audio-integration.md).
- All 16 reviewed original score recordings already exist and are enabled in
  production. All URLs returned 200, audio/mpeg and nonzero lengths. The title
  `Death Comes For Everyone` maps to the original `Siege Heartbeat (1)` by filename
  and duration. No music uploads or admin category changes were needed.

The new game uses those shared music files rather than duplicating them inside
the installer, which has a 50 MB upload limit. The catalog applies Ken's reviewed
multi-role assignments while preserving hosted IDs, names and enabled status.
Local previews mirror shared music paths using compressed original masters.

## Qualification history

- The first focused browser run passed Chromium/Firefox decoding for all 55 audio
  files. Windows Playwright WebKit exposes no Web Audio constructor; the revised
  test covers a usable silent UI in that environment. Actual Safari/WebKit audio
  decoding remains unverified; this is recorded as a platform coverage limitation.
- Focused startup, source/built contracts and audio controls: 16 passed, two
  intentional project exclusions before the final hosted-score packaging change.
- `npm ci` passed. Existing Node suites passed with deterministic digest
  `bc43ad4e` / `509ad7e54aa2`, 85/85 commands, no divergence.
- Docker startup encountered the same stale Windows socket problem documented for
  1.10.57. The repository stop script shut it down. Temporary `Docker/run` and
  `docker-secrets-engine` socket directories were preserved with dated 1.10.58
  names and recreated together. No databases, images or container data were reset.
- The full browser run encountered a development reload during the enabled-track
  filtering fix. One Chromium air-wreck case lost its execution context; Vite's
  resulting module query also prevented the score-retry harness's exact-path
  interceptor from attaching in nine cases. Three serial cases did not run.
  A clean-server rerun passed the entire affected effects file, all nine score
  rejection cases, final audio controls and source/built startup contracts.
- Final presentation refinement adds completed neutral-country conquest cues and
  coalesces simultaneous outcomes, prioritizing elimination over enemy capture
  over neutral capture. No simulation rules or approved sound bytes changed.

## Verification

| Check | Result |
| --- | --- |
| Dependencies, syntax and Node suites | Passed; deterministic digest `bc43ad4e` / `509ad7e54aa2`, 85/85 commands |
| Audio model/approval tests | Passed, including simultaneous outcomes and pending reset cancellation |
| Full browser matrix | 386 passed, 939 intentional project exclusions, 10 reload-related failures and 3 serial cases not run; affected cases passed the clean rerun below |
| Final focused rerun | 47 passed, 40 intentional project exclusions; all audio, score retry, global effects, source/built startup cases applicable to the selected projects passed |
| Display scales/prototype | 21 display-scale cases and one prototype case passed |
| Reproducibility | Two clean final builds matched all 98 files |
| Local WordPress/security | Both established suites passed |
| Exact-ZIP installation | Passed package lifecycle, integrity, replacement/data preservation, rollback, headers and four installed browser scenarios |
| Final ZIP audit | 97 payload sizes/hashes verified; 98 total entries; 39 effect assets; no duplicate score payload |
| Docker cleanup | Repository stop/status scripts confirm Desktop and sandbox stopped |
| Performance | All ceilings passed, deterministic; three cold samples per profile; maximum load-plus-start 12.544 s at 25 Mbps / 100 ms (15 s ceiling), 29.614 s at 10 Mbps / 150 ms (40 s ceiling) |

The aggregate verify command stopped on the documented reload-related browser
failures. All affected tests and remaining display/prototype stages were run
separately. Passing unrelated cases were retained. Existing Vite chunk-size,
Node module-type and Playwright color-environment notices are unchanged tooling
advisories. Evidence and source provenance are in `evidence/release-1.10.58/`.

## Artifacts

| Component | Filename | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Game | statefall-release-1.10.58.zip | 37,413,221 | `799e4523e77d735511a0b387a5724d26cc328289ec42c0d27ba51c03f5e89f15` |
| Unchanged plugin | statefall-scores-1.10.9.zip | 212,584 | `c3520f9091873f48e0b9cded7522b701546d69bf14671b5fc7f9a45fa89798bc` |

Manifest SHA-256: `44bc9055bc2b354bb127cec9103640b5ce5c8b4a05ed28578cf7be1965ec5a20`.
Signing-key SHA-256: `c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53`.
These are the exact ZIPs installed by the passing artifact gate. They have not
been rebuilt or repackaged. Only the game needs deployment.

## Production

The runbook requires a restorable database and site-files backup before upload.
Ken confirmed the WP Engine backup completed at 12:14 PM on 29 September 2026:
"All content has been successfully backed up." This satisfies the pre-upload
backup prerequisite. Production game/plugin installation and post-deployment
checks initially remained. The exact ZIP was installed at 16:39:11 UTC by
Statefall Staff. Live startup, all 16 hosted tracks, situation/Radio controls,
effect playback and save creation passed. Resume of the newly created smoke-test
save failed at tick 59. Production was immediately restored to 1.10.57 at 16:41:42
UTC. The downloaded test save proved that every canonical byte matches when only
`paused` and `userPaused` are restored to true; simulation, RNG, legacy hash and
commands are unchanged. This is a pre-existing paused-save verification defect.
Candidate 1.10.59 corrects that boundary and requires fresh qualification. The
1.10.58 archive remains preserved, inactive, and must not be handed off as GO.
