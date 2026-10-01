from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent
(r/'revision-4-before.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (r/'audio').glob('*')}))
p=r/'index.html';s=p.read_text(encoding='utf-8').replace('SOUND DIRECTION 03','SOUND DIRECTION 04')
s=s.replace('data-outcome="attack-success">Neutral','data-outcome="capture-neutral">Neutral').replace('data-outcome="attack-success">Enemy','data-outcome="capture-enemy">Enemy')
s=s.replace('One fanfare for a completed territory, never for individual tiles.','Two distinct short bugle cues: a restrained salute for neutral territory, a brisk flourish for enemy territory. Completed territories only, never individual tiles.')
s=s.replace('<section class="section"><h2>Compare the treatments</h2>', '''<section class="section panel"><h2>Know what just finished</h2><p>Short hammering starts construction. Each of the 20 building types has its own completion signature, drawn from work, engines, gates and equipment.</p><div class="toolbar"><button id="buildingStart">Start construction · hammering</button><label for="buildingType">Building</label><select id="buildingType"></select><button id="buildingComplete">Play completion</button></div><div class="toolbar"><button id="buildingMystery">Play without the name</button><button id="buildingReveal" disabled>Reveal building</button><span id="buildingAnswer" aria-live="polite">Test whether the sound identifies the building.</span></div><p class="subtle">These are designed signatures for review, not recordings of every real installation. Similar sensor and command buildings may need further refinement after listening. Instant buildings should play only their building-specific completion cue.</p></section>
<section class="section"><h2>Compare the treatments</h2>''')
s=s.replace('frequent, short placement feedback and a different completion cue.','short hammering at the start and a separate signature for every building type.')
p.write_text(s,encoding='utf-8')
p=r/'README.md';s=p.read_text(encoding='utf-8').replace('16 effect families','36 effect families').replace('32 individual effects','72 individual effects')
s+='''
## Revision 4 — capture distinctions and building identities

Supersedes the shared capture fanfare in revision 3. Neutral capture is a 2.05-second held bugle salute; enemy capture is a 3.70-second closing flourish (reinforced versions add 0.577 seconds of reflection). Taps remains unchanged. Both captures still duck the score and require completed territory events, never tile events.

Construction starts with a 1.4-second recorded hammering excerpt. All 20 current STRUCT types have separate completion entries, exposed through the building selector and a name-hidden recognition check. Signatures use recorded engines, horns, gates, footsteps, hammering and designed machinery/air textures. They are candidates for perceptual review, not a claim that all 20 are already identifiable by ear. Related sensor/command types are the highest confusion risk. Instant construction plays only the building-specific completion, without stacking a start cue.

The manifest is authoritative for current previews; old revision audio files may remain for comparison, but are not referenced by the page. No game integration or production change is included.
''';p.write_text(s,encoding='utf-8')
p=r/'opportunity-map.md';s=p.read_text(encoding='utf-8');s='''# Revision 4: capture and construction refinements

Neutral and enemy territory captures have separate brief recorded bugle signatures, with the same completed-territory and score-ducking rules. Neutral is restrained; enemy is more emphatic. Elimination still uses Taps.

Construction start: short recorded hammering, never a chime. Completion: choose by actual structure type; all 20 current types are represented in the audition manifest. Instant builds emit only their specific completion. Suppress hidden and unrelated bot construction, and avoid overlapping a large burst of completions. Preserve identity when queueing/coalescing: do not replace different buildings with one generic completion sound. Name-hidden listening checks should guide revisions, especially command/sensor families.

These rules supersede the earlier shared capture cue and generic completion descriptions below.

'''+s;p.write_text(s,encoding='utf-8')
p=r/'SOURCES.md';s=p.read_text(encoding='utf-8');s+='''
## Revision 4: construction recordings

- [Hammering.wav — Dvideoguy](https://freesound.org/people/Dvideoguy/sounds/207782/), CC0: 0.25–1.65 s excerpt, EQ and fades for starts and engineering command.
- [diesel engine start.wav — ElGeorgia](https://freesound.org/people/ElGeorgia/sounds/241756/), CC0: 0–2.15 s excerpt, EQ, fades and layering for factory, engineering command and shield generator.
- [Ocean Liner Horn #1 — BigSoundBank / Joseph Sardin](https://bigsoundbank.com/horn-of-a-ship-1-s0261.html), CC0: short horn excerpt for the port. Original downloaded WAV retained.

Other completion cues reuse the credited Kenney impacts/footsteps, Department64 tank-inspired foley (CC BY 4.0), qubodup naval water and rocket recordings. Descriptions indicate designed associations: airfield air-flow is edited rocket texture, sensor drives are mechanical foley, and shield startup is filtered engine audio. No new procedural tones or generated noise are used. Full per-cue source IDs are in the manifest, with source hashes and archived license pages retained.

Capture edits now use 37.00–39.05 s of To the Color for neutral territory and 35.35–39.05 s for enemy territory. Both retain the performed pitch/timing; their original shared revision-3 excerpt is superseded.
''';p.write_text(s,encoding='utf-8')
