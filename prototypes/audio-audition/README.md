# Statefall audio audition

Local review prototype, expanded to reflect Ken's priorities. This standalone prototype does not change the game or its music player. Generated-music removal and game integration remain the next implementation stage after sound-direction feedback.

## Listen

`score-library.html` now provides the 16-track original-score review: title-based draft tags, 20-second excerpts, full-track situation queues and Radio override. Assignments persist in browser storage and can be exported. See `situation-score-plan.md` for the proposed game behavior and integration boundaries. Original WAVs remain in Ken's `audio tracks` directory and are streamed read-only by a fixed catalogue ID.

From the authoritative repository root, run `node prototypes/audio-audition/serve.cjs`, then open http://127.0.0.1:4187. The listening page has:

- Your attack / you are under attack / visible bot battle / no fighting perspectives.
- Independently adjustable recorded machine guns, track squeaks/clatter and artillery.
- 36 effect families in Natural and Reinforced treatments: 72 individual effects.
- Ground attack start, progress, stalled, succeeded and failed; construction start and complete; missile launch, SAM launch, SAM intercept, nuclear detonation and incoming warning; heavy artillery, shell impact and ship sinking.
- Six context sequences, including true silence before and after a ground battle, and three isolated fighting layers.
- Optional local music playback for comparison. No production music access.

Click **No fighting** to fade out the battle. **Stop all** or Escape stops sounds and pauses optional music. Hiding the page also stops playback. The small-speaker option is an approximate bass rolloff, not a calibrated device simulation. Master audition volume applies to effects; the optional music player has its own volume.

## Deliverables and limitations

`audio/` contains 48 kHz stereo 24-bit WAV edits and Ogg listening copies. These are authored edits of licensed recordings/foley; no new oscillator tones, synthesized noise or generated music. Source fidelity varies: public Freesound HQ MP3 previews are identified in `sources.json`, and lossless originals are still needed for final mastering. The tank layer includes tank-inspired foley and a tracked construction vehicle, not a claimed field recording of a military tank.

Signal checks are in `audio-checks.json`: decode, finite/non-silent data, stereo/sample rate, tapered endpoints and 4x oversampled peak checks. These establish technical integrity, not aesthetic approval. Listening feedback remains necessary; no claim is made that the sounds were personally auditioned by the assistant. Alternate edits are not a replacement for several distinct recorded takes in the shipping game.

See [opportunity-map.md](opportunity-map.md) for the mechanics review and implementation plan, and [SOURCES.md](SOURCES.md) for attribution. Department64 tank foley is CC BY 4.0 and must retain attribution wherever derived sounds ship. Other selected effects are CC0; the two official military bugle recordings are public domain in the United States (see source evidence). Archived HTML files are license evidence only, not executable content for the listening page.

## Reproduce

The offline authoring script uses Python, NumPy, SciPy and SoundFile. This workspace has these tools under `.artifacts/audio-python`; this folder is not part of the game or package dependencies. Run `python prototypes/audio-audition/author.py` from the repository root with the required libraries available. Exact local source inputs and hashes are listed in `audio-checks.json`. `download-sources.py` can restore missing public downloads using `sources.json` and rejects changed hashes. The source archives can be extracted into `sources/naval` and `sources/impacts` as already supplied locally.

No Docker, game build, release package, push or deployment is needed for this isolated audition. A future game integration must follow the repository's normal verification and release rules.

## Revision 3 — completed milestones and ambient gunfire

The two capture buttons audition the same recorded fanfare for a **completed territory**, neutral or enemy-held. They do not represent tile ownership updates. Enemy elimination uses a 7.3-second opening phrase of Taps, not the full ceremony. Elimination interrupts a capture cue; repeated capture clicks during a cue are coalesced. Individual milestone previews lower the optional music bus to 20% over 180 ms, then restore it over 900 ms. They preserve the music element's volume, mute and paused state. Stop all restores the bus and pauses music. Context sequences are pre-rendered SFX demonstrations, without timed score ducking.

Machine guns now default to 12% (previously 65%); arranged combat reduces their mix contribution by 80%. Tracks and artillery retain their live defaults. The completed-territory trigger is an integration requirement, not a claim that the prototype is connected to game events.

## Revision 4 — capture distinctions and building identities

Supersedes the shared capture fanfare in revision 3. Neutral capture is a 2.05-second held bugle salute; enemy capture is a 3.70-second closing flourish (reinforced versions add 0.577 seconds of reflection). Taps remains unchanged. Both captures still duck the score and require completed territory events, never tile events.

Construction starts with a 1.4-second recorded hammering excerpt. All 20 current STRUCT types have separate completion entries, exposed through the building selector and a name-hidden recognition check. Signatures use recorded engines, horns, gates, footsteps, hammering and designed machinery/air textures. They are candidates for perceptual review, not a claim that all 20 are already identifiable by ear. Related sensor/command types are the highest confusion risk. Instant construction plays only the building-specific completion, without stacking a start cue.

The manifest is authoritative for current previews; old revision audio files may remain for comparison, but are not referenced by the page. No game integration or production change is included.

## Revision 5 — fewer similar motors

All 16 original-score assignments are now reviewed (see `score-assignments.json`). Construction completion feedback rejected the shared motor character. Sixteen building completion families were rebuilt around eight additional CC0 recordings: chain, hand ratchet, industrial switch composite, manual shutter, camera shutter, steam release, RF interference and radio crackle. Factory alone retains the diesel start. No completion now uses the tank motor/servo or rocket air-flow layers. City, factory, port, troop command, construction starts, battle and capture cues stay unchanged.

The page provides six contrasting completion buttons alongside the full building selector and name-hidden recognition check. Sensor and command identities remain designed associations requiring listening feedback; unique audio files do not establish perceptual recognition.

## Field-test feedback rounds

Each sound now has mutually exclusive Approve / Close / Try again choices, a preferred treatment and a note. Submit any reviewed subset to save a round in `feedback.json`. Approved treatments lock their exact WAV and Ogg hashes; author.py refuses changes to those files. Other treatments remain comparison candidates. Close means nearly right and remains editable. Browser drafts are keyed to the audio-manifest revision; old drafts cannot approve changed audio. Round and revision checks reject stale submissions. Submitted rounds are retained as history. No approval is inferred from playback or a default choice. To change a locked approval later, obtain an explicit user request and preserve the old approval history.
