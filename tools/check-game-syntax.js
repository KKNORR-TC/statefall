const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),childProcess=require('node:child_process');

const root=path.resolve(__dirname,'..');
const file=path.join(root,'game','index.html');
const html=fs.readFileSync(file,'utf8');
const open='<script>',close='</script>';
const openCount=html.split(open).length-1,closeCount=html.split(close).length-1;
if(openCount!==1||closeCount!==1) throw new Error(`Expected exactly one game script in ${file}; found ${openCount} opening and ${closeCount} closing tags`);
const start=html.indexOf(open),end=html.indexOf(close);
if(end<=start) throw new Error('Game script tags are out of order in '+file);
new vm.Script(html.slice(start+8,end),{filename:file});

function jsFiles(dir){
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) files.push(...jsFiles(full));
    else if(entry.isFile()&&/\.(?:cjs|mjs|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files=[...jsFiles(path.join(root,'tools')),...jsFiles(path.join(root,'tests'))].sort();
for(const script of files){
  const result=childProcess.spawnSync(process.execPath,['--check',script],{encoding:'utf8'});
  if(result.error) throw result.error;
  if(result.status!==0){
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`Syntax check failed for ${path.relative(root,script)}`);
  }
}
console.log(`Syntax OK: game script and ${files.length} tool/test files`);
