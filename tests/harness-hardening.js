const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const boot=require('../tools/harness.js');

const gameFile=path.resolve(__dirname,'..','game','index.html');
const html=fs.readFileSync(gameFile,'utf8');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'statefall-harness-'));

function rejects(name,source,pattern){
  const file=path.join(dir,name+'.html');
  fs.writeFileSync(file,source);
  assert.throws(()=>boot({file,render:false}),pattern);
}

try{
  rejects('missing-anchor',html.replace("START.quick=$('quickStart').checked;",''),/Harness quick-start replacement: expected 1 occurrence, found 0/);
  rejects('duplicate-anchor',html.replace("function drawMap(){","function drawMap(){}\nfunction drawMap(){"),/Harness draw-map guard replacement: expected 1 occurrence, found 2/);
  rejects('duplicate-script',html.replace('</script>','</script>\n</script>'),/Harness game script closing tag: expected 1 occurrence, found 2/);
  assert.throws(()=>boot({file:gameFile,frenzy:true,render:false}),/Harness frenzy structure timing replacement: expected 2 occurrences, found 0/);
  console.log('Harness hardening checks PASS');
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
