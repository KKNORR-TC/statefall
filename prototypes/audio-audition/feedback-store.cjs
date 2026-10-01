const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function state(root){const file=path.join(root,'feedback.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{round:0,decisions:{},rounds:[]};}
function catalog(root){const raw=fs.readFileSync(path.join(root,'manifest.json'));return {revision:hash(raw),rows:JSON.parse(raw)};}
function get(root){return {...state(root),revision:catalog(root).revision};}
function submit(root,input){
 const cat=catalog(root),current=state(root);
 if(!input||input.revision!==cat.revision||input.round!==current.round)throw new Error('The field test changed. Reload before submitting this round.');
 if(!Array.isArray(input.decisions)||!input.decisions.length||input.decisions.length>cat.rows.length)throw new Error('Choose feedback for at least one sound.');
 const next=structuredClone(current),seen=new Set(),accepted=[];
 for(const d of input.decisions){
  const row=cat.rows.find(r=>r.id===d.id);
  if(!row||seen.has(d.id)||!['approve','close','retry'].includes(d.choice)||!['natural','reinforced'].includes(d.preferred)||typeof d.note!=='string'||d.note.length>1000)throw new Error('Invalid sound feedback.');
  seen.add(d.id);if(current.decisions[d.id]?.locked)throw new Error('An approved sound is locked.');
  const version=row.versions.find(v=>v.kind===d.preferred),record={id:d.id,title:row.title,choice:d.choice,preferred:d.preferred,note:d.note.trim(),round:current.round+1,locked:d.choice==='approve',files:{}};
  record.soundRevision=row.reviewRevision||5;
  if(record.locked)for(const file of [version.file,version.compressed]){
   if(!/^audio\/[a-z0-9-]+\.(wav|ogg)$/.test(file))throw new Error('Invalid audio file.');
   record.files[file]=hash(fs.readFileSync(path.join(root,file)));
  }
  next.decisions[d.id]=record;accepted.push(record);
 }
 next.round++;next.rounds.push({round:next.round,at:new Date().toISOString(),revision:cat.revision,decisions:accepted});
 const file=path.join(root,'feedback.json'),temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(next,null,2)+'\n');fs.renameSync(temp,file);
 return {...next,revision:cat.revision};
}
module.exports={get,submit};
