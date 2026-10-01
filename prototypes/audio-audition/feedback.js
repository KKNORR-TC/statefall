'use strict';
let feedbackState=null;
const feedbackDraftKey='statefall-sfx-feedback-'+window.AUDITION_REVISION;
let feedbackDraft={};try{feedbackDraft=JSON.parse(localStorage.getItem(feedbackDraftKey)||'{}')||{};}catch{}
const feedbackStatus=document.getElementById('feedbackStatus'),submitFeedback=document.getElementById('submitFeedback');
const feedbackForms=new Map();
function saveFeedbackDraft(){try{localStorage.setItem(feedbackDraftKey,JSON.stringify(feedbackDraft));}catch{feedbackStatus.textContent='Draft could not be saved in this browser. Submit this round to save it locally.';}}
function renderFeedback(){
 for(const row of window.AUDITION){
  const card=document.querySelector('[data-sound-id="'+row.id+'"]');card.querySelector('.feedback-form')?.remove();
  const saved=feedbackState.decisions[row.id],locked=!!saved?.locked,updated=saved&&!locked&&(saved.soundRevision||5)<(row.reviewRevision||5),value=locked?saved:feedbackDraft[row.id]||(!updated&&saved)||{preferred:saved?.preferred||'natural',choice:'',note:''};
  const box=document.createElement('fieldset');box.className='feedback-form';box.disabled=locked;
  const legend=document.createElement('legend');legend.textContent=locked?'Approved & locked · '+saved.preferred+' · round '+saved.round:updated?'Revised · ready for a fresh rating':'Your feedback';box.append(legend);
  if(updated){const previous=document.createElement('p');previous.textContent='Previous feedback: '+(saved.choice==='close'?'Close':'Try again')+(saved.note?' — '+saved.note:'');box.append(previous);}
  const treatment=document.createElement('label');treatment.textContent='Version: ';const select=document.createElement('select');select.setAttribute('aria-label',row.title+' feedback version');
  for(const name of ['natural','reinforced']){const o=document.createElement('option');o.value=name;o.textContent=name[0].toUpperCase()+name.slice(1);select.append(o);}select.value=value.preferred;treatment.append(select);box.append(treatment);
  const choices=document.createElement('div');choices.className='feedback-choices';
  for(const [choice,label] of [['approve','Approve'],['close','Close'],['retry','Try again']]){const l=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='verdict-'+row.id;input.value=choice;input.checked=value.choice===choice;l.append(input,document.createTextNode(' '+label));choices.append(l);}box.append(choices);
  const note=document.createElement('textarea');note.rows=2;note.maxLength=1000;note.placeholder='What should change?';note.setAttribute('aria-label',row.title+' feedback note');note.value=value.note;box.append(note);
  box.addEventListener('input',()=>{feedbackDraft[row.id]={id:row.id,preferred:select.value,choice:box.querySelector('input:checked')?.value||'',note:note.value};saveFeedbackDraft();});
  card.append(box);feedbackForms.set(row.id,box);
 }
 const approved=Object.values(feedbackState.decisions).filter(d=>d.locked).length;
 feedbackStatus.textContent='Round '+(feedbackState.round+1)+' · '+approved+' of '+window.AUDITION.length+' sounds approved and locked. Draft choices save as you go.';
 submitFeedback.disabled=false;
}
submitFeedback.onclick=async()=>{
 const decisions=[];for(const row of window.AUDITION){if(feedbackState.decisions[row.id]?.locked)continue;const d=feedbackDraft[row.id];if(d?.choice)decisions.push(d);}
 if(!decisions.length){feedbackStatus.textContent='Choose Approve, Close or Try again for at least one sound.';return;}
 submitFeedback.disabled=true;for(const box of feedbackForms.values())box.disabled=true;feedbackStatus.textContent='Saving feedback and locking approvals…';
 try{const response=await fetch('/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:window.AUDITION_REVISION,round:feedbackState.round,decisions})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Save failed');feedbackState=data;feedbackDraft={};saveFeedbackDraft();renderFeedback();feedbackStatus.textContent='Round '+data.round+' saved. Approved versions are locked; Close and Try again remain open for revision.';}
 catch(e){for(const [id,box] of feedbackForms)box.disabled=!!feedbackState.decisions[id]?.locked;feedbackStatus.textContent=e.message+' Your draft is still saved in this browser.';submitFeedback.disabled=false;}
};
fetch('/feedback').then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(data.revision!==window.AUDITION_REVISION)throw new Error('This field test is out of date. Reload to review the current sounds.');feedbackState=data;renderFeedback();}).catch(e=>{feedbackStatus.textContent='Feedback unavailable: '+e.message;});
