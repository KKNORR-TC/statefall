'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const layer=await import('../game/src/rendering/nation-overlay-layer-model.mjs');
  const measureText=(font,text)=>({width:String(text).length*8,ascent:10,descent:3});
  const inherited={globalAlpha:.7,lineJoin:'bevel',lineCap:'square',lineDash:[2,3],lineDashOffset:4,lineWidth:7,strokeStyle:'#123456',fillStyle:'#654321',font:'9px serif',textAlign:'right',textBaseline:'middle'};
  const base={camera:{x:0,y:0,scale:1.5},viewport:{width:1200,height:800},now:Math.PI*90,tick:100,draftActive:false,measureText,inheritedCanvasState:inherited};
  const flag={layers:[['ring','#abcdef',.5,.5,.2,.1]]};
  const player=(id,overrides={})=>({id,name:`P${id}`,color:'#336699',flag,x:100+id*30,y:180,tiles:900,alive:true,kind:'nation',mine:false,relation:'none',relationTeam:false,teamColor:null,handshakeUntil:0,heartbreakUntil:0,troopsText:'1.2k',...overrides});
  const team=player(1,{name:'Team',teamColor:'#ff0000'}),ordinary=player(2,{name:'Ally',relation:'ally',handshakeUntil:200,heartbreakUntil:180}),neutral=player(3,{name:'Neutral',kind:'neutral',troopsText:''}),input={...base,players:[team,ordinary,neutral]},before=JSON.stringify(input),model=layer.createNationOverlayModel(),scene=model.build(input);

  assert.equal(JSON.stringify(input),before,'model is immutable');
  assert.deepEqual(scene.entries.map(value=>[value.key,value.order,value.player.name]),[['player:1',0,'Team'],['player:2',1,'Ally'],['player:3',2,'Neutral']]);
  assert.deepEqual(scene.counts,{players:3,eligible:3,visible:3,culled:0,labels:6,chars:27,primitives:31,segments:40});
  assert.deepEqual({strokeStyle:scene.entries[0].rasterState.strokeStyle,lineWidth:scene.entries[0].rasterState.lineWidth},{strokeStyle:'rgba(0,0,0,.6)',lineWidth:3});
  assert.deepEqual({strokeStyle:scene.entries[1].rasterState.strokeStyle,lineWidth:scene.entries[1].rasterState.lineWidth},{strokeStyle:'#ff0000',lineWidth:2},'team outline becomes the next player state');
  assert.deepEqual({strokeStyle:scene.entries[2].rasterState.strokeStyle,lineWidth:scene.entries[2].rasterState.lineWidth},{strokeStyle:'rgba(0,0,0,.5)',lineWidth:1},'drawFlag leakage reaches a following neutral');
  assert.deepEqual(scene.canvasState,{globalAlpha:1,lineJoin:'bevel',lineCap:'square',lineDash:[2,3],lineDashOffset:4,lineWidth:1,strokeStyle:'rgba(0,0,0,.5)',fillStyle:'#fff',font:'bold 12px "Segoe UI",system-ui,sans-serif',textAlign:'center',textBaseline:'middle'});

  const neutralState=players=>model.build({...base,players}).entries.at(-1).rasterState;
  assert.deepEqual([neutralState([team,neutral]).strokeStyle,neutralState([team,neutral]).lineWidth],['#ff0000',2]);
  assert.deepEqual([neutralState([ordinary,neutral]).strokeStyle,neutralState([ordinary,neutral]).lineWidth],['rgba(0,0,0,.5)',1]);
  assert.deepEqual([neutralState([player(9,{alive:false,teamColor:'#00ff00'}),neutral]).strokeStyle,neutralState([player(9,{alive:false,teamColor:'#00ff00'}),neutral]).lineWidth],['rgba(0,0,0,.6)',3],'ineligible predecessor has no state transition');
  assert.deepEqual([neutralState([player(9,{tiles:199,teamColor:'#00ff00'}),neutral]).strokeStyle,neutralState([player(9,{tiles:199,teamColor:'#00ff00'}),neutral]).lineWidth],['rgba(0,0,0,.6)',3]);
  assert.deepEqual([neutralState([neutral]).strokeStyle,neutralState([neutral]).lineWidth],['rgba(0,0,0,.6)',3],'predecessor removal restores block-entry state');

  const relationVariants=[player(10,{relation:'ally'}),player(11,{relation:'pact'}),player(12,{relation:'ally',mine:true}),player(13,{relation:'pact',relationTeam:true,teamColor:'#0f0'})],relations=model.build({...base,players:relationVariants});
  assert.deepEqual(relations.entries.map(value=>value.relationText),['ALLY','PACT',null,null]);
  assert.deepEqual(relations.counts.labels,10,'only exact painted relations count as labels');
  assert.deepEqual(relations.counts.chars,relationVariants.reduce((sum,value)=>sum+value.name.length+value.troopsText.length,0)+8,'phantom self/team relation characters are absent');
  const phantom=model.build({...base,players:[relationVariants[3]]}).entries[0],plain=model.build({...base,players:[{...relationVariants[3],relation:'none'}]}).entries[0]; assert.deepEqual(phantom.bounds,plain.bounds,'phantom team relation does not enlarge bounds');

  const iconPlayer=player(20,{x:300,y:300,relation:'ally',handshakeUntil:200,heartbreakUntil:175,tiles:3600}),icons=model.build({...base,players:[iconPlayer]}).entries[0];
  for(const icon of [icons.handshake,icons.heart]){ const extent=icon.r*1.18+1; assert(icons.bounds.left<=icon.x-extent&&icons.bounds.right>=icon.x+extent&&icons.bounds.top<=icon.y-extent&&icons.bounds.bottom>=icon.y+extent,'full transformed outer-circle stroke and CSS AA margin are bounded'); }
  assert(Math.abs(icons.handshake.r-icons.br*1.35)<1e-9,'fresh handshake reaches the exact maximum pulse at the chosen time');

  assert.throws(()=>model.build({...input,players:[team,team]}),/duplicate nation overlay stable key/);
  for(const [countName,capName,error] of [['eligible','entries','entry-cap'],['labels','labels','label-cap'],['chars','chars','char-cap'],['primitives','primitives','primitive-cap'],['segments','segments','segment-cap']]) assert.throws(()=>model.build(input,{[capName]:scene.counts[countName]-1}),new RegExp(error));
  const culled=model.build({...input,camera:{x:10000,y:10000,scale:1.5}}); assert.equal(culled.counts.visible,0); assert.equal(culled.counts.culled,3);
  assert.equal(model.build({...input,camera:{x:0,y:0,scale:.9}}).entries.length,0); assert.equal(model.build({...input,draftActive:true}).entries.length,0);

  const operations=[],context={...inherited,_stack:[],setLineDash(value){ this.lineDash=value.slice(); },getLineDash(){ return this.lineDash.slice(); },measureText(text){ return {width:String(text).length*8,actualBoundingBoxAscent:10,actualBoundingBoxDescent:3}; },beginPath(){},arc(){ operations.push('arc'); },fill(){ operations.push('fill'); },stroke(){ operations.push('stroke'); },fillRect(){ operations.push('fillRect'); },strokeRect(){ operations.push(`strokeRect:${this.strokeStyle}:${this.lineWidth}`); },strokeText(text){ operations.push(`strokeText:${text}:${this.strokeStyle}:${this.lineWidth}`); },fillText(text){ operations.push(`fillText:${text}`); },moveTo(){},lineTo(){},bezierCurveTo(){},closePath(){},save(){ operations.push('save'); this._stack.push({globalAlpha:this.globalAlpha,lineJoin:this.lineJoin,lineCap:this.lineCap,lineDash:this.lineDash.slice(),lineDashOffset:this.lineDashOffset,lineWidth:this.lineWidth,strokeStyle:this.strokeStyle,fillStyle:this.fillStyle,font:this.font,textAlign:this.textAlign,textBaseline:this.textBaseline}); },restore(){ operations.push('restore'); Object.assign(this,this._stack.pop()); },translate(){},scale(){}};
  const drawFlag=c=>{ operations.push('flag'); c.strokeStyle='rgba(0,0,0,.5)'; c.lineWidth=1; c.strokeRect(0,0,1,1); };
  layer.paintNationOverlaysCanvas(context,input,{drawFlag});
  assert(operations.indexOf('flag')<operations.indexOf('arc'),'flag precedes diplomatic geometry');
  assert(operations.some(value=>value==='strokeText:Neutral:rgba(0,0,0,.5):1'),'neutral paint inherits the ordinary predecessor flag state');
  assert.deepEqual({strokeStyle:context.strokeStyle,lineWidth:context.lineWidth,font:context.font,globalAlpha:context.globalAlpha},{strokeStyle:'rgba(0,0,0,.5)',lineWidth:1,font:'bold 12px "Segoe UI",system-ui,sans-serif',globalAlpha:1},'opening marker receives exact final handoff');
  operations.length=0; const uncapped={...input,players:Array.from({length:layer.MAX_NATION_OVERLAY_ENTRIES+1},(_,index)=>player(index,{x:100}))},order=layer.paintNationOverlaysCanvas(context,uncapped,{drawFlag}); assert.equal(order.length,layer.MAX_NATION_OVERLAY_ENTRIES+1,'direct Canvas fallback is uncapped');
  console.log('Nation overlay layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
