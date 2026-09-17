'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {fileURLToPath,pathToFileURL}=require('node:url');
const [,,outDir]=process.argv;
if(!outDir)throw new Error('Usage: node tools/build-howto.js <outdir>');

import(pathToFileURL(path.resolve(__dirname,'..','game','src','help-contract.mjs')).href).then(({HELP_SOURCE_ROOT,HELP_SOURCE_FILES,HELP_TABS})=>{
  const sourceRoot=fileURLToPath(HELP_SOURCE_ROOT);
  for(const relative of HELP_SOURCE_FILES){
    const target=path.resolve(outDir,relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(sourceRoot,relative),target);
  }
  console.log('copied',HELP_TABS.length,'pages to',outDir);
}).catch(error=>{console.error(error);process.exitCode=1;});
