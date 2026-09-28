'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');

(async()=>{
  const {TERRAIN_FILTER,TERRAIN_PIXELS_PER_TILE,TERRAIN_STYLE_REVISION,createTerrainRasterModel}=await import('../game/src/rendering/terrain-raster-model.mjs');
  const width=8,height=6,length=width*height,ppt=TERRAIN_PIXELS_PER_TILE,pixelWidth=width*ppt;
  const land=Uint8Array.from([
    0,0,0,0,0,0,0,0,
    0,1,1,1,0,1,1,0,
    0,1,1,1,1,1,1,0,
    0,1,1,1,1,1,1,0,
    0,0,1,1,1,1,0,0,
    0,0,0,0,0,0,0,0
  ]),river=new Uint8Array(length),rough=new Float32Array(length),owner=new Int16Array(length).fill(-1),shelled=new Uint32Array(length),fog=new Uint8Array(length).fill(1),areaOf=new Int16Array(length).fill(-1);
  river[2*width+3]=1;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) rough[y*width+x]=x/(width-1);
  for(let y=1;y<=4;y++) for(let x=1;x<=6;x++) if(land[y*width+x]) owner[y*width+x]=x<4?0:1;
  areaOf[2*width+2]=areaOf[3*width+2]=4; shelled[3*width+4]=130; fog[2*width+5]=0;
  const colors=['#d9485f','#33a06f'],teams=[0,0],base={width,height,land,river,rough,owner,shelled,fog,areaOf,colors,teams,tick:100,suppressTicks:40,pickArea:-1,myId:0,highlightId:-1,detailLevel:'operational'};
  const sourcePixel=(pixels,tileX,tileY,subX=2,subY=2)=>{ const offset=(((tileY*ppt+subY)*pixelWidth)+(tileX*ppt+subX))*4; return Array.from(pixels.slice(offset,offset+4)); };
  const luminance=value=>value[0]*.3+value[1]*.59+value[2]*.11;
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const before=Object.fromEntries(Object.entries(base).filter(([,value])=>ArrayBuffer.isView(value)).map(([key,value])=>[key,Buffer.from(value.buffer,value.byteOffset,value.byteLength).toString('hex')]));

  const model=createTerrainRasterModel(),first=model.update(base),held=first.pixels.slice(),metadata=first.diagnostics;
  assert.equal(first.changed,true); assert.equal(first.staticChanged,true);
  assert.deepEqual({...metadata, timing:undefined,reasons:undefined},{
    staticBuild:1,compositeBuild:1,cacheSkip:0,reasons:undefined,timing:undefined,
    worldWidth:width,worldHeight:height,pixelWidth:width*ppt,pixelHeight:height*ppt,pixelsPerTile:ppt,styleRevision:TERRAIN_STYLE_REVISION,
    bytes:width*height*ppt*ppt*4,sourceBytes:width*height*ppt*ppt*4,staticBytes:width*height*ppt*ppt*4,modelRasterRetainedBytes:width*height*ppt*ppt*8,modelInputBytesEstimate:length*12,workerPeakBytesEstimate:width*height*ppt*ppt*16+length*12,
    detailLevel:'operational',filter:TERRAIN_FILTER,filterPolicy:{canvas:'imageSmoothingEnabled with imageSmoothingQuality=high',pixi:'bilinear/linear texture sampling'}
  });
  assert.equal(crypto.createHash('sha256').update(first.pixels).digest('hex'),'03bb5b74cfe4c3905ae45efb5216ff9aa9643e048ec62929b2fc749e705f426e');
  const subpixels=new Set(); for(let sy=0;sy<ppt;sy++) for(let sx=0;sx<ppt;sx++) subpixels.add(sourcePixel(first.pixels,2,3,sx,sy).join(','));
  assert(subpixels.size>4,'terrain tiles contain genuine non-repeated subpixel detail');
  assert.notDeepEqual(sourcePixel(first.pixels,0,0),sourcePixel(first.pixels,1,0),'deep and shelf/coastal water differ');
  assert(luminance(sourcePixel(first.pixels,1,1,0,0))>luminance(sourcePixel(first.pixels,1,1,2,2)),'pale coastal keyline differs from dark wetline/interior');
  assert(distance(sourcePixel(first.pixels,3,2),[24,53,70])<distance(sourcePixel(first.pixels,2,2),[24,53,70]),'river center is stronger than river edge');
  assert.notDeepEqual(sourcePixel(first.pixels,2,3),sourcePixel(first.pixels,5,3),'bilinear relief/contour treatment varies continuously');

  const neutralOwner=new Int16Array(length).fill(-1),neutral=model.update({...base,owner:neutralOwner}),neutralPixel=sourcePixel(neutral.pixels,2,2),operational=model.update(base),operationalPixel=sourcePixel(operational.pixels,2,2),strategic=model.update({...base,detailLevel:'strategic'}),strategicPixel=sourcePixel(strategic.pixels,2,2),political=[217,72,95];
  assert(distance(strategicPixel,political)<distance(operationalPixel,political),'strategic ownership is stronger than operational ownership');
  assert(distance(operationalPixel,political)<distance(neutralPixel,political),'operational ownership remains translucent and readable');
  assert.equal(strategic.staticChanged,false); assert.equal(strategic.diagnostics.staticBuild,1); assert.equal(strategic.diagnostics.reasons['detail-level-change'],1);
  const sameTeamEdge=sourcePixel(strategic.pixels,3,2,3,2),sameTeamInterior=sourcePixel(strategic.pixels,2,2,2,2); assert.notDeepEqual(sameTeamEdge,sameTeamInterior,'allied edge has a soft boundary');
  const hostileTeams=[0,1],hostile=model.update({...base,detailLevel:'strategic',teams:hostileTeams}),hostileEdge=sourcePixel(hostile.pixels,3,2,3,2);
  assert(luminance(hostileEdge)<luminance(sameTeamEdge),'hostile boundary is narrower and crisper/darker than allied boundary');
  assert(luminance(sourcePixel(first.pixels,5,2))<luminance(sourcePixel(first.pixels,5,3)),'fog is applied last and hides information conservatively');

  const noSuppression=new Uint32Array(length),plain=model.update({...base,shelled:noSuppression}),suppressed=model.update(base),suppressedNext=model.update({...base,tick:101}); assert(luminance(sourcePixel(suppressed.pixels,4,3))<luminance(sourcePixel(plain.pixels,4,3)),'suppression semantics retained');
  assert.notDeepEqual(sourcePixel(suppressedNext.pixels,4,3),sourcePixel(suppressed.pixels,4,3),'suppression fade advances on consecutive ticks');
  const expired=model.update({...base,tick:131}); assert.notDeepEqual(sourcePixel(suppressed.pixels,4,3),sourcePixel(plain.pixels,4,3)); assert.deepEqual(sourcePixel(expired.pixels,4,3),sourcePixel(plain.pixels,4,3),'expired suppression returns to the independently settled baseline');
  const picked=model.update({...base,pickArea:4}); assert(luminance(sourcePixel(picked.pixels,2,2))>luminance(sourcePixel(suppressed.pixels,2,2)),'pick area semantics retained');
  const highlighted=model.update({...base,highlightId:0}),highlightedAgain=model.update({...base,highlightId:0}); assert.equal(highlightedAgain.changed,false,'fixed highlight does not pulse/rebuild'); assert.notDeepEqual(sourcePixel(highlighted.pixels,2,2),sourcePixel(suppressed.pixels,2,2),'player highlight semantics retained');
  const hidden=2*width+5,tileBytes=(pixels,x,y)=>{ const bytes=[]; for(let sy=0;sy<ppt;sy++){ const start=(((y*ppt+sy)*pixelWidth+x*ppt)*4); bytes.push(...pixels.slice(start,start+ppt*4)); } return bytes; },visibleBytes=pixels=>tileBytes(pixels,4,2),hiddenBytes=pixels=>tileBytes(pixels,5,2);
  const fadeFog=new Uint8Array(length).fill(1);fadeFog[2*width+2]=0;
  const fadeOpacity=new Uint8Array(length),fadeBase={...base,fog:fadeFog,shelled:noSuppression,owner:neutralOwner,fogOpacity:fadeOpacity};
  const clearFade=luminance(sourcePixel(model.update(fadeBase).pixels,2,2));
  fadeOpacity[2*width+2]=128;const partialFade=luminance(sourcePixel(model.update(fadeBase).pixels,2,2));
  fadeOpacity[2*width+2]=255;const darkFade=luminance(sourcePixel(model.update(fadeBase).pixels,2,2));
  assert.ok(clearFade>partialFade&&partialFade>darkFade,'terrain darkens gradually as presentation fog returns');
  assert.equal(fadeFog[2*width+2],0,'fading terrain never grants current sight');
  const privateBase=model.update({...base,shelled:noSuppression,pickArea:-1,highlightId:-1}),hiddenSuppression=new Uint32Array(length); hiddenSuppression[hidden]=130;
  assert.deepEqual(visibleBytes(model.update({...base,shelled:hiddenSuppression,pickArea:-1,highlightId:-1}).pixels),visibleBytes(privateBase.pixels),'hidden suppression cannot affect adjacent visible pixels');
  const hiddenArea=new Int16Array(length).fill(-1); hiddenArea[hidden]=7;
  assert.deepEqual(visibleBytes(model.update({...base,shelled:noSuppression,areaOf:hiddenArea,pickArea:7,highlightId:-1}).pixels),visibleBytes(privateBase.pixels),'hidden pick cannot affect adjacent visible pixels');
  assert.deepEqual(hiddenBytes(model.update({...base,shelled:noSuppression,pickArea:-1,highlightId:1}).pixels),hiddenBytes(privateBase.pixels),'highlight cannot affect hidden pixels');
  const publicOwner=new Int16Array(owner); publicOwner[hidden]=0;
  assert.notDeepEqual(visibleBytes(model.update({...base,owner:publicOwner,shelled:noSuppression,pickArea:-1,highlightId:-1}).pixels),visibleBytes(privateBase.pixels),'political ownership and its border remain intentionally public under fog');
  assert.deepEqual(first.pixels,held,'later composites must not mutate handed-off bytes');
  for(const [key,value] of Object.entries(before)) assert.equal(Buffer.from(base[key].buffer,base[key].byteOffset,base[key].byteLength).toString('hex'),value,`${key} input mutated`);
  model.reset(); assert.deepEqual(model.update(base).pixels,held,'reset/rebuild must be byte deterministic');
  const skip=model.update({...base}); assert.equal(skip.changed,false); assert(skip.diagnostics.cacheSkip>=2);

  assert.throws(()=>createTerrainRasterModel({pixelsPerTile:0}),/pixelsPerTile/);
  assert.throws(()=>createTerrainRasterModel({maxSourcePixels:Number.MAX_SAFE_INTEGER}),/source cap/);
  assert.throws(()=>createTerrainRasterModel({maxSourcePixels:10}).update({...base}),/allocation exceeds cap/);
  assert.throws(()=>model.update({...base,detailLevel:'cinematic'}),/dynamic input/);
  assert.throws(()=>model.update({...base,width:2049,land:new Uint8Array(2049*height)}),/dimensions/);
  assert(model.diagnostics().modelRasterRetainedBytes<=model.diagnostics().sourceBytes*2,'model-retained raster storage stays bounded to static plus model composite');
  console.log('Terrain F2 high-resolution deterministic cache and semantic fixture PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
