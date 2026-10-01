"""Restore exact public downloads in sources.json; no authenticated originals."""
import hashlib,json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent
for item in json.loads((root/'sources.json').read_text(encoding='utf-8')):
    target=root/item['file']
    if target.exists(): data=target.read_bytes()
    else:
        req=urllib.request.Request(item['download'],headers={'User-Agent':'Statefall-Audio-Study/1.0'})
        data=urllib.request.urlopen(req,timeout=60).read()
    if hashlib.sha256(data).hexdigest()!=item['sha256']:
        raise RuntimeError('Source changed; review before using: '+item['id'])
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists():target.write_bytes(data)
    print(item['id'],'verified')
