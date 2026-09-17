'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const childProcess=require('node:child_process');
const root=path.resolve(__dirname,'..');

function snapshot(directory,prefix=''){
  const result={};
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const relative=prefix?`${prefix}/${entry.name}`:entry.name,full=path.join(directory,entry.name);
    if(entry.isDirectory())Object.assign(result,snapshot(full,relative));
    else result[relative]=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  }
  return result;
}

function build(){
  if(process.platform==='win32')childProcess.execFileSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c','npm run build:game'],{cwd:root,stdio:'inherit'});
  else childProcess.execFileSync('npm',['run','build:game'],{cwd:root,stdio:'inherit'});
  return snapshot(path.join(root,'dist'));
}
const first=build(),second=build();
assert.deepEqual(second,first,'Two clean Vite release builds differ');
console.log(`Build reproducibility PASS (${Object.keys(first).length} files)`);
