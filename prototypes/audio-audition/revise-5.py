from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent
(r/'revision-5-before.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (r/'audio').glob('*')}))
p=r/'index.html';s=p.read_text(encoding='utf-8').replace('SOUND DIRECTION 04','SOUND DIRECTION 05')
s=s.replace('Short hammering starts construction. Each of the 20 building types has its own completion signature, drawn from work, engines, gates and equipment.','Short hammering starts construction. Only the factory uses an engine start. Other completions use chains, hand tools, shutters, pressure release, switches and radio equipment.')
s=s.replace('<div class="toolbar"><button id="buildingMystery">','<div class="toolbar"><span class="subtle">Compare contrasting sounds:</span><button data-file="construction-factory-natural">Factory · engine</button><button data-file="construction-fort-natural">Bastion · chain</button><button data-file="construction-engcmd-natural">Engineering · ratchet</button><button data-file="construction-airfield-natural">Airfield · shutter</button><button data-file="construction-shield-natural">Shield · contactor</button><button data-file="construction-satellite-natural">Satellite · cameras</button></div><div class="toolbar"><button id="buildingMystery">')
p.write_text(s,encoding='utf-8')
p=r/'README.md';s=p.read_text(encoding='utf-8');s+='''
## Revision 5 — fewer similar motors

All 16 original-score assignments are now reviewed (see `score-assignments.json`). Construction completion feedback rejected the shared motor character. Sixteen building completion families were rebuilt around eight additional CC0 recordings: chain, hand ratchet, industrial switch composite, manual shutter, camera shutter, steam release, RF interference and radio crackle. Factory alone retains the diesel start. No completion now uses the tank motor/servo or rocket air-flow layers. City, factory, port, troop command, construction starts, battle and capture cues stay unchanged.

The page provides six contrasting completion buttons alongside the full building selector and name-hidden recognition check. Sensor and command identities remain designed associations requiring listening feedback; unique audio files do not establish perceptual recognition.
''';p.write_text(s,encoding='utf-8')
p=r/'opportunity-map.md';s=p.read_text(encoding='utf-8');s='''# Revision 5: completion materials

Factory alone uses an engine start. Other completion cues must avoid motor spin-up: use material/equipment signatures such as hand ratchet, chain, shutter, pressure seal, contactor and radio receiver. The user found revision 4 too similar despite the nominal building labels. Use name-hidden listening comparisons to judge separation, especially command and sensor types. Existing capture, hammering-start and subdued machine-gun directions remain in effect.

'''+s;p.write_text(s,encoding='utf-8')
sources=json.loads((r/'sources.json').read_text())
p=r/'SOURCES.md';s=p.read_text(encoding='utf-8');s+='\n## Revision 5: material and equipment palette\n\n'
for row in sources:
 if row['id'] in ['ratchet','chain','contactor','shutter','camera','steam','interference','radio']:
  s+=f"- [{row['title']}]({row['page']}) — {row['author']}, CC0. Original WAV retained with download hash and archived license page.\n"
s+='\nIndustrial switch is a source-authored switch/iron-bar/reverb composite. Steam is a pressure-cooker recording repurposed as a brief pressure seal; camera shutters and radio recordings provide designed command/sensor identities. These are not claimed recordings of actual military installations. No oscillators, generated noise, speech or engine layers were added to these revised completions.\n';p.write_text(s,encoding='utf-8')
