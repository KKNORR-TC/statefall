'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const layer=await import('../game/src/rendering/interaction-overlay-layer-model.mjs'),model=layer.createInteractionOverlayModel(),measureText=(_font,text)=>({width:text.length*8,left:text.length*4,right:text.length*4,ascent:14,descent:4}),input={viewport:{width:800,height:600},resolution:1.5,camera:{x:-20,y:10,scale:3},mapWidth:100,inheritedCanvasState:{globalAlpha:.8,globalCompositeOperation:'source-over',lineCap:'round',lineJoin:'bevel',lineDash:[4,3],lineDashOffset:1,font:'11px serif',textAlign:'left',textBaseline:'alphabetic',transform:[1.5,0,0,1.5,0,0]},pick:{cx:40,cy:50,text:'send 25 of 100'},box:{x0:90,y0:80,x1:20,y1:30},draft:{text:'Your pick'},paused:true,build:{tile:205,valid:false},measureText},before=JSON.stringify({...input,measureText:null}),scene=model.build(input);
  assert.equal(JSON.stringify({...input,measureText:null}),before,'model input is immutable');
  assert.deepEqual(scene.entries.map(value=>value.semantic),['pick-label','selection-box','draft-panel','draft-label','paused-scrim','paused-title','paused-subtitle','build-cursor']);
  assert.deepEqual(scene.counts,{entries:8,primitives:4,segments:41,labels:4,chars:44,visible:8,culled:0});
  assert.equal(scene.blendMode,'normal'); assert.deepEqual(scene.canvasState,{...scene.canvasState,font:'13px "Segoe UI",system-ui,sans-serif',textAlign:'center',lineWidth:2,strokeStyle:'#ff6b6b',fillStyle:'rgba(255,255,255,.7)'});
  assert.equal(scene.entries[1].primitive.dash.join(','),'4,3'); assert.equal(scene.entries.at(-1).primitive.stroke,'#ff6b6b');
  assert.equal(Object.isFrozen(scene),true); assert.equal(Object.isFrozen(scene.entries),true);
  for(const [name,value,error] of [['entries',7,'entry-cap'],['primitives',3,'primitive-cap'],['segments',40,'segment-cap'],['labels',3,'label-cap'],['chars',43,'char-cap'],['containers',7,'container-cap'],['graphics',3,'graphics-cap'],['sprites',3,'sprite-cap'],['textures',3,'texture-cap'],['sourceBytes',scene.resources.sourceBytes-1,'source-byte-cap']]) assert.throws(()=>model.build(input,{[name]:value}),new RegExp(error));
  assert.throws(()=>model.build({...input,inheritedCanvasState:{...input.inheritedCanvasState,globalCompositeOperation:'destination-out'}}),/composite-mode/);
  const calls=[],context=new Proxy({getLineDash:()=>[4,3],setLineDash:value=>calls.push(['dash',...value]),strokeText:(...value)=>calls.push(['strokeText',...value]),fillText:(...value)=>calls.push(['fillText',...value]),fillRect:(...value)=>calls.push(['fillRect',...value]),strokeRect:(...value)=>calls.push(['strokeRect',...value])},{set(target,key,value){ target[key]=value; return true; }}); const order=layer.paintInteractionOverlaysCanvas(context,input); assert.deepEqual(order,['pick-label','selection-box','draft-panel','draft-label','paused-scrim','paused-title','paused-subtitle','build-cursor']); assert.equal(calls.filter(value=>value[0]==='strokeRect').length,2);
  console.log('Interaction overlay layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
