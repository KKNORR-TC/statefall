'use strict';
const byId=id=>document.getElementById(id),player=byId('scorePlayer');
const roles={menu:'Menu',building:'Building',battle:'Battle',victory:'Victory / credits',defeat:'Defeat / credits'};
let tracks=[],assignments={},state='building',radio=false,current=null,excerptEnd=null,request=0;
const key='statefall-score-review-v1';
function save(){try{localStorage.setItem(key,JSON.stringify(assignments));}catch{byId('scoreStatus').textContent='Browser storage unavailable. Export your assignments to keep them.';}count();}
function count(){byId('reviewCount').textContent=tracks.filter(t=>assignments[t.id]?.reviewed).length+' / '+tracks.length+' reviewed';}
function queue(){return radio?tracks:tracks.filter(t=>assignments[t.id].roles.includes(state));}
function stopScore(){request++;player.pause();excerptEnd=null;byId('scoreStatus').textContent='Stopped. Your track assignments are saved locally.';}
async function playTrack(track,offset=0,excerpt=false){
 const ticket=++request;player.pause();current=track;excerptEnd=excerpt?Math.min(offset+20,track.seconds):null;
 player.src='/score/'+track.id;player.currentTime=offset;
 byId('nowScore').textContent=track.title+(excerpt?' · 20-second excerpt':'');
 byId('scoreStatus').textContent=(radio?'Radio override':roles[state])+' · '+track.title;
 try{await player.play();if(ticket!==request)return;}catch(e){if(ticket===request&&e.name!=='AbortError')byId('scoreStatus').textContent='Playback unavailable: '+e.message;}
}
function nextTrack(){const q=queue();if(!q.length){stopScore();byId('scoreStatus').textContent='No tracks assigned to '+roles[state]+'. Choose tags below.';return;}const index=q.findIndex(t=>t.id===current?.id);playTrack(q[(index+1)%q.length]);}
function chooseState(value){state=value;document.querySelectorAll('[data-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===value)));if(radio){byId('scoreStatus').textContent='Radio override · situation changed to '+roles[state]+'; your track continues.';return;}const q=queue();if(current&&q.includes(current)&&!player.paused&&excerptEnd===null)return;nextTrack();}
function setRadio(value){radio=value;byId('radio').setAttribute('aria-pressed',String(value));byId('adaptive').setAttribute('aria-pressed',String(!value));if(!value&&!player.paused)chooseState(state);else byId('scoreStatus').textContent=value?'Radio override · choose any track; situation changes will not interrupt it.':'By situation · choose a situation to play.';}
function render(){
 const host=byId('trackCards');host.replaceChildren();
 for(const track of tracks){const a=document.createElement('article'),title=document.createElement('h3');title.textContent=track.title;a.append(title);
  const meta=document.createElement('p');meta.className='meta';const seconds=Math.round(track.seconds);meta.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' · '+track.sampleRate/1000+' kHz · '+(assignments[track.id].reviewed?'Reviewed':'Draft from title');a.append(meta);
  const excerpts=document.createElement('div');excerpts.className='toolbar excerpt';
  for(const [label,offset] of Object.entries(track.excerpts)){const b=document.createElement('button');b.textContent=label[0].toUpperCase()+label.slice(1);b.setAttribute('aria-label',track.title+' — '+label);b.onclick=()=>playTrack(track,offset,true);excerpts.append(b);}
  const full=document.createElement('button');full.textContent='Full track';full.onclick=()=>playTrack(track);excerpts.append(full);a.append(excerpts);
  const tags=document.createElement('div');tags.className='tags';
  for(const [role,label] of Object.entries(roles)){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.checked=assignments[track.id].roles.includes(role);c.onchange=()=>{const s=new Set(assignments[track.id].roles);c.checked?s.add(role):s.delete(role);assignments[track.id].roles=[...s];save();};l.append(c,document.createTextNode(' '+label));tags.append(l);}a.append(tags);
  const reviewed=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=assignments[track.id].reviewed;check.onchange=()=>{assignments[track.id].reviewed=check.checked;save();meta.textContent=meta.textContent.replace(/Draft from title|Reviewed/,check.checked?'Reviewed':'Draft from title');};reviewed.className='meta';reviewed.style.display='block';reviewed.style.marginTop='14px';reviewed.append(check,document.createTextNode(' I have reviewed these assignments'));a.append(reviewed);host.append(a);
 }count();
}
player.volume=.3;
player.addEventListener('timeupdate',()=>{if(excerptEnd!==null&&player.currentTime>=excerptEnd){player.pause();byId('scoreStatus').textContent='Excerpt complete · '+current.title;}});
player.addEventListener('ended',()=>{if(excerptEnd!==null){excerptEnd=null;return;}nextTrack();});
byId('radio').onclick=()=>setRadio(true);byId('adaptive').onclick=()=>setRadio(false);byId('next').onclick=nextTrack;byId('stopScore').onclick=stopScore;
document.querySelectorAll('[data-state]').forEach(b=>b.onclick=()=>chooseState(b.dataset.state));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScore();});document.addEventListener('keydown',e=>{if(e.key==='Escape')stopScore();});
byId('exportTags').onclick=()=>{const data={version:1,note:'Drafts remain unapproved until reviewed is true.',tracks:tracks.map(t=>({id:t.id,file:t.file,title:t.title,sha256:t.sha256,...assignments[t.id]}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='statefall-score-assignments.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
fetch('score-library.json').then(r=>{if(!r.ok)throw new Error('Catalogue unavailable');return r.json();}).then(data=>{tracks=data.tracks;let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}for(const t of tracks){const old=saved[t.id];assignments[t.id]={roles:Array.isArray(old?.roles)?old.roles.filter(r=>roles[r]):t.suggested,reviewed:old?.reviewed===true};}render();}).catch(e=>{byId('scoreStatus').textContent=e.message;});
