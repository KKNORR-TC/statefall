const {defineConfig}=require('vite');
const path=require('node:path');

module.exports=defineConfig(({command})=>({
  root:path.resolve(__dirname,'game'),
  base:command==='build'?'/__STATEFALL_ASSET_BASE__/':'/',
  define:{__STATEFALL_TEST_BRIDGE__:command==='serve'},
  build:{
    outDir:path.resolve(__dirname,'dist'),
    emptyOutDir:true,
    assetsDir:'assets',
    rollupOptions:{output:{entryFileNames:'assets/[name].[hash].js',chunkFileNames:'assets/[name].[hash].js',assetFileNames:'assets/[name].[hash][extname]'}}
  }
}));
