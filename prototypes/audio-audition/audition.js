'use strict';
const $=id=>document.getElementById(id);
let ctx,master,filter,limiter,battleBus,generation=0,battleNodes=new Set(),nodes=new Set(),timers=new Set(),mode='quiet',musicURL;
const cache=new Map();
let musicGain,musicSource,milestone=null,milestoneGeneration=0;
function duckMusic(value,duration=.2){if(!musicGain)return;const g=musicGain.gain,t=ctx.currentTime;g.cancelAndHoldAtTime(t);g.linearRampToValueAtTime(value,t+duration);}
function cancelMilestone(){milestoneGeneration++;const old=milestone;milestone=null;if(old?.source){try{old.source.stop();}catch{}}duckMusic(1,.65);}
async function playMilestone(name,label){
  const elimination=name.startsWith('enemy-eliminated');
  if(milestone&&(!elimination||milestone.elimination))return;
  cancelMilestone();quiet(true);stopNodes(nodes);
  const ticket=milestoneGeneration;milestone={elimination,source:null};
  try{await init();await buffer(name);if(ticket!==milestoneGeneration)return;
    duckMusic(.2,.18);$('now').textContent='Playing: '+label+' · music lowered';
    const source=await play(name,{token:generation});
    if(ticket!==milestoneGeneration){if(source)source.stop();return;}
    if(!source){cancelMilestone();return;}milestone.source=source;
    source.addEventListener('ended',()=>{if(ticket!==milestoneGeneration)return;milestone=null;duckMusic(1,.9);$('now').textContent='Cue complete. Music returns to your level.';});
  }catch(e){if(ticket===milestoneGeneration)cancelMilestone();throw e;}
}
function init(){
  if(!ctx){ctx=new AudioContext();master=ctx.createGain();filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=$('smallSpeaker').checked?240:20;limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-9;limiter.knee.value=6;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;limiter.connect(filter);filter.connect(master);master.connect(ctx.destination);master.gain.value=+$('master').value/100;}
  if(!musicGain){musicGain=ctx.createGain();musicSource=ctx.createMediaElementSource($('music'));musicSource.connect(musicGain);musicGain.connect(ctx.destination);}
  return ctx.resume();
}
async function buffer(name){if(!cache.has(name)) cache.set(name,fetch('audio/'+name+'.wav').then(r=>{if(!r.ok)throw new Error('Audio file unavailable: '+name);return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).catch(e=>{cache.delete(name);throw e;}));return cache.get(name);}
function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);}
function stopNodes(set){for(const n of set){try{n.stop();}catch{}}set.clear();}
function quiet(immediate=false){generation++;for(const t of timers)clearTimeout(t);timers.clear();mode='quiet';if(battleBus&&ctx){const old=battleBus,oldNodes=new Set(battleNodes);battleNodes.clear();old.gain.cancelScheduledValues(ctx.currentTime);old.gain.setValueAtTime(old.gain.value,ctx.currentTime);old.gain.linearRampToValueAtTime(0,ctx.currentTime+(immediate?.025:.75));setTimeout(()=>{stopNodes(oldNodes);old.disconnect();},immediate?40:800);battleBus=null;}document.querySelectorAll('[data-perspective]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.perspective==='quiet')));$('battleStatus').textContent='Quiet. Fighting has stopped.';}
function stopAll(){cancelMilestone();quiet(true);stopNodes(nodes);$('music').pause();$('now').textContent='Stopped.';}
async function play(name,{gain=1,pan=0,rate=1,bus=null,battle=false,token=null}={}){
  await init();const b=await buffer(name);if(token!==null&&token!==generation)return;
  const s=ctx.createBufferSource(),g=ctx.createGain(),p=ctx.createStereoPanner();s.buffer=b;s.playbackRate.value=rate;g.gain.value=gain;p.pan.value=pan;s.connect(g);g.connect(p);p.connect(bus||limiter);nodes.add(s);if(battle)battleNodes.add(s);s.onended=()=>{nodes.delete(s);battleNodes.delete(s);s.disconnect();g.disconnect();p.disconnect();};s.start();return s;
}
function fail(e){$('now').textContent='Could not play audio: '+e.message;}
async function audition(name,label){if(/^(capture-neutral|capture-enemy|enemy-eliminated)-/.test(name))return playMilestone(name,label);cancelMilestone();quiet(true);stopNodes(nodes);const token=generation;$('now').textContent='Playing: '+label;await play(name,{token});}
const perspective={player:{gain:.7,lowpass:11000,description:'Your attack · foreground weapons, tracks and occasional artillery.'},incoming:{gain:.7,lowpass:10000,description:'Under attack · warning first, then foreground combat.'},bots:{gain:.22,lowpass:1800,description:'Visible bot battle · distant, quieter; no player order or outcome cues.'}};
async function startBattle(which){
  if(which==='quiet'){quiet(false);$('now').textContent='No fighting. The battlefield fades to quiet.';return;}
  cancelMilestone();quiet(true);stopNodes(nodes);
  const token=generation;await init();if(token!==generation)return;mode=which;const preset=perspective[which];
  battleBus=ctx.createGain();battleBus.gain.value=0;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=preset.lowpass;battleBus.connect(lp);lp.connect(limiter);battleBus.gain.linearRampToValueAtTime(preset.gain,ctx.currentTime+.35);const bus=battleBus;
  $('battleStatus').textContent=preset.description;$('now').textContent='Live battle audition — '+(which==='bots'?'bot-on-bot':which==='incoming'?'under attack':'your attack');document.querySelectorAll('[data-perspective]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.perspective===which)));
  if(which==='player')play('attack-start-natural',{gain:.7,token}).catch(fail);
  if(which==='incoming')play('incoming-warning-natural',{gain:.6,token}).catch(fail);
  const patterns={machineguns:[1700,2600,1900,3200,2100],tracks:[9300,10400],artillery:[6100,8300,7400]};
  for(const [layer,intervals] of Object.entries(patterns)){let count=0;const fire=async()=>{if(token!==generation)return;const g=+$(layer).value/100;try{await play('layer-'+layer,{gain:g*(layer==='tracks'?.65:1),pan:which==='bots'?.35:(count%2?.16:-.16),rate:layer==='machineguns'?[1,.94,1.07][count%3]:1,bus,battle:true,token});}catch(e){fail(e);}if(token!==generation)return;later(fire,intervals[count++%intervals.length]);};later(fire,layer==='artillery'?2800:layer==='tracks'?350:which==='incoming'?1400:200);}
}
let previous;
for(const [i,row] of [...window.AUDITION].sort((a,b)=>(b.reviewRevision||5)-(a.reviewRevision||5)).entries()){
 const group=(row.reviewRevision===7?'Revised · ':'Unchanged · ')+row.group;if(group!==previous){const h=document.createElement('h3');h.className='group-title';h.textContent=group;$('cards').append(h);const grid=document.createElement('div');grid.className='grid';$('cards').append(grid);previous=group;}
 const card=document.createElement('article');card.className='card';const title=document.createElement('h3');title.textContent=row.title;card.append(title);const versions=document.createElement('div');versions.className='versions';card.append(versions);
 for(const v of row.versions){const wrap=document.createElement('div');wrap.className='version';const button=document.createElement('button');button.textContent='▶ '+(v.kind==='natural'?'Natural':'Reinforced');button.setAttribute('aria-label',row.title+' — '+v.kind);button.onclick=()=>audition(row.id+'-'+v.kind,row.title+' / '+v.kind).catch(fail);wrap.append(button);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 270 40');svg.setAttribute('class','wave');svg.setAttribute('aria-hidden','true');const peak=Math.max(...v.waveform);for(let j=0;j<v.waveform.length;j++){const line=document.createElementNS(svg.namespaceURI,'line'),h=Math.max(1,v.waveform[j]/peak*18);line.setAttribute('x1',j*3);line.setAttribute('x2',j*3);line.setAttribute('y1',20-h);line.setAttribute('y2',20+h);line.setAttribute('stroke',v.kind==='natural'?'#a6b7a2':'#d6df8c');line.setAttribute('stroke-width','1.5');svg.append(line);}wrap.append(svg);const meta=document.createElement('div');meta.className='meta';const duration=document.createElement('span');duration.textContent=v.seconds.toFixed(1)+' sec';const link=document.createElement('a');link.href=v.file;link.download='';link.textContent='WAV';meta.append(duration,link);wrap.append(meta);const desc=document.createElement('p');desc.textContent=v.description;wrap.append(desc);versions.append(wrap);}
 card.dataset.soundId=row.id;$('cards').lastElementChild.append(card);
}
document.querySelectorAll('[data-perspective]').forEach(b=>b.onclick=()=>startBattle(b.dataset.perspective).catch(fail));
document.querySelectorAll('[data-outcome]').forEach(b=>b.onclick=()=>audition(b.dataset.outcome+'-natural','Your attack: '+b.textContent).catch(fail));
document.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>audition(b.dataset.file,b.textContent).catch(fail));
$('stop').onclick=stopAll;$('master').oninput=()=>{$('masterValue').textContent=$('master').value+'%';if(master)master.gain.setTargetAtTime(+$('master').value/100,ctx.currentTime,.03);};$('smallSpeaker').onchange=()=>{if(filter)filter.frequency.setTargetAtTime($('smallSpeaker').checked?240:20,ctx.currentTime,.03);};
$('musicFile').onchange=()=>{if(musicURL)URL.revokeObjectURL(musicURL);const f=$('musicFile').files[0];if(f){musicURL=URL.createObjectURL(f);$('music').src=musicURL;$('music').volume=.3;}};
$('music').addEventListener('play',()=>init().catch(fail));
const buildings=window.AUDITION.filter(r=>r.buildingType);let mystery=null;
for(const row of buildings){const option=document.createElement('option');option.value=row.id;option.textContent=row.title.replace(': complete','');$('buildingType').append(option);}
$('buildingComplete').onclick=()=>{const row=buildings.find(r=>r.id===$('buildingType').value);audition(row.id+'-natural',row.title).catch(fail);};
$('buildingStart').onclick=()=>audition('construction-start-natural','Construction hammering').catch(fail);
$('buildingMystery').onclick=()=>{const choices=buildings.filter(r=>r!==mystery);mystery=choices[Math.floor(Math.random()*choices.length)];$('buildingAnswer').textContent='Which building came online?';$('buildingReveal').disabled=false;audition(mystery.id+'-natural','Unlabelled building completion').catch(fail);};
$('buildingReveal').onclick=()=>{if(mystery)$('buildingAnswer').textContent=mystery.title;};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();});document.addEventListener('keydown',e=>{if(e.key==='Escape')stopAll();});
