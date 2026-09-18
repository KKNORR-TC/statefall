'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const {MAX_STRUCTURE_POOL,MAX_STRUCTURE_SPRITES,createBoundedPool,structureTextureKey,structureVisual}=await import('../game/src/rendering/structure-layer-model.mjs');
  const camera={x:-100,y:-50,scale:2},viewport={width:800,height:600},tile=25*720+100;
  assert.deepEqual(structureVisual({tile,building:false,pop:1},camera,viewport,null),{x:101,y:1,radius:6,scale:1,alpha:1});
  assert.equal(structureVisual({tile},{...camera,scale:0.89},viewport,null),null);
  assert.equal(structureVisual({tile},camera,viewport,new Uint8Array(tile+1)),null);
  assert.equal(structureVisual({tile:400*720+700},camera,viewport,null),null);
  assert.deepEqual(structureVisual({tile,building:true,pop:1.35},camera,viewport,null),{x:101,y:1,radius:6,scale:1,alpha:0.45});
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
  assert.equal(MAX_STRUCTURE_SPRITES,4096); assert.equal(MAX_STRUCTURE_POOL,512);
  console.log('Structure layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
