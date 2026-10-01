# Audio integration — 29 September 2026

Published as game 1.10.59 with plugin 1.10.10; live acceptance passed.
See [the final release record](release-record-1.10.59.md).
Ken approved 36 sound families through seven field-test revisions. The selected
Ogg files are copied byte-for-byte; `game/src/audio/approval-manifest.json` records
their SHA-256 hashes. Original WAV masters, review decisions and ratings remain
in the audition workspace. No approved sample was reauthored during integration.

## Playback

- **By situation** is the default. It uses Ken's reviewed assignments for all 16
  original tracks. Ground combat involving the player enters battle after two
  seconds; a player missile launch or incoming missile enters immediately. Battle
  music remains for at least 30 seconds and returns to building after 15 quiet
  seconds. A compatible current track continues across a role change.
- **Radio playlist** preserves song selection, order, shuffle and repeat controls.
  Clicking a track selects Radio explicitly. The choice persists across visits.
  Optional hosted playlist entries remain available alongside the original score.
  Hosted recordings are matched by title or original filename plus duration and
  inherit the reviewed multi-role assignments. Hosted IDs and display names are
  preserved; local previews serve compressed copies of the reviewed originals.
- Actual match victory/defeat selects the corresponding score category in
  situation mode. An individual enemy elimination does not select victory music.
  Credits use the reviewed result category, with the existing song picker override.
- No procedural music or synthesized effect fallback remains. The retired arcade
  cash/coin/UI jingles are silent. Missing audio stays silent instead of retrying
  forever or synthesizing a replacement.
- Two-second music crossfades feed a separate ducking gain before the user's music
  volume. Capture bugles and Taps lower score to 20%, then restore it smoothly.
  Paused music, music-off and mute remain respected during role changes and credits.

## Game events

- Completed neutral-country conquests and full held regions/islands/continents
  trigger capture cues, never individual tiles. Simultaneous completion events
  coalesce: enemy elimination takes priority over enemy capture, then neutral
  capture, so one advance cannot stack several bugle calls.
  Enemy occupancy is remembered across a partial campaign, so enemy and neutral
  captures remain distinct after the last enemy tiles disappear. Recaptures can
  sound again. Initial world installation and replay catch-up do not announce
  old captures. Elimination events trigger Taps only for player-caused enemy deaths,
  including nuclear and conventional bombardment.
- Ground order confirmation belongs to the player. Insufficient force with no
  progress uses failure; a force exhausted after gaining ground uses stalled.
- Active fronts drive the approved machine-gun, track and artillery layers.
  Machine guns retain the audition's 12% layer setting. Player attacks and attacks
  on the player are foreground; bot fronts must be visible and on screen and use
  the quieter, low-pass distant mix. No fronts means no battle ambience. Pause,
  reset, hidden page and replay catch-up stop combat layers.
- Construction starts use the worksite sound. All 20 building types have their
  own completion cue; upgrades use the same identity. Instant buildings play the
  start followed by their completion. These cues are player-owned only.
- Missile launches, incoming warnings, SAM launches/interceptions, nuclear blasts,
  artillery, impacts and sinking use the approved samples. Positional incidental
  effects are filtered through visibility and camera bounds.

## Assets and boundaries

39 effect files (36 approved cues plus three battle layers) ship in the game. The
16 score recordings remain in the site's existing shared music library; they are
not duplicated in the release ZIP. Local previews mirror those paths using the
compressed original recordings. Audio is fetched on demand, with at most three
music buffers cached. It is not preloaded as a full library on startup. Vite emits
hashed relative effect URLs suitable for installed game-release subdirectories.
`tools/export-approved-audio.py` verifies approval and master hashes before export.

The audio menu links the source credits, including Department64's CC BY 4.0 tank
foley attribution, license and modification notice. Original score rights remain
with Ken. The game credits also acknowledge the score and tank foley.

Only presentation event names/coordinates changed inside simulation systems; no
rules, state schema, simulation RNG or tick timing changed. Situation timers,
mixing, capture tracking and playlists live outside canonical simulation state.

## Verification

- Existing `npm test`: passed, including restart/replay parity and determinism.
- `npm run test:audio`: roles/dwell, whole-territory detection, fog perspective,
  approved-file hashes, pending sample cancellation and independent ducking.
- Browser coverage in `tests/browser/audio.spec.js`: all 55 compressed files
  decode in Chromium and Firefox; source controls, persistence, pause/mute and
  late-download cancellation pass. Windows Playwright WebKit exposes neither
  AudioContext nor webkitAudioContext: the silent UI fallback passes, but actual
  Safari/WebKit audio decoding remains unverified.
- Built contract expects 39 shipped effect assets and retains canonical-state,
  asset-request and production diagnostic-stripping assertions.

Full release qualification, exact-ZIP Docker installation, production deployment
and live acceptance are complete; evidence and limitations are in the release record.

### Hosted music verification

At Ken's explicit request, the public production playlist and all 16 distinct audio
URLs and the authenticated admin list were checked on 29 September. All 16 admin
entries are enabled. Every URL returned HTTP 200, `audio/mpeg`, and a
nonzero size; metadata durations match the reviewed masters to within 0.01 seconds.
That library-only check required no upload, deletion or category edit. The game
integration was subsequently deployed as 1.10.59.
The renamed **Death Comes For Everyone** is the original **Siege Heartbeat (1)**
recording (`2fa4ea9d-Siege-Heartbeat-1.mp3`, 213.96 seconds).

The current music admin has one category per track. The local game integration
therefore applies Ken's reviewed situation roles in its catalog without changing
the production admin categories. Plugin 1.10.10 was deployed separately to accept
the game's existing Overrun outcome during score submission.
