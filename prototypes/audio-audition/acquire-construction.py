from pathlib import Path
import urllib.request,re,json,hashlib,html
r=Path(__file__).resolve().parent
entries=[('hammer','Dvideoguy','Hammering.wav','https://freesound.org/people/Dvideoguy/sounds/207782/'),('diesel','ElGeorgia','diesel engine start.wav','https://freesound.org/people/ElGeorgia/sounds/241756/'),('ship-horn','Joseph Sardin / BigSoundBank','Ocean Liner Horn #1','https://bigsoundbank.com/horn-of-a-ship-1-s0261.html')]
manifest=json.loads((r/'sources.json').read_text())
def fetch(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'StatefallAudioPrototype/1.0'}),timeout=40).read()
for ident,author,title,page in entries:
 data=fetch(page);text=html.unescape(data.decode())
 if ident=='ship-horn':
  candidates=re.findall(r'(?:https?:)?//[^"<>\s]+\.(?:wav|mp3)',text)
  if not candidates:
   candidates=['https://bigsoundbank.com'+p for p in re.findall(r'["\'](/[^"\']+\.mp3)',text)]
  url=next((u for u in candidates if '.wav' in u),candidates[0] if candidates else '')
  if url.startswith('//'):url='https:'+url
 else:
  urls=re.findall(r'https://[^"<>\s]+-hq\.mp3',text)
  url=next(u for u in urls if 'previews/' in u)
 if not url:raise RuntimeError('No public audio link for '+ident)
 audio=fetch(url);file='sources/'+ident+('.wav' if url.endswith('.wav') else '.mp3')
 (r/file).write_bytes(audio);(r/'licenses'/f'{ident}.html').write_bytes(data)
 manifest=[m for m in manifest if m['id']!=ident]
 manifest.append(dict(id=ident,title=title,author=author,page=page,download=url,file=file,license='CC0-1.0',license_url='https://creativecommons.org/publicdomain/zero/1.0/',retrieved='2026-09-29',note='Recorded source, trimmed and mixed for construction cues. Freesound inputs use public HQ MP3 previews.',sha256=hashlib.sha256(audio).hexdigest()))
 print(ident,file,len(audio))
(r/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
