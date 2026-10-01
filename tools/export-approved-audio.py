"""Export the locked listening review and Ken's reviewed score assignments.

Run with soundfile available. Original WAV masters and locked candidates are read-only.
"""
import hashlib
import json
import shutil
import re
from urllib.parse import urlparse, unquote
from pathlib import Path
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'prototypes/audio-audition'
OUT = ROOT / 'game/src/audio/assets'
OUT.mkdir(parents=True, exist_ok=True)
decisions = json.loads((REVIEW / 'feedback.json').read_text())['decisions']
manifest = json.loads((REVIEW / 'manifest.json').read_text())
effects = {}
for row in manifest:
    d = decisions[row['id']]
    assert d['locked'] and d['choice'] == 'approve', row['id']
    v = next(v for v in row['versions'] if v['kind'] == d['preferred'])
    source = REVIEW / v['compressed']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == d['files'][v['compressed']]
    dest = OUT / (row['id'] + '.ogg')
    shutil.copyfile(source, dest)
    effects[row['id']] = {'file': dest.name, 'seconds': v['seconds'], 'sha256': d['files'][v['compressed']]}
for layer in ['machineguns', 'tracks', 'artillery']:
    source = REVIEW / ('audio/layer-' + layer + '.ogg')
    shutil.copyfile(source, OUT / source.name)
    effects['layer-' + layer] = {'file': source.name, 'seconds': sf.info(str(source)).duration,
                               'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}

tracks = json.loads((REVIEW / 'score-assignments.json').read_text())['tracks']
hosted = json.loads((OUT.parent / 'hosted-library.json').read_text(encoding='utf-8-sig'))
hosted_tracks = hosted['menu'] + hosted['game'] + [t for group in hosted['stings'].values() for t in group]
def normalized(value):
    return re.sub('[^a-z0-9]', '', value.lower())
def original_title(track):
    return re.sub(r'^[a-f0-9]{8}-', '', Path(unquote(urlparse(track['url']).path)).stem)
inventory = {t['id']: t for t in json.loads((REVIEW / 'score-library.json').read_text())['tracks']}
for t in tracks:
    assert t['reviewed'] and t['roles']
    source = ROOT.parent / 'audio tracks' / t['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == t['sha256']
    dest = OUT / ('score-' + t['id'] + '.ogg')
    if not dest.exists():
        # Small blocks also avoid the Windows libsndfile stack limit on long tracks.
        with sf.SoundFile(str(source)) as src, sf.SoundFile(str(dest), 'w', samplerate=src.samplerate,
                channels=src.channels, format='OGG', subtype='VORBIS') as dst:
            for block in src.blocks(blocksize=4096):
                dst.write(block)
    t['seconds'] = inventory[t['id']]['seconds']
    t['asset'] = dest.name
    host = next(h for h in hosted_tracks if (normalized(h['title']) == normalized(t['title']) or
                normalized(original_title(h)) == normalized(t['title'])) and abs(h['seconds'] - t['seconds']) < 1)
    t['hosted'] = host

lines = ['// Exported from locked review decisions; rerun tools/export-approved-audio.py.', 'export const SOUND_ASSETS = {']
for key, v in effects.items():
    lines.append(f'  {json.dumps(key)}: {{url:new URL("./assets/{v["file"]}", import.meta.url).href, seconds:{v["seconds"]}}},')
lines.append('};\nexport const SCORE_TRACKS = [')
for t in tracks:
    data = {k: t[k] for k in ['id', 'title', 'roles', 'seconds']}
    hosted_url = urlparse(t['hosted']['url'])
    data['url'] = hosted_url.path + ('?' + hosted_url.query if hosted_url.query else '')
    lines.append('  ' + json.dumps(data) + ',')
lines.append('];\n')
(OUT.parent / 'catalog.mjs').write_text('\n'.join(lines), encoding='utf-8')
(OUT.parent / 'approval-manifest.json').write_text(json.dumps({'effects': effects, 'score': tracks}, indent=2) + '\n')
shutil.copyfile(REVIEW / 'SOURCES.md', OUT / 'CREDITS.txt')
print(f'Exported {len(effects)} effects and {len(tracks)} score tracks ({sum(p.stat().st_size for p in OUT.glob("*.ogg")) / 1e6:.1f} MB).')
