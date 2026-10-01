from pathlib import Path
import urllib.request,re,json,hashlib,html
r=Path(__file__).resolve().parent
entries=[('cheer','Stevedrums',393402),('jet','Rudmer_Rotteveel',343746),('worksite','khenshom',650696),('chatter','unfa',245660),('rack','DDT197',445784),('ping','SamsterBirdies',539957)]
entries += [('sweepmotor','Burningmonkey',322021),('hum','FOSSarts',740458)]
entries += [('drill','AlaskaRobotics',551504),('stadium','FoolBoyMedia',397434),('marching','josecruz98',393044),('liftservo','peridactyloptrix',188821)]
entries += [('pilotvoice','pushkin',142923)]
manifest=json.loads((r/'sources.json').read_text())
def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read()
for ident,author,num in entries:
    if any(m['id']==ident for m in manifest):continue
    page=f'https://freesound.org/people/{author}/sounds/{num}/'
    data=fetch(page);s=html.unescape(data.decode())
    assert 'creativecommons.org/publicdomain/zero/' in s, ident
    urls=re.findall(r'https[^\s"<>]+\.mp3',s)
    url=next(u for u in urls if '-hq.mp3' in u)
    audio=fetch(url);file=f'sources/{ident}.mp3'
    (r/file).write_bytes(audio);(r/'licenses'/f'{ident}.html').write_bytes(data)
    title=re.search(r'<title>(.*?)</title>',s,re.S).group(1).strip()
    manifest.append(dict(id=ident,title=title,author=author,page=page,download=url,file=file,license='CC0-1.0',license_url='https://creativecommons.org/publicdomain/zero/1.0/',retrieved='2026-09-29',note='Public HQ MP3 preview used for local audition. Ping is source-authored synthesis; chatter is the author’s processed voice; rack is recorded BB shotgun mechanism.',sha256=hashlib.sha256(audio).hexdigest()))
    (r/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(ident,len(audio),url,flush=True)
