'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const {createWarshipScene,warshipCanvasStrokeState}=await import('../game/src/rendering/warship-layer-model.mjs');
  const classes=['sub','hunter','rship','privateer','scout','warship','cruiser','battleship'];
  const ship=(cls,id,x=20)=>({id,cls,x,y:20,heading:.2,lean:.15,recoil:false,fireAngle:.4,hp:cls==='battleship'?11.2:2.2,hpMax:cls==='battleship'?12:cls==='cruiser'?6:cls==='warship'?5:cls==='privateer'?4:cls==='scout'?2:3,gun:['sub','hunter','rship','privateer'].includes(cls)?0:cls==='scout'?12:cls==='warship'?26:cls==='cruiser'?22:32,barrage:['cruiser','battleship'].includes(cls)?{range:cls==='cruiser'?30:36}:null,sub:cls==='sub'||cls==='hunter',speed:1.4,wake:[[x-3,20],[x-2,20],[x-1,20]],color:'#4da3ff',owned:true,selected:false,destination:null,visible:true,refitFraction:null,cruise:false,cooldownFraction:null});
  const warships=classes.map((cls,index)=>ship(cls,index+1,12+index*11)),input={camera:{x:0,y:0,scale:2},viewport:{width:220,height:100},inheritedStrokeState:{lineJoin:'miter',lineCap:'butt'},warships};
  const before=JSON.stringify(input),scene=createWarshipScene(input);
  assert.equal(JSON.stringify(input),before,'pure model must not mutate renderer or simulation input');
  assert.deepEqual(scene.entries.map(value=>value.cls),classes,'all classes retain source array order');
  assert.deepEqual(scene.entries.map(value=>value.id),classes.map((_,index)=>index+1),'stable simulation IDs identify every entry');
  for(const entry of scene.entries){
    const order=entry.items.map(value=>value.semantic); assert.equal(order[0],'gun-range');
    if(['cruiser','battleship'].includes(entry.cls)) assert.equal(order[1],'barrage-range');
    assert.ok(order.includes('hull-details-hp')); assert.ok(entry.items.find(value=>value.semantic==='hull-details-hp').primitives.some(value=>value.fill==='#fff'),'HP uses ceil pips after exact hull details');
  }
  assert.equal(scene.entries.find(value=>value.cls==='sub').items.some(value=>value.semantic==='wake'),false);
  { const primitives=scene.entries.find(value=>value.cls==='sub').items.find(value=>value.semantic==='hull-details-hp').primitives; assert.equal(primitives[0].alpha,.55*.7); assert.ok(primitives.slice(1).every(value=>value.alpha>0&&value.alpha<=.7),'submarine depth stack and HP retain scoped translucency'); }
  assert.ok(scene.entries.find(value=>value.cls==='battleship').items.find(value=>value.semantic==='hull-details-hp').primitives.filter(value=>value.fill==='#fff').length>=12,'fractional HP uses ceil pips');
  assert.deepEqual(scene.canvasStrokeState,{lineJoin:'miter',lineCap:'round',globalAlpha:1,lineDash:[],lineDashOffset:0},'visible surface wake hands round caps to retained shells');

  const status=ship('battleship',90,25); Object.assign(status,{selected:true,destination:{x:160,y:30},recoil:true,fireAngle:0,refitFraction:.25,cruise:true,cooldownFraction:.5});
  const statusScene=createWarshipScene({...input,warships:[status]});
  assert.deepEqual(statusScene.entries[0].items.map(value=>value.semantic),['gun-range','barrage-range','selected-ring','destination-line','wake','hull-details-hp','muzzle-flash','refit-arc','cm-badge','barrage-cooldown']);
  assert.deepEqual(statusScene.entries[0].items.map(value=>[value.semantic,value.lineCap]),[['gun-range','butt'],['barrage-range','butt'],['selected-ring','butt'],['destination-line','butt'],['wake','round'],['hull-details-hp','round'],['muzzle-flash','round'],['refit-arc','round'],['cm-badge','round'],['barrage-cooldown','round']],'a wake transition affects only the hull and later status work of the current actor');
  assert.deepEqual(statusScene.strokeTimeline,[{id:90,order:0,cls:'battleship',incomingLineCap:'butt',outgoingLineCap:'round',wakeTransition:true}]);
  assert.equal(statusScene.entries[0].items.find(value=>value.semantic==='cm-badge').label.baseline,'alphabetic');
  assert.equal(statusScene.entries[0].items.find(value=>value.semantic==='cm-badge').label.lineCap,'round');
  assert.equal(statusScene.labelCount,1); assert.equal(statusScene.entries[0].items.find(value=>value.semantic==='refit-arc').primitives[0].end,-Math.PI/2+Math.PI*.5);
  assert.equal(statusScene.entries[0].items.find(value=>value.semantic==='barrage-cooldown').primitives[0].end,-Math.PI/2+Math.PI);
  const hull=statusScene.entries[0].items.find(value=>value.semantic==='hull-details-hp').primitives[0]; assert.ok(hull.points.some(value=>value.x<50),'recoil offsets hull opposite the supplied fire angle');
  assert.equal(hull.join,'round','drawShip locally rounds its closed hull joins'); assert.equal(hull.cap,'round');

  const damaged={...ship('cruiser',97,25),heading:.7,lean:.2,recoil:true,fireAngle:.4,hp:2.2,hpMax:6,wake:[]},damagedScene=createWarshipScene({...input,warships:[damaged]}),damagedPrimitives=damagedScene.entries[0].items.find(value=>value.semantic==='hull-details-hp').primitives,pips=damagedPrimitives.slice(-Math.ceil(damaged.hp));
  assert.equal(pips.length,3,'fractional damaged HP retains ceil pip count'); assert.ok(pips.every(value=>value.kind==='polygon'&&value.fill==='#fff'),'leaned HP rectangles are emitted as polygons after hull details');
  const r=6.6,px=50,py=40,rx=px-Math.cos(.4)*r*.25,ry=py-Math.sin(.4)*r*.25,pip=2*r/6,pipWidth=Math.max(1,pip-1),pipY=ry-r*1.5,leanPoint=(x,y)=>({x:rx+(x-rx)+.2*.6*(y-ry),y:ry+(1-Math.abs(.2)*.3)*(y-ry)}),expected=[leanPoint(rx-r,pipY),leanPoint(rx-r+pipWidth,pipY),leanPoint(rx-r+pipWidth,pipY+2),leanPoint(rx-r,pipY+2)];
  for(let i=0;i<4;i++){ assert.ok(Math.abs(pips[0].points[i].x-expected[i].x)<1e-12); assert.ok(Math.abs(pips[0].points[i].y-expected[i].y)<1e-12); }
  assert.ok(Math.abs(pips[1].points[0].x-leanPoint(rx-r+pip,pipY).x)<1e-12,'pip spacing uses the exact legacy pre-lean width increment');
  const minWidthShip={...damaged,id:98,hp:1,hpMax:100},minWidthPip=createWarshipScene({...input,warships:[minWidthShip]}).entries[0].items.find(value=>value.semantic==='hull-details-hp').primitives.at(-1);
  assert.ok(Math.abs(minWidthPip.points[1].x-minWidthPip.points[0].x-1)<1e-12,'legacy minimum pip width is preserved before lean');

  const cruiser=ship('cruiser',93,25); Object.assign(cruiser,{selected:true,destination:{x:160,y:30},refitFraction:.25,cruise:true,cooldownFraction:.5});
  const cruiserScene=createWarshipScene({...input,warships:[cruiser]}),cruiserHull=cruiserScene.entries[0].items.find(value=>value.semantic==='hull-details-hp').primitives;
  assert.ok(cruiserHull.filter(value=>value.stroke).every(value=>value.cap==='round'&&value.join==='round'),'cruiser hull outline and open mast details inherit the post-wake cap while drawShip scopes round joins');
  const inheritedRound=createWarshipScene({...input,inheritedStrokeState:{lineJoin:'miter',lineCap:'round'},warships:[{...cruiser,wake:[]}]}),roundEntry=inheritedRound.entries[0];
  assert.ok(roundEntry.items.filter(value=>value.kind==='graphics').every(value=>value.lineCap==='round'),'inherited round survives no-wake actors');

  const noWake={...ship('warship',94,25),wake:[]},laterSub={...ship('sub',95,40),wake:[]},noWakeScene=createWarshipScene({...input,warships:[noWake,laterSub]});
  assert.equal(noWakeScene.canvasStrokeState.lineCap,'butt','surface wake shorter than two leaves the incoming cap unchanged');
  assert.deepEqual(noWakeScene.strokeTimeline.map(value=>[value.incomingLineCap,value.outgoingLineCap]),[['butt','butt'],['butt','butt']]);
  const priorWakeScene=createWarshipScene({...input,warships:[ship('warship',96,25),laterSub]}),subEntry=priorWakeScene.entries.find(value=>value.id===laterSub.id);
  assert.equal(subEntry.incomingLineCap,'round','a later submarine inherits a prior surface wake transition');
  assert.ok(subEntry.items.find(value=>value.semantic==='hull-details-hp').primitives.filter(value=>value.stroke).every(value=>value.cap==='round'),'submarine alpha does not alter inherited cap');

  const crossing=ship('warship',91,-100); crossing.wake=[]; crossing.destination={x:150,y:40}; crossing.selected=true; crossing.gun=100;
  const crossingScene=createWarshipScene({...input,viewport:{width:100,height:80},warships:[crossing]});
  assert.deepEqual(crossingScene.entries[0].items.map(value=>value.semantic),['gun-range','destination-line'],'crossing range and destination survive while offscreen hull and selected ring are culled');
  const offscreenWake=ship('warship',92,1000); offscreenWake.wake=[[998,20],[999,20]];
  const offscreenScene=createWarshipScene({...input,viewport:{width:100,height:80},warships:[offscreenWake]});
  assert.equal(offscreenScene.entries.length,0); assert.equal(offscreenScene.canvasStrokeState.lineCap,'round','offscreen-visible wake still changes retained Canvas shell caps');
  assert.deepEqual(offscreenScene.strokeTimeline,[{id:92,order:0,cls:'warship',incomingLineCap:'butt',outgoingLineCap:'round',wakeTransition:true}],'viewport culling does not suppress the Canvas state transition');
  const hidden={...offscreenWake,visible:false}; assert.equal(createWarshipScene({...input,warships:[hidden]}).canvasStrokeState.lineCap,'butt','fog/sub-hidden wakes do not change inherited state');
  assert.deepEqual(createWarshipScene({...input,warships:[hidden]}).strokeTimeline,[],'fog-hidden actors emit no chronological state');
  assert.deepEqual(warshipCanvasStrokeState({inheritedStrokeState:{lineJoin:'round',lineCap:'round'},warships:[]}),{lineJoin:'round',lineCap:'round',globalAlpha:1,lineDash:[],lineDashOffset:0});

  assert.throws(()=>createWarshipScene({...input,warships:[{...status,id:null}]}),/missing warship stable ID/);
  assert.throws(()=>createWarshipScene({...input,warships:[status,{...status}]}),/duplicate warship stable ID/);
  assert.throws(()=>createWarshipScene(input,{entries:classes.length-1}),/entry-cap/); assert.equal(createWarshipScene(input,{entries:classes.length}).counts.total,classes.length);
  assert.throws(()=>createWarshipScene(input,{wakePoints:scene.wakePointCount-1}),/wake-cap/); assert.equal(createWarshipScene(input,{wakePoints:scene.wakePointCount}).wakePointCount,scene.wakePointCount);
  assert.throws(()=>createWarshipScene(input,{primitives:scene.primitiveCount-1}),/primitive-cap/); assert.equal(createWarshipScene(input,{primitives:scene.primitiveCount}).primitiveCount,scene.primitiveCount);
  assert.throws(()=>createWarshipScene(input,{segments:scene.segmentCount-1}),/segment-cap/); assert.equal(createWarshipScene(input,{segments:scene.segmentCount}).segmentCount,scene.segmentCount);
  assert.throws(()=>createWarshipScene({...input,warships:[status]},{labels:0}),/label-cap/); assert.equal(createWarshipScene({...input,warships:[status]},{labels:1}).labelCount,1);
  assert.deepEqual(createWarshipScene(input),scene,'model is repeatable without RNG, clock, or hidden presentation state');
  console.log('Warship layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
