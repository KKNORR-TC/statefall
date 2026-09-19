'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const {MAX_STRUCTURE_POOL,MAX_STRUCTURE_SPRITES,STRUCTURE_ANTIALIAS_MARGIN,createBoundedPool,structureBasePaintBounds,structureTextureKey,structureVisual}=await import('../game/src/rendering/structure-layer-model.mjs');
  const camera={x:-100,y:-50,scale:2},viewport={width:800,height:600},tile=25*720+100;
  assert.deepEqual(structureVisual({tile,building:false,pop:1},camera,viewport,null),{x:101,y:1,radius:6,scale:1,alpha:1});
  assert.equal(structureVisual({tile},{...camera,scale:0.89},viewport,null),null);
  assert.equal(structureVisual({tile},camera,viewport,new Uint8Array(tile+1)),null);
  assert.equal(structureVisual({tile:400*720+700},camera,viewport,null),null);
  assert.deepEqual(structureVisual({tile,building:true,pop:1.35},camera,viewport,null),{x:101,y:1,radius:6,scale:1,alpha:0.45});
  assert.equal(STRUCTURE_ANTIALIAS_MARGIN,1);
  assert.deepEqual(structureBasePaintBounds('city',10,20,24),{left:-17.16,top:-7.16,right:37.16,bottom:47.16,kind:'base'});
  assert.deepEqual(structureBasePaintBounds('bertha',10,20,24),{left:-17.880000000000003,top:-7.880000000000003,right:37.88,bottom:47.88,kind:'base'},'Bertha muzzle flare must extend the common base bounds');
  assert.deepEqual(structureBasePaintBounds('engcmd',10,20,24),{left:-18.119999999999997,top:-8.119999999999997,right:38.12,bottom:48.12,kind:'base'},'engineering hook must retain the audited maximum glyph extent');
  assert.equal(structureBasePaintBounds('engcmd',0,0,48).right,56.239999999999995,'the radius-24 source-texture AA margin must scale with its displayed radius');
  assert.equal(structureBasePaintBounds('city',0,0,38.88).right,43.9992,'scale-12 pop-1.35 bounds apply the scaled texture AA margin once after stroke extent');
  const edgeTile=10,edgeExtent=structureBasePaintBounds('city',0,0,6*1.35).right;
  assert.ok(structureVisual({tile:edgeTile,type:'city',pop:1.35},{x:-21-edgeExtent,y:-1,scale:2},{width:100,height:100},null,100),'a base with only its outer stroke/AA touching the viewport must remain visible');
  assert.equal(structureVisual({tile:edgeTile,type:'city',pop:1.35},{x:-21-edgeExtent-.001,y:-1,scale:2},{width:100,height:100},null,100),null,'a base beyond the conservative painted extent may be culled');
  assert.notEqual(structureTextureKey('city','#ABCDEF'),structureTextureKey('city','#123456'));
  assert.equal(structureTextureKey('city','#ABCDEF'),structureTextureKey('city','#abcdef'));

  let next=0,destroyed=0;
  const pool=createBoundedPool({maximum:3,idleMaximum:2,create:()=>({id:++next}),destroy:()=>destroyed++});
  const values=[pool.acquire(),pool.acquire(),pool.acquire()];
  assert.equal(pool.acquire(),null,'pool must enforce its live bound');
  values.forEach(value=>pool.release(value));
  assert.deepEqual(pool.diagnostics(),{live:2,pooled:2,created:3,reused:0,destroyed:1,maximum:3,idleMaximum:2});
  assert.ok(pool.acquire()); assert.equal(pool.diagnostics().reused,1);
  pool.drain(); assert.equal(destroyed,2);
  const atomic=createBoundedPool({maximum:2,idleMaximum:2,create:()=>({id:++next}),destroy:()=>destroyed++});
  assert.equal(atomic.acquireMany(3),null,'a frame reservation over the cap must fail atomically');
  assert.deepEqual(atomic.diagnostics(),{live:2,pooled:2,created:2,reused:0,destroyed:0,maximum:2,idleMaximum:2});
  const complete=atomic.acquireMany(2); assert.equal(complete.length,2); assert.equal(atomic.acquire(),null);
  complete.forEach(value=>atomic.release(value)); atomic.drain();
  for(const pattern of ['acquire','acquireMany']){
    let attempts=0;
    const throwing=createBoundedPool({maximum:1,idleMaximum:1,create:()=>{ if(attempts++===0) throw new Error('create-once'); return {ok:true}; },destroy:()=>{}});
    assert.throws(()=>pattern==='acquire'?throwing.acquire():throwing.acquireMany(1),/create-once/);
    assert.deepEqual(throwing.diagnostics(),{live:0,pooled:0,created:0,reused:0,destroyed:0,maximum:1,idleMaximum:1},`${pattern} must not leave a phantom live slot`);
    const recovered=pattern==='acquire'?throwing.acquire():throwing.acquireMany(1)[0]; assert.deepEqual(recovered,{ok:true});
    assert.equal(throwing.diagnostics().live,1,`${pattern} must recover at cap one`);
  }
  assert.equal(MAX_STRUCTURE_SPRITES,4096); assert.equal(MAX_STRUCTURE_POOL,512);
  console.log('Structure layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
