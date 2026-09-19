'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const {createPreStructureScene,dashSegments,dashedSegmentCount,findStructureCompositingConflict,primitiveGraphicsSegments,primitiveIntersectsViewport,primitivePaintBounds,retainedPostBaseBounds}=await import('../game/src/rendering/pre-structure-layer-model.mjs');
  const {structureBasePaintBounds}=await import('../game/src/rendering/structure-layer-model.mjs');
  const {RASTER_ANTIALIAS_MARGIN_CSS,conservativePaintBounds,paintBoundsIntersect}=await import('../game/src/rendering/paint-bounds.mjs');
  const base={camera:{x:0,y:0,scale:2},viewport:{width:300,height:200},mapWidth:100,time:600,reducedMotion:false,quality:'high',fronts:[{tile:101,color:'#f00'},{tile:99999,color:'#000'}],supplyLinks:[{from:101,to:110,color:'#0f0'}],missileFocus:{tile:105,active:true},commandLinks:[{from:102,to:108,color:'rgba(255,170,80,.55)',type:'command'},{from:103,to:109,color:'rgba(120,220,255,.55)',type:'flightops'},{from:104,to:106,color:'rgba(190,230,150,.55)',type:'troopcmd'}],structures:[
    {tile:101,type:'airfield',level:2,lshield:2,lshieldMax:6,bubbleRange:9,repairing:true,repairFraction:.5},
    {tile:102,type:'shield',level:1,hp:3,hpMax:12,bubbleRange:12},
    {tile:103,type:'port',level:2,gunHp:2},
    {tile:104,type:'jammer',level:1,owned:true,jammerRange:30},
    {tile:105,type:'bertha',level:1,owned:true,gunRange:80,hp:4,gunHpMax:8,gunHpDamaged:true},
    {tile:106,type:'command',level:1,owned:true,commandRange:45},
    {tile:107,type:'sam',level:1,owned:true,samRange:18},
    {tile:108,type:'fort',level:3,owned:true,fortRange:14}
  ]};
  const scene=createPreStructureScene(base);
  assert.deepEqual(scene.counts,{fronts:1,supplyLinks:1,supplyMarkers:1,focusRings:1,commandLinks:3,commandMarkers:3,bubbles:2,pips:12,repairArcs:1,jammerRanges:1,gunRanges:1,commandRanges:1,samRanges:1,fortRanges:1});
  assert.deepEqual(scene.fronts.map(value=>value.kind),['rect']);
  assert.deepEqual({x:scene.fronts[0].x,y:scene.fronts[0].y,width:scene.fronts[0].width,height:scene.fronts[0].height},{x:2,y:2,width:2,height:2});
  assert.equal(scene.routes[0].kind,'line');
  assert.equal(scene.rangesStatus.at(-1).stroke,'rgba(255,210,122,.35)');
  assert.deepEqual(scene.structureEntries.map(entry=>entry.tile),base.structures.map(entry=>entry.tile),'pre-base entries retain legacy structure-array order');
  assert.equal(createPreStructureScene(base).routes[2].x,scene.routes[2].x,'phase must be deterministic');
  assert.notEqual(createPreStructureScene({...base,time:900}).routes[2].x,scene.routes[2].x,'normal route marker must move with supplied presentation time');
  assert.deepEqual(scene.routes.filter(value=>value.routeType&&value.kind==='line').map(value=>value.routeType),['command','flightops','troopcmd']);
  const focus=scene.routes.find(value=>value.kind==='circle'&&value.dash);
  assert.equal(focus.phase,(base.time/60)%16,'missile focus must explicitly use the route phase');
  for(const supplyLinks of [[],base.supplyLinks]) for(const time of [600,900]){
    const phased=createPreStructureScene({...base,time,supplyLinks});
    const ring=phased.routes.find(value=>value.kind==='circle'&&value.dash);
    assert.equal(ring.phase,(time/60)%16,`focus phase must not depend on supply-link context state at ${time}ms`);
  }

  const generated=[...scene.fronts,...scene.routes,...scene.rangesStatus].flatMap(value=>value.graphicsSegments);
  assert.equal(generated.length,scene.segmentCount);
  assert.equal(scene.emittedSegmentCount,scene.segmentCount);
  for(const primitive of [...scene.fronts,...scene.routes,...scene.rangesStatus]) assert.deepEqual(primitive.graphicsSegments,primitiveGraphicsSegments(primitive));

  const shifted=dashSegments(103,6,10,13);
  assert.deepEqual(shifted[0],{from:3,to:9});
  assert.deepEqual(shifted.at(-1),{from:99,to:103});
  assert.equal(dashedSegmentCount(103,6,10,13),shifted.length);
  assert.deepEqual(primitiveGraphicsSegments({kind:'rect',x:1,y:2,width:3,height:4,fill:'#fff'}),[{kind:'rect',x:1,y:2,width:3,height:4}]);
  assert.deepEqual(primitiveGraphicsSegments({kind:'arc',x:1,y:2,r:3,start:0,end:Math.PI,stroke:'#fff'}),[{kind:'arc',x:1,y:2,r:3,start:0,end:Math.PI}]);
  const dashedFilledCircle=primitiveGraphicsSegments({kind:'circle',x:1,y:2,r:8,fill:'#123456',stroke:'#fff',dash:[3,5],phase:2});
  assert.equal(dashedFilledCircle[0].paint,'fill'); assert.ok(dashedFilledCircle.slice(1).every(value=>value.kind==='arc'&&value.paint==='stroke'));
  const phaseRoute=createPreStructureScene({...base,camera:{x:-600,y:0,scale:12},viewport:{width:4000,height:300},time:777,supplyLinks:[{from:1,to:99,color:'#0f0'}],commandLinks:[],structures:[],fronts:[],missileFocus:null});
  const dashedRoute=phaseRoute.routes.find(value=>value.kind==='line'&&value.dash);
  assert.ok(dashedRoute.graphicsSegments.length>40,'long phase-shifted routes must use actual generated dash arrays');
  assert.ok(dashedRoute.graphicsSegments[0].x1>=Math.min(dashedRoute.x1,dashedRoute.x2));
  assert.ok(dashedRoute.graphicsSegments.at(-1).x2<=Math.max(dashedRoute.x1,dashedRoute.x2));

  const reduced=createPreStructureScene({...base,reducedMotion:true,time:900});
  assert.equal(reduced.fronts[0].alpha,.5);
  assert.ok(reduced.rangesStatus.some(value=>value.fill==='rgba(150,220,255,0.14)'),'reduced low-shield pulse must retain a frozen visible fill');
  assert.equal(reduced.routes[2].x,(reduced.routes[1].x1+reduced.routes[1].x2)/2);
  assert.deepEqual(createPreStructureScene({...base,reducedMotion:true,time:1200}).routes.map(value=>value.graphicsSegments),reduced.routes.map(value=>value.graphicsSegments));
  assert.deepEqual(createPreStructureScene({...base,reducedMotion:true,time:1200}).rangesStatus,reduced.rangesStatus,'reduced low-shield/status presentation must remain frozen');
  assert.equal(reduced.routes.find(value=>value.kind==='circle'&&value.dash).phase,0);
  for(const value of [scene,reduced]){
    assert.equal(value.rangesStatus.find(range=>range.stroke==='rgba(255,180,80,.35)').phase,0,'jammer dash phase must be explicit and motion-independent');
    assert.equal(value.rangesStatus.find(range=>range.stroke==='rgba(255,180,80,.18)').phase,0,'command-range dash phase must be explicit and motion-independent');
  }
  const medium=createPreStructureScene({...base,quality:'medium'}),low=createPreStructureScene({...base,quality:'low'});
  assert.equal(medium.counts.commandLinks,3); assert.equal(low.counts.commandLinks,3);
  assert.ok(low.segmentCount<medium.segmentCount&&medium.segmentCount<scene.segmentCount);
  for(const qualityScene of [scene,medium,low]) assert.equal([...qualityScene.fronts,...qualityScene.routes,...qualityScene.rangesStatus].reduce((sum,value)=>sum+value.graphicsSegments.length,0),qualityScene.segmentCount);
  const focusSegments=value=>value.routes.find(route=>route.kind==='circle'&&route.dash).graphicsSegments.length;
  assert.ok(focusSegments(low)<focusSegments(medium)&&focusSegments(medium)<focusSegments(scene),'dashed circles must use the same once-scaled quality geometry as routes');
  const commandRangeSegments=value=>value.rangesStatus.find(range=>range.stroke==='rgba(255,180,80,.18)').graphicsSegments.length;
  assert.equal(commandRangeSegments(scene),commandRangeSegments(medium)); assert.equal(commandRangeSegments(scene),commandRangeSegments(low),'quality must not alter gameplay range geometry');
  assert.throws(()=>primitiveGraphicsSegments({kind:'line',x1:0,y1:0,x2:1e12,y2:0,dash:[1,1]},10),/segment-cap/,'path generation must stop at the remaining cap');

  assert.equal(primitiveIntersectsViewport({kind:'line',x1:-20,y1:-20,x2:120,y2:120,width:2},{width:100,height:100}),true,'diagonal crossing must survive culling');
  assert.equal(primitiveIntersectsViewport({kind:'line',x1:-20,y1:-8,x2:120,y2:-8,width:18},{width:100,height:100}),true,'scale-12 underlay half-width must survive edge culling');
  assert.equal(primitiveIntersectsViewport({kind:'line',x1:-20,y1:-10,x2:120,y2:-10,width:18},{width:100,height:100}),true,'the shared AA margin must retain a stroke exactly one CSS pixel beyond its geometric edge');
  assert.equal(primitiveIntersectsViewport({kind:'line',x1:-20,y1:-10.01,x2:120,y2:-10.01,width:18},{width:100,height:100}),false);
  assert.equal(primitiveIntersectsViewport({kind:'circle',x:-10,y:50,r:11,fill:'#fff'},{width:100,height:100}),true,'scale-12 route marker must remain at an edge');
  assert.equal(primitiveIntersectsViewport({kind:'circle',x:50,y:50,r:200,stroke:'#fff',width:2},{width:100,height:100}),false,'a remote ring enclosing the viewport does not intersect it');

  const fog=new Uint8Array(300); fog[101]=1;
  const fogScene=createPreStructureScene({...base,fog,supplyLinks:[{from:101,to:110,color:'#0f0'},{from:102,to:103,color:'#f00'}],commandLinks:[{from:101,to:102,color:'#fff',type:'command'}]});
  assert.equal(fogScene.counts.supplyLinks,1,'a supply route remains if either endpoint is visible');
  assert.equal(fogScene.counts.supplyMarkers,1);
  assert.equal(fogScene.counts.commandLinks,0,'command routes require both endpoints visible');
  assert.deepEqual(fogScene.structureEntries.map(entry=>entry.tile),[101]);
  assert.equal(fogScene.counts.focusRings,1,'legacy missile focus remains visible when its target tile is fog-hidden');

  assert.equal(RASTER_ANTIALIAS_MARGIN_CSS,1);
  assert.deepEqual(primitivePaintBounds({kind:'circle',x:10,y:20,r:5,width:2}),{left:3,top:13,right:17,bottom:27,kind:'pre-base-circle'});
  const overlayCamera={x:0,y:0,scale:2},overlayTile=101;
  const marks=retainedPostBaseBounds({tile:overlayTile,type:'airfield',building:false,pop:1.2,level:3,upgrading:true,airQueue:true,airQueueText:'2/6 · F 12s',shipQueue:true,shipQueueText:'Cruiser 12s +1',suppressed:true,linked:true,cooldown:true},overlayCamera,100).map(value=>value.kind);
  assert.deepEqual(marks,['pop-ring','level-mark','upgrade-ring','airfield-queue-text','airfield-queue-ring','port-queue-ring','port-queue-text','suppressed-x','linked-ring','cooldown-ring']);
  assert.deepEqual(retainedPostBaseBounds({tile:overlayTile,type:'city',building:true,buildText:'12s'},overlayCamera,100).map(value=>value.kind),['building-ring','building-text']);
  const conflictFor=mark=>findStructureCompositingConflict([{tile:1,postBounds:[{left:10,top:10,right:20,bottom:20,kind:mark}],pixiBounds:[]},{tile:2,postBounds:[],pixiBounds:[{left:15,top:15,right:25,bottom:25,kind:'base'}]}],{width:100,height:100});
  for(const mark of ['building-ring','building-text','upgrade-ring','airfield-queue-ring','airfield-queue-text','port-queue-ring','port-queue-text','pop-ring','level-mark','suppressed-x','linked-ring','cooldown-ring']) assert.equal(conflictFor(mark).earlierMark,mark);
  assert.equal(findStructureCompositingConflict([{tile:1,postBounds:[{left:10,top:10,right:20,bottom:20,kind:'building-text'}],pixiBounds:[]},{tile:2,postBounds:[],pixiBounds:[{left:21,top:10,right:30,bottom:20,kind:'base'}]}],{width:100,height:100}),null,'already-conservative separated bounds remain Pixi-safe');
  const edgeBase=structureBasePaintBounds('city',30,20,6),edgeOverlay={left:22.25,top:20,right:22.25,bottom:20,kind:'linked-ring'};
  assert.equal(edgeBase.left,22.25);
  assert.ok(findStructureCompositingConflict([{tile:1,postBounds:[edgeOverlay],pixiBounds:[]},{tile:2,postBounds:[],pixiBounds:[edgeBase]}],{width:100,height:100}),'a conflict at the exact outer-stroke/AA edge must not be missed');
  const viewportEdgeBase=structureBasePaintBounds('city',-7.75,50,6);
  assert.equal(viewportEdgeBase.right,0);
  assert.ok(findStructureCompositingConflict([{tile:1,postBounds:[{left:0,top:50,right:0,bottom:50,kind:'linked-ring'}],pixiBounds:[]},{tile:2,postBounds:[],pixiBounds:[viewportEdgeBase]}],{width:100,height:100}),'stroke/AA pixels touching the viewport edge must participate in conflict detection');
  const crossingRange=findStructureCompositingConflict([{tile:1,postBounds:[{left:45,top:45,right:55,bottom:55,kind:'level-mark'}],pixiBounds:[]},{tile:2,postBounds:[],pixiBounds:[primitivePaintBounds({kind:'circle',x:100,y:50,r:50,width:2})]}],{width:100,height:100});
  assert.equal(crossingRange.laterPrimitive,'pre-base-circle','later ranges extending onscreen participate in conflict detection');

  for(const gap of [0,.25,.5,.99,1,1.01,1.99,2]){
    const left=conservativePaintBounds(0,0,0,0,'left'),right=conservativePaintBounds(gap,0,gap,0,'right');
    assert.equal(paintBoundsIntersect(left,right),true,`CSS gap ${gap} must not become false-safe`);
  }
  const separatedLeft=conservativePaintBounds(0,0,0,0,'left'),separatedRight=conservativePaintBounds(2.01,0,2.01,0,'right');
  assert.equal(paintBoundsIntersect(separatedLeft,separatedRight),false,'a gap beyond both conservative paint margins should remain non-conflicting');
  const scaledBase=structureBasePaintBounds('city',96,50,38.88),scaledPopRing=retainedPostBaseBounds({tile:0,type:'city',pop:1.35},{x:-6,y:44,scale:12},1)[0];
  assert.equal(scaledPopRing.kind,'pop-ring');
  assert.ok(paintBoundsIntersect(scaledPopRing,scaledBase),'the scaled source-texture margin closes the scale-12/pop-1.35 eight-tile gap');
  assert.equal(paintBoundsIntersect(scaledPopRing,structureBasePaintBounds('city',108,50,38.88)),false,'a nine-tile gap beyond the conservative margins remains safe');

  const culled=createPreStructureScene({...base,camera:{x:10000,y:10000,scale:2}}); assert.equal(culled.primitiveCount,0);
  const strategic=createPreStructureScene({...base,camera:{x:0,y:0,scale:.5}}); assert.equal(strategic.counts.supplyLinks,0); assert.equal(strategic.counts.supplyMarkers,1); assert.equal(strategic.counts.commandLinks,0);
  assert.throws(()=>createPreStructureScene(base,{primitiveLimit:scene.primitiveCount-1}),/primitive-cap/);
  assert.equal(createPreStructureScene(base,{primitiveLimit:scene.primitiveCount}).primitiveCount,scene.primitiveCount);
  assert.equal(createPreStructureScene(base,{primitiveLimit:scene.primitiveCount+1}).primitiveCount,scene.primitiveCount);
  assert.throws(()=>createPreStructureScene(base,{segmentLimit:scene.segmentCount-1}),/segment-cap/);
  assert.equal(createPreStructureScene(base,{segmentLimit:scene.segmentCount}).segmentCount,scene.segmentCount);
  assert.equal(createPreStructureScene(base,{segmentLimit:scene.segmentCount+1}).segmentCount,scene.segmentCount);
  const {createPixiHybridRenderer}=await import('../game/src/rendering/pixi-hybrid-renderer.mjs');
  const direct=createPixiHybridRenderer();
  assert.deepEqual(direct.diagnostics().quality,{requested:'high',effective:'high'},'direct default construction must not enter a parameter TDZ');
  direct.destroy();
  console.log('Pre-structure layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
