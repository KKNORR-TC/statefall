const {defineConfig}=require('vite');
const path=require('node:path');
const {localScoreMiddleware}=require('./tools/local-score-middleware.cjs');

module.exports=defineConfig(({command,mode})=>({
  root:path.resolve(__dirname,'game'),
  plugins:[{name:'local-original-score',configureServer(server){server.middlewares.use(localScoreMiddleware);},configurePreviewServer(server){server.middlewares.use(localScoreMiddleware);}}],
  base:command==='build'?'/__STATEFALL_ASSET_BASE__/':'/',
  // JavaScript and worker imports must remain relative inside immutable WordPress releases.
  experimental:{renderBuiltUrl:(_filename,{hostType})=>hostType==='js'?{relative:true}:undefined},
  define:{
    __STATEFALL_TEST_BRIDGE__:command==='serve'||mode==='capture',
    __STATEFALL_DEV_RENDERERS__:command==='serve'||mode==='capture'
  },
  resolve:{alias:command==='build'&&mode!=='capture'?[{find:/\.\/renderer-factory\.mjs$/,replacement:path.resolve(__dirname,'game/src/rendering/renderer-factory-production.mjs')}]:[]},
  worker:{rollupOptions:{output:{assetFileNames:'assets/[name].[hash][extname]'}}},
  build:{
    outDir:path.resolve(__dirname,mode==='capture'?'.artifacts/trailer-dist':'dist'),
    emptyOutDir:true,
    assetsDir:'assets',
    // Shared startup/battlefield data must stay out of the entry to avoid circular asset hashes.
    rollupOptions:{output:{manualChunks:id=>id.includes('vite/preload-helper')?'module-preload':id.endsWith('/classic-assets/directional-metadata.json')?'unit-art-metadata':undefined,entryFileNames:'assets/[name].[hash].js',chunkFileNames:'assets/[name].[hash].js',assetFileNames:'assets/[name].[hash][extname]'}}
  }
}));
