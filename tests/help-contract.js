'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fileURLToPath,pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
  const contract=await import(pathToFileURL(path.resolve(__dirname,'..','game','src','help-contract.mjs')).href);
  const root=fileURLToPath(contract.HELP_SOURCE_ROOT);
  assert.equal(contract.HELP_TABS.length,8);
  for(const relative of contract.HELP_SOURCE_FILES)assert.ok(fs.statSync(path.join(root,relative)).isFile(),`missing help source ${relative}`);
  for(const [key] of contract.HELP_TABS)assert.equal(fs.readFileSync(path.join(root,`${key}.html`),'utf8'),fs.readFileSync(path.join(root,key,'index.html'),'utf8'),`${key} help variants differ`);
  assert.match(fs.readFileSync(path.join(root,'about.html'),'utf8'),/<b>Version 1\.10\.30<\/b> · build 2026-09-19-phase-e-complete/);
  for(const tool of ['build-howto.js','build-flags.js']){
    const source=fs.readFileSync(path.resolve(__dirname,'..','tools',tool),'utf8');
    assert.doesNotMatch(source,/\beval\s*\(|<script|styles\.css|legacy-game/);
  }
  console.log('Static help and release-tool module contracts PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
