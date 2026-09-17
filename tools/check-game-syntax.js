const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),childProcess=require('node:child_process');

const root=path.resolve(__dirname,'..');
const file=path.join(root,'game','index.html');
const html=fs.readFileSync(file,'utf8');
if(!/<script type="module" src="\.\/src\/main\.js"><\/script>/.test(html))throw new Error('Game module entry is missing.');
for(const marker of ['GAME_VERSION','GAME_BUILD','REQUIRES_PLUGIN','__STATEFALL_ASSET_BASE__'])if(!html.includes(marker))throw new Error(`Game HTML is missing ${marker}.`);

function jsFiles(dir){
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) files.push(...jsFiles(full));
    else if(entry.isFile()&&/\.(?:cjs|mjs|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files=[...jsFiles(path.join(root,'game','src')),...jsFiles(path.join(root,'tools')),...jsFiles(path.join(root,'tests'))].sort();
for(const script of files){
  const result=childProcess.spawnSync(process.execPath,['--check',script],{encoding:'utf8'});
  if(result.error) throw result.error;
  if(result.status!==0){
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`Syntax check failed for ${path.relative(root,script)}`);
  }
}
console.log(`Syntax OK: module entry and ${files.length} source/tool/test files`);
