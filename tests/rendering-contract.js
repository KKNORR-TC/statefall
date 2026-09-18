'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const {createCamera,CAMERA_MIN_SCALE,CAMERA_MAX_SCALE}=await import('../game/src/rendering/camera.mjs');
  const {viewportMetrics}=await import('../game/src/rendering/viewport.mjs');

  const camera=createCamera({x:13,y:-7,scale:2.5});
  const screen=camera.worldToScreen(42.25,19.5),world=camera.screenToWorld(screen.x,screen.y);
  assert.deepEqual(world,{x:42.25,y:19.5});
  assert.equal(camera.screenToTile(screen.x,screen.y,720,414),19*720+42);
  assert.equal(camera.screenToTile(-10,-10,720,414),-1);

  const anchor={x:321.5,y:188.25},before=camera.screenToWorld(anchor.x,anchor.y);
  camera.zoomAt(anchor.x,anchor.y,7.5);
  assert.deepEqual(camera.screenToWorld(anchor.x,anchor.y),before,'zoom must preserve its world anchor');
  camera.s=Infinity; assert.equal(camera.s,7.5);
  camera.s=1e6; assert.equal(camera.s,CAMERA_MAX_SCALE);
  camera.s=-1; assert.equal(camera.s,CAMERA_MIN_SCALE);

  camera.focus(100,50,800,600,4);
  assert.deepEqual(camera.visibleBounds(800,600),{left:0,top:-25,right:200,bottom:125,width:200,height:150});
  const oldCenter=camera.screenToWorld(400,300);
  camera.preserveResizeCenter(800,600,1200,900);
  assert.deepEqual(camera.screenToWorld(600,450),oldCenter,'resize must retain old viewport-center world focus');

  assert.deepEqual(viewportMetrics(801,499,1),{cssWidth:801,cssHeight:499,deviceDpr:1,effectiveDpr:1,pixelWidth:801,pixelHeight:499});
  assert.deepEqual(viewportMetrics(801,499,1.5),{cssWidth:801,cssHeight:499,deviceDpr:1.5,effectiveDpr:1.5,pixelWidth:1202,pixelHeight:749});
  assert.deepEqual(viewportMetrics(801,499,3),{cssWidth:801,cssHeight:499,deviceDpr:3,effectiveDpr:2,pixelWidth:1602,pixelHeight:998});
  console.log('Camera and viewport contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
