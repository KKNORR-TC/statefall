'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createCanvas,loadImage}=require('canvas');
const {createCandidateSourceEvidence}=require('./source-evidence-manifest');

const root=path.resolve(__dirname,'..'),output=path.join(root,'.artifacts','phase-g-all-units-review'),assets=path.join(output,'assets');
const groups=[
  {key:'structures',title:'STRUCTURES · 20',names:['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','engcmd','troopcmd','radar','lradar','jammer','satellite'],prefix:'structure'},
  {key:'naval',title:'COMBAT & LOGISTICS HULLS · 11',names:['sub','hunter','rship','privateer','scout','warship','cruiser','battleship','transport','heavy-transport','merchant'],prefix:name=>['transport','heavy-transport','merchant'].includes(name)?'logistics':'ship'},
  {key:'air-support',title:'AIRCRAFT & SUPPORT · 6',names:['fighter','bomber','carrier','spy','truck','interceptor'],prefix:name=>['fighter','bomber','carrier'].includes(name)?'aircraft':'support'}
];
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const run=(command,args,env={})=>{ const result=spawnSync(command,args,{cwd:root,encoding:'utf8',stdio:'inherit',shell:process.platform==='win32',env:{...process.env,...env}}); if(result.status!==0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`); };

(async()=>{
  fs.mkdirSync(assets,{recursive:true}); for(const file of fs.readdirSync(assets)) if(file.endsWith('.png')) fs.unlinkSync(path.join(assets,file));
  for(const file of ['review-start-here.png','manifest.json']) try{ fs.unlinkSync(path.join(output,file)); }catch(error){ if(error.code!=='ENOENT') throw error; }
  run('npx',['playwright','test','tests/browser/phase-g-all-units.spec.js','--project=chromium-desktop','--workers=1'],{STATEFALL_PHASE_G_ALL_UNITS_REVIEW:'1'});
  const cell=190,imageSize=150,labelHeight=34,columns=5,gap=20,sections=[];
  for(const group of groups){ const loaded=[]; for(const name of group.names){ const prefix=typeof group.prefix==='function'?group.prefix(name):group.prefix,file=`${prefix}-${name}.png`,target=path.join(assets,file); if(!fs.existsSync(target)) throw new Error(`Missing ${file}`); loaded.push({name,file,image:await loadImage(target)}); } const rows=Math.ceil(loaded.length/columns),height=46+rows*(cell+labelHeight); sections.push({...group,loaded,rows,height}); }
  const width=columns*cell+(columns-1)*gap+40,height=sections.reduce((sum,value)=>sum+value.height,0)+54,sheet=createCanvas(width,height),context=sheet.getContext('2d'); context.fillStyle='#081116'; context.fillRect(0,0,width,height); context.textBaseline='middle'; context.fillStyle='#d8d0b5'; context.font='700 20px "Segoe UI",Arial,sans-serif'; context.fillText('UNIT DIRECTION 02 · COMPLETE STATIC IDENTITY CANDIDATE',20,23); context.fillStyle='#80949b'; context.font='12px "Segoe UI",Arial,sans-serif'; context.fillText('All rows pending · direct prototype translations and family extrapolations require separate human decisions',20,43);
  let y=54; for(const section of sections){ context.fillStyle='#c2a66e'; context.font='700 14px "Segoe UI",Arial,sans-serif'; context.fillText(section.title,20,y+20); y+=46; section.loaded.forEach(({name,image},index)=>{ const column=index%columns,row=Math.floor(index/columns),x=20+column*(cell+gap),top=y+row*(cell+labelHeight); context.drawImage(image,0,0,image.width,image.height,x,top,cell,cell); context.strokeStyle='rgba(194,166,110,.45)'; context.strokeRect(x+.5,top+.5,cell-1,cell-1); context.fillStyle='#d8d0b5'; context.font='600 12px "Segoe UI",Arial,sans-serif'; context.fillText(name.replaceAll('-',' ').toUpperCase(),x,top+cell+13); context.fillStyle='#80949b'; context.font='11px "Segoe UI",Arial,sans-serif'; context.fillText(['radar','fort','warship','sub','fighter','bomber','truck','interceptor'].includes(name)?'prototype-directed':'family extrapolation',x,top+cell+28); }); y+=section.rows*(cell+labelHeight); }
  const review=path.join(output,'review-start-here.png'); fs.writeFileSync(review,sheet.toBuffer('image/png')); const source=createCandidateSourceEvidence(root),assetFiles=groups.flatMap(group=>group.names.map(name=>`${typeof group.prefix==='function'?group.prefix(name):group.prefix}-${name}.png`)),files=['review-start-here.png',...assetFiles.map(file=>`assets/${file}`)].map(file=>{ const bytes=fs.readFileSync(path.join(output,file)); return {path:file,bytes:bytes.length,sha256:sha256(bytes)}; }); const manifest={schema:1,type:'phase-g-all-units-static-identity-review',status:'Pending human review',reviewer:'Unassigned',source,coverage:{structures:20,combatShips:8,logisticsHulls:3,aircraftIncludingSpy:4,supportAndInterceptor:2,totalCandidates:37,scope:'static identity and prototype visual language only'},notes:['No row is approved.','Rows without direct prototype exemplars are labeled family extrapolations.','Action, damage, destruction, transition, zoom, and dense-gameplay states remain separate review work.'],goldensUpdated:false,files}; fs.writeFileSync(path.join(output,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`); console.log(path.relative(root,review));
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
