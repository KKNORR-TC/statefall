'use strict';
const assert=require('node:assert/strict');

(async()=>{
  const {ATLAS_LIMITS,atlasBundleCategory,validateAtlasManifest}=await import('../game/src/rendering/atlas-manifest.mjs');
  const manifest={schema:'statefall-atlas/v1',version:1,id:'phase-g-test',source:{asset:'assets/test-atlas.png',mime:'image/png',width:8,height:4,bytes:128},frames:[{key:'red',x:0,y:0,width:4,height:4,scale:2,anchor:{x:.5,y:1}},{key:'blue',x:4,y:0,width:4,height:4,scale:1,anchor:{x:0,y:0}}]};
  const valid=validateAtlasManifest(manifest,{baseURL:'https://example.test/game/index.html'});
  assert.equal(valid.source.url,'https://example.test/game/assets/test-atlas.png'); assert.equal(valid.frames.length,2); assert(Object.isFrozen(valid.frames));
  const rejects=(mutate,category)=>{ const value=structuredClone(manifest); mutate(value); assert.throws(()=>validateAtlasManifest(value,{baseURL:'https://example.test/game/index.html'}),error=>error.category===category); };
  rejects(value=>value.version=2,'manifest-version'); rejects(value=>value.source.asset='../escape.png','asset-url'); rejects(value=>value.source.asset='/absolute.png','asset-url'); rejects(value=>value.source.asset='https://other.test/a.png','asset-url'); rejects(value=>value.frames[1].key='red','duplicate-frame-key'); rejects(value=>value.frames[1].x=3,'frame-overlap'); rejects(value=>value.frames[1].x=7,'frame-bounds'); rejects(value=>value.frames[0].x=.5,'manifest-schema'); rejects(value=>value.source.width=ATLAS_LIMITS.width+1,'dimension-cap'); rejects(value=>value.source.bytes=ATLAS_LIMITS.sourceBytes+1,'source-byte-cap'); rejects(value=>value.source.mime='image/svg+xml','source-mime');
  assert.equal(atlasBundleCategory('assets/units.atlas.json'),'atlas-manifest'); assert.equal(atlasBundleCategory('assets/units.webp'),'atlas-texture');
  console.log('Atlas manifest contract tests passed.');
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
