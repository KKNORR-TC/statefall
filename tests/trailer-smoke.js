'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'.artifacts'),captureDist=path.join(artifacts,'trailer-dist'),outputRoot=path.join(artifacts,'trailer-smoke'),productionDist=path.join(root,'dist');
const toolNames=['trailer-capture.js','trailer.js','trailer2.js'];

function snapshot(directory){
  if(!fs.existsSync(directory))return null;
  const result={};
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())Object.assign(result,Object.fromEntries(Object.entries(snapshot(file)).map(([name,value])=>[`${entry.name}/${name}`,value])));
    else result[entry.name]=fs.readFileSync(file).toString('base64');
  }
  return result;
}

function jpegSize(data){
  assert.equal(data[0],0xff);assert.equal(data[1],0xd8);
  let offset=2;
  while(offset+9<data.length){
    if(data[offset]!==0xff){offset++;continue;}
    const marker=data[offset+1],length=data.readUInt16BE(offset+2);
    if(marker>=0xc0&&marker<=0xc3)return {height:data.readUInt16BE(offset+5),width:data.readUInt16BE(offset+7)};
    offset+=2+length;
  }
  throw new Error('JPEG dimensions not found');
}

try{
  const productionBefore=snapshot(productionDist);
  const build=spawnSync(process.platform==='win32'?process.env.ComSpec||'cmd.exe':'npm',process.platform==='win32'?['/d','/s','/c','npm run build:trailer']:['run','build:trailer'],{cwd:root,encoding:'utf8'});
  assert.equal(build.status,0,`capture build failed:\n${build.stdout}\n${build.stderr}`);
  assert.ok(fs.existsSync(path.join(captureDist,'index.html')),'capture build did not emit .artifacts/trailer-dist/index.html');
  assert.deepEqual(snapshot(productionDist),productionBefore,'capture build or trailer smoke changed production dist');
  for(const tool of ['build-release.js','finalize-game-build.js']){
    assert.doesNotMatch(fs.readFileSync(path.join(root,'tools',tool),'utf8'),/trailer-dist|CAPTURE_DIST/,`${tool} must not inspect capture output`);
  }
  for(const tool of toolNames){
    const source=fs.readFileSync(path.join(root,'tools',tool),'utf8');
    assert.doesNotMatch(source,/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/,`${tool} must not evaluate source text`);
  }
  for(const name of ['trailer','trailer2']){
    const output=path.join(outputRoot,name),result=spawnSync(process.execPath,[path.join(root,'tools',`${name}.js`),'--smoke'],{cwd:root,env:{...process.env,OUT:output},encoding:'utf8'});
    assert.equal(result.status,0,`${name} smoke failed:\n${result.stdout}\n${result.stderr}`);
    const files=fs.readdirSync(output);
    assert.deepEqual(files,['f00000.jpg']);
    const data=fs.readFileSync(path.join(output,files[0])),size=jpegSize(data);
    assert.ok(data.length>5_000,`${name} image is unexpectedly small`);
    assert.deepEqual(size,{width:1280,height:720});
  }
  assert.deepEqual(snapshot(productionDist),productionBefore,'trailer smoke changed production dist');
  console.log('Trailer browser capture smoke PASS');
}finally{fs.rmSync(outputRoot,{recursive:true,force:true});}
