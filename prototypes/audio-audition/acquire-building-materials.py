from pathlib import Path
import urllib.request,re,json,hashlib,html
r=Path(__file__).resolve().parent
entries=[('ratchet','large-ratchet-s0795'),('chain','heavy-chain-s0359'),('contactor','industrial-switch-1-s3061'),('shutter','manual-roller-shutter-closing-in-2-s2473'),('camera','triggering-camera-s0307'),('steam','pressure-cooker-s0805'),('interference','radio-interference-3-s2512'),('radio','crackling-radio-1-s0312')]
manifest=json.loads((r/'sources.json').read_text())
def fetch(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'StatefallAudioPrototype/1.0'}),timeout=45).read()
for ident,slug in entries:
 page='https://bigsoundbank.com/'+slug+'.html';data=fetch(page);text=html.unescape(data.decode())
 assert 'CC0' in text
 plain=re.sub('<[^>]+>',' ',text);plain=re.sub(r'\s+',' ',plain)
 author=re.search(r'Author\s*:\s*(.*?)\s+Sound number',plain)
 if not author:raise RuntimeError('Missing author: '+ident)
 candidates=re.findall(r'(?:https?:)?//[^"<>\s]+\.(?:wav|mp3)',text)
 url=next((u for u in candidates if u.endswith('.wav')),candidates[0] if candidates else '')
 if url.startswith('//'):url='https:'+url
 if not url:raise RuntimeError('No audio link: '+ident)
 audio=fetch(url);file='sources/'+ident+('.wav' if url.endswith('.wav') else '.mp3')
 (r/file).write_bytes(audio);(r/'licenses'/f'{ident}.html').write_bytes(data)
 manifest=[m for m in manifest if m['id']!=ident]
 manifest.append(dict(id=ident,title=slug.rsplit('-s',1)[0],author=author.group(1),page=page,download=url,file=file,license='CC0-1.0',license_url='https://creativecommons.org/publicdomain/zero/1.0/',retrieved='2026-09-29',note='Recorded material/equipment source; contactor is an authored switch/iron-bar/reverb composite. Trimmed and mixed in revision 5.',sha256=hashlib.sha256(audio).hexdigest()))
 (r/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(ident,author.group(1),file,len(audio))
