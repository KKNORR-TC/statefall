# Original score: situation playback with Radio override

**Ken's review captured 2026-09-29:** use `score-assignments.json` and `score-assignments.md` for the current selections. All 16 tracks are now marked reviewed. The initial grouping below is historical and must not override these selections.

Ken's local library contains 16 stereo 48 kHz WAVs, about 48.7 minutes / 560.8 MB. Masters are inventoried by SHA-256 in `score-library.json` and remain untouched. No production files were read or uploaded. The local review page streams only these catalogued files from localhost and supports seeking without downloading an entire track first.

## Initial grouping — inferred from names, awaiting listening review

| Situation | Draft tracks |
| --- | --- |
| Building / quiet | Drift and Divide; Siege Map Drift; Iron Coast |
| Battle | Salvo; Iron March; Iron Banner March; Siege Heartbeat; Siege Heartbeat (1); Iron Horizon; Seventy-Two Percent |
| Victory / credits | Ashes of Victory; Iron Banner March; Statefall |
| Defeat / credits | Fallen Banners; Fallen Field; Last Banner Falls; Last Honor Call |
| Menu | Statefall |

Iron Coast, Iron Horizon, Seventy-Two Percent and Statefall are particularly uncertain from names alone. Multiple tags are supported. The two Siege Heartbeat files remain distinct candidates, not assumed duplicates. Excerpts use opening, lowest/highest 20-second average level, and ending. Average level does not determine mood, instrumentation or compositional intensity.

## Intended game behavior

- **By situation** is the default music policy. **Radio** overrides it, retaining the current playlist, selected tracks, order/shuffle/repeat, skip and pause controls. Radio should not be interrupted by changing combat intensity or results unless the user returns to situation mode. Milestone ducking applies to either mode.
- **Building / quiet:** economic and construction periods with no sustained player combat. The music may stay low and contemplative while combat SFX fall completely quiet.
- **Battle:** sustained outgoing player combat or attacks threatening the player. A one-off shot or unrelated bot battle is insufficient. Start with a two-second entry confirmation and a 15-second calm-down period; use at least a 30-second track dwell during ordinary activity to prevent frequent restarts. These are tunable presentation defaults, not simulation rules. Incoming critical threats and match results can override dwell.
- Use roughly 2–4 second crossfades, preserving pauses, mute and volume. Continue a track if it belongs to both situations. Phrase-aligned changes require hand-authored markers; do not infer beat alignment from filenames or waveform peaks.
- **Victory / defeat:** the actual match result selects its score for the end screen and credits. Enemy elimination is not necessarily match victory. A lost attack is not match defeat. The short Taps elimination cue and capture fanfare remain independent SFX milestones.
- **Completed territory:** one fanfare per completed neutral or enemy territory. No per-tile cue. Enemy elimination supersedes the coincident capture fanfare. A dedicated score duck bus sits after track crossfade gains and before the user music-volume bus; duck to 20%, then restore to unity. This prevents a new track or user volume adjustment from fighting the duck envelope.
- Empty categories or unavailable audio should use another suitable recorded track, or remain silent if none exists. Remove the procedural music fallback and its playlist entry during integration.

## Existing code and integration boundary

`game/src/legacy-game.js` owns JUKE, playlist preferences, track transitions and end/credits selection. `plugin/statefall-scores/includes/music.php` exposes menu/game plus victory/defeat/credits stings. Victory and defeat routing already exists; building/battle tags and a separate situation-versus-Radio preference must be added. Existing `JUKE.mode` means order/shuffle/repeat and must not be repurposed for that new preference.

The current one-category schema should gain optional multi-valued situation tags while continuing to serve existing menu/game/stings fields for compatibility. The admin needs editable situation tags. Shipping assets should be compressed derivatives, not the large WAV masters; no uploads are authorized by this prototype work.

The prototype review page demonstrates assignment, manual situation selection, full-track queueing and Radio persistence. It does not connect to match state or implement game crossfades/hysteresis. The sound-effects page separately demonstrates automatic score ducking. Final game integration, procedural music removal and release verification remain pending, with replay/determinism gates and repository sandbox lifecycle rules applying as appropriate.
