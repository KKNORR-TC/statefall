from pathlib import Path
import urllib.request, re, json, hashlib
root=Path(__file__).resolve().parent
manifest=json.loads((root/'sources.json').read_text())
for ident,name,author in [('fanfare','ToTheColor.ogg','U.S. Army Bands'),('taps','Taps.ogg','Sgt. Codie Lynn Williams, U.S. Marine Corps')]:
    page='https://commons.wikimedia.org/wiki/File:'+name
    def fetch(url):
        return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'StatefallAudioPrototype/1.0'}),timeout=40).read()
    html=fetch(page)
    urls=re.findall(r'https://upload.wikimedia.org/[^"<> ]+',html.decode())
    url=next(u.split('?')[0] for u in urls if u.split('?')[0].endswith('/'+name))
    data=fetch(url)
    (root/'sources'/f'{ident}.ogg').write_bytes(data)
    (root/'licenses'/f'{ident}.html').write_bytes(html)
    manifest=[r for r in manifest if r['id']!=ident]
    manifest.append(dict(id=ident,title=name,author=author,page=page,download=url,file=f'sources/{ident}.ogg',license='PD-US-Gov',license_url=page,retrieved='2026-09-29',note='Official military performance; public domain in the United States. Excerpted and EQ-treated for prototype.',sha256=hashlib.sha256(data).hexdigest()))
    print(ident,len(data),url)
(root/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
