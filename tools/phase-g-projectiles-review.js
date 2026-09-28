'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createCanvas,loadImage}=require('canvas');
const {createCandidateSourceEvidence}=require('./source-evidence-manifest');

const root=path.resolve(__dirname,'..'),output=path.join(root,'.artifacts','phase-g-projectiles-review'),assets=path.join(output,'assets');
const rows=[
  ['strategic-missile','STRATEGIC MISSILE','family extrapolation'],['cruise-missile','CRUISE MISSILE','family extrapolation'],['naval-barrage','NAVAL BARRAGE ROCKET','family extrapolation'],
  ['heavy-artillery','HEAVY ARTILLERY SHELL','family extrapolation'],['surface-gun-shell','SURFACE GUN SHELL','family extrapolation'],['torpedo','TORPEDO','family extrapolation'],
  ['defensive-interceptor','DEFENSIVE INTERCEPTOR','prototype-directed'],['air-to-air-missile','AIR-TO-AIR MISSILE','family extrapolation'],['aircraft-bomb','AIRCRAFT BOMB','family extrapolation']
];
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const run=(command,args,env={})=>{ const result=spawnSync(command,args,{cwd:root,encoding:'utf8',stdio:'inherit',shell:process.platform==='win32',env:{...process.env,...env}}); if(result.status!==0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`); };

(async()=>{
  fs.mkdirSync(assets,{recursive:true}); for(const file of fs.readdirSync(assets)) if(file.endsWith('.png')) fs.unlinkSync(path.join(assets,file));
  for(const file of ['review-start-here.png','manifest.json']) try{ fs.unlinkSync(path.join(output,file)); }catch(error){ if(error.code!=='ENOENT') throw error; }
  run('npx',['playwright','test','tests/browser/phase-g-projectiles.spec.js','--project=chromium-desktop','--workers=1'],{STATEFALL_PHASE_G_PROJECTILES_REVIEW:'1'});
  const cell=260,labelHeight=42,columns=3,gap=20,width=columns*cell+(columns-1)*gap+40,loaded=[]; for(const [name,label,direction] of rows){ const target=path.join(assets,`${name}.png`); if(!fs.existsSync(target)) throw new Error(`Missing ${name}.png`); loaded.push({name,label,direction,image:await loadImage(target)}); }
  const rowCount=Math.ceil(loaded.length/columns),height=76+rowCount*(cell+labelHeight)+20,sheet=createCanvas(width,height),context=sheet.getContext('2d'); context.fillStyle='#081116'; context.fillRect(0,0,width,height); context.textBaseline='middle'; context.fillStyle='#d8d0b5'; context.font='700 20px "Segoe UI",Arial,sans-serif'; context.fillText('UNIT DIRECTION 02 · PROJECTILE FLIGHT IDENTITY CANDIDATE',20,23); context.fillStyle='#80949b'; context.font='12px "Segoe UI",Arial,sans-serif'; context.fillText('All rows pending · isolated production vectors shown at 2x inspection scale',20,45); context.fillStyle='#c2a66e'; context.font='700 14px "Segoe UI",Arial,sans-serif'; context.fillText('PROJECTILES & DEFENSIVE COUNTER-FIRE · 9',20,67);
  loaded.forEach(({label,direction,image},index)=>{ const column=index%columns,row=Math.floor(index/columns),x=20+column*(cell+gap),y=76+row*(cell+labelHeight); context.drawImage(image,0,0,image.width,image.height,x,y,cell,cell); context.strokeStyle='rgba(194,166,110,.45)'; context.strokeRect(x+.5,y+.5,cell-1,cell-1); context.fillStyle='#d8d0b5'; context.font='600 12px "Segoe UI",Arial,sans-serif'; context.fillText(label,x,y+cell+14); context.fillStyle='#80949b'; context.font='11px "Segoe UI",Arial,sans-serif'; context.fillText(direction,x,y+cell+30); });
  const review=path.join(output,'review-start-here.png'); fs.writeFileSync(review,sheet.toBuffer('image/png')); const source=createCandidateSourceEvidence(root),assetFiles=rows.map(([name])=>`assets/${name}.png`),files=['review-start-here.png',...assetFiles].map(file=>{ const bytes=fs.readFileSync(path.join(output,file)); return {path:file,bytes:bytes.length,sha256:sha256(bytes)}; }); const manifest={schema:1,type:'phase-g-projectile-flight-identity-review',status:'Pending human review',reviewer:'Unassigned',source,coverage:{projectileRows:9,totalCandidates:9,inspectionScale:'2x',scope:'isolated representative in-flight identity only'},notes:['No row is approved.','The defensive interceptor uses the shipped support-actor path; the aircraft bomb uses the shipped global-effects path.','Surface gun origins share one shipped ordinary-shell render category.','Launch, impact, interception, dense combat, zoom, quality, and reduced-motion states remain separate review work.'],goldensUpdated:false,files}; fs.writeFileSync(path.join(output,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`); console.log(path.relative(root,review));
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
