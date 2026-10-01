"""Read-only inventory of Ken's masters; measurements are not mood judgements."""
from pathlib import Path
import sys,json,hashlib
root=Path(__file__).resolve().parent
sys.path.insert(0,str(root.parents[1]/'.artifacts/audio-python'))
import numpy as np
import soundfile as sf
library=root.parents[2]/'audio tracks'
rows=[]
suggestions={
 'Drift and Divide':['building'],'Siege Map Drift':['building'],'Iron Coast':['building'],
 'Iron Banner March':['battle','victory'],'Iron March':['battle'],'Iron Horizon':['battle'],
 'Salvo':['battle'],'Seventy-Two Percent':['battle'],'Siege Heartbeat':['battle'],'Siege Heartbeat (1)':['battle'],
 'Ashes of Victory':['victory'],'Fallen Banners':['defeat'],'Fallen Field':['defeat'],
 'Last Banner Falls':['defeat'],'Last Honor Call':['defeat'],'Statefall':['menu','victory']}
for p in sorted(library.glob('*.wav')):
 x,sr=sf.read(p,always_2d=True);duration=len(x)/sr
 # Twenty-second windows avoid classifying a silent intro as a quiet arrangement.
 energies=[float(np.sqrt(np.mean(x[int(t*sr):int((t+20)*sr)]**2))) for t in range(0,max(1,int(duration)-20),5)]
 times=list(range(0,max(1,int(duration)-20),5))
 rows.append(dict(id=hashlib.sha256(p.name.encode()).hexdigest()[:12],file=p.name,title=p.stem,seconds=round(duration,2),sampleRate=sr,channels=x.shape[1],bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),rmsDb=round(20*np.log10(max(1e-10,np.sqrt(np.mean(x*x)))),2),peakDb=round(20*np.log10(max(1e-10,np.max(abs(x)))),2),excerpts={'opening':0,'quietest':times[int(np.argmin(energies))],'strongest':times[int(np.argmax(energies))],'ending':max(0,round(duration-20,2))},suggested=suggestions.get(p.stem,[]),suggestionBasis='Provisional title-based suggestion; not an auditory mood assessment.'))
(root/'score-library.json').write_text(json.dumps({'note':'Original masters remain read-only outside the repository. Tags are drafts for listening review, not approved assignments.','tracks':rows},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'tracks':len(rows),'minutes':round(sum(t['seconds'] for t in rows)/60,1),'megabytes':round(sum(t['bytes'] for t in rows)/1e6,1)}))
