const {defineConfig}=require('vite');const path=require('path');module.exports=defineConfig({root:path.resolve(__dirname,'../..'),server:{host:'127.0.0.1',port:4182,strictPort:true}});
