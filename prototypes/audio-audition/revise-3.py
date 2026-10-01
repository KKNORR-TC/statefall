from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent
before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (r/'audio').glob('*')}
(r/'revision-3-before.json').write_text(json.dumps(before))
p=r/'index.html';s=p.read_text(encoding='utf-8')
s=s.replace('SOUND DIRECTION 01','SOUND DIRECTION 03')
s=s.replace('Machine-gun bursts<input','Machine guns · ambient<input').replace('id="machineguns" min="0" max="100" value="65"','id="machineguns" min="0" max="100" value="12"')
s=s.replace('<button data-outcome="attack-success">Succeeded</button>','')
s=s.replace('<p class="subtle">This is a listening mockup.', '<div class="toolbar"><span class="subtle">Completed milestones:</span><button data-outcome="attack-success">Neutral territory captured</button><button data-outcome="attack-success">Enemy territory captured</button><button data-outcome="enemy-eliminated">Enemy eliminated · Taps</button></div><p class="subtle">One fanfare for a completed territory, never for individual tiles. Taps takes priority when an enemy is eliminated. Both lower the music automatically, then restore it.</p>\n<p class="subtle">This is a listening mockup.')
s=s.replace('distinct stalled, successful and failed endings.','restrained stalled and failed endings; fanfare for completed territory captures and Taps for enemy elimination.')
p.write_text(s,encoding='utf-8')
p=r/'README.md';s=p.read_text(encoding='utf-8').replace('15 effect families','16 effect families').replace('30 individual effects','32 individual effects').replace('Other selected sources are CC0.','Other selected effects are CC0; the two official military bugle recordings are public domain in the United States (see source evidence).')
s+='''
## Revision 3 — completed milestones and ambient gunfire

The two capture buttons audition the same recorded fanfare for a **completed territory**, neutral or enemy-held. They do not represent tile ownership updates. Enemy elimination uses a 7.3-second opening phrase of Taps, not the full ceremony. Elimination interrupts a capture cue; repeated capture clicks during a cue are coalesced. Individual milestone previews lower the optional music bus to 20% over 180 ms, then restore it over 900 ms. They preserve the music element's volume, mute and paused state. Stop all restores the bus and pauses music. Context sequences are pre-rendered SFX demonstrations, without timed score ducking.

Machine guns now default to 12% (previously 65%); arranged combat reduces their mix contribution by 80%. Tracks and artillery retain their live defaults. The completed-territory trigger is an integration requirement, not a claim that the prototype is connected to game events.
'''
p.write_text(s,encoding='utf-8')
p=r/'opportunity-map.md';s=p.read_text(encoding='utf-8');s='''# Revision 3: authoritative audio direction

- Celebrate only **completed territory acquisition** by the player: neutral and enemy-held territories use the fanfare. Never trigger from a tile ownership update or progress tick.
- Enemy elimination means the enemy has been removed from the game. Play a short recorded Taps phrase once per elimination; it replaces any capture fanfare for the same result.
- Deduplicate completed capture events by territory and capture operation, and elimination by enemy and match. Do not rely on a time cooldown to define completion. If several completions happen together, coalesce fanfares and prioritize elimination.
- These milestones duck the currently playing hosted score and restore its current user volume smoothly afterward. Preserve mute, pause, track changes and user adjustments. The audition demonstrates this with a separate music gain bus; live-player integration remains pending.
- Machine guns are almost ambient: live default 12%, down from 65%; arranged battle contribution reduced 80%. Visible bot battles remain more distant. Inactive/hidden fighting stays silent.
- Stalled and failed remain subdued track friction/wind-down, with no arcade cadence. These directions supersede earlier success/ending suggestions below.

'''+s;p.write_text(s,encoding='utf-8')
p=r/'SOURCES.md';s=p.read_text(encoding='utf-8');s+='''
## Revision 3: recorded bugle performances

- **To the Color**, U.S. Army Bands — [source and public-domain statement](https://commons.wikimedia.org/wiki/File:ToTheColor.ogg). Official-duty U.S. Army work, public domain in the United States. The capture fanfare edits the closing 34.35–39.05 second phrase, with EQ and fades; the reinforced version adds restrained reflections.
- **Taps**, Sgt. Codie Lynn Williams, U.S. Marine Corps — [source and public-domain statement](https://commons.wikimedia.org/wiki/File:Taps.ogg). Official-duty U.S. Marine Corps work, public domain in the United States. Elimination uses the opening 0–7.3 second phrase with EQ and fades, retaining the performed pitch and timing.

The original Ogg recordings, exact download links, hashes and archived source pages are retained. These are performance excerpts, not procedural melodies or C&C assets. No endorsement is implied.
''';p.write_text(s,encoding='utf-8')
