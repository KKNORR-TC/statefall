'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {manifest,sha256}=require('./package-zip.js');

const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const metadata=require('./release-metadata.js');

function walk(directory,prefix=''){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    return entry.isDirectory()?walk(path.join(directory,entry.name),relative):[{path:relative,data:fs.readFileSync(path.join(directory,entry.name))}];
  });
}

const entry=path.join(dist,'index.html');
let html=fs.readFileSync(entry,'utf8');
const emitted=walk(dist);
const forbiddenProductionJs=/(?:@pixi|pixi\.js|pixi-world|pixiInit|createPixiHybridRenderer|world-raster|planned-entities|unsupported-renderer|development-renderer-disabled|__STATEFALL_(?:TEST(?:_[A-Z]+)?|DEV_RENDERERS)__)/i;
for(const file of emitted){
  if(/\.(?:html|js|css|json|txt)$/.test(file.path)&&/__STATEFALL_TEST(?:_[A-Z]+)?__/.test(file.data.toString('utf8'))){
    throw new Error(`Production dist contains capture bridge marker: ${file.path}`);
  }
  const productionText=file.data.toString('utf8'),guardText=productionText.replaceAll(metadata.build,'');
  if(/\.js$/.test(file.path)&&forbiddenProductionJs.test(guardText)){
    throw new Error(`Production JavaScript contains Pixi, renderer-switch, or test-bridge code: ${file.path}`);
  }
}
for(const file of fs.readdirSync(path.join(dist,'assets'))){
  if(!/\.(?:js|css)$/.test(file))continue;
  const source=path.join(dist,'assets',file),data=fs.readFileSync(source);
  const extension=path.extname(file),stem=path.basename(file,extension).split('.')[0];
  const renamed=`${stem}.${sha256(data).slice(0,12)}${extension}`;
  if(renamed!==file){fs.renameSync(source,path.join(dist,'assets',renamed));html=html.replaceAll(`assets/${file}`,`assets/${renamed}`);}
}
const builtBase='/__STATEFALL_ASSET_BASE__/';
if(!html.includes(builtBase))throw new Error('Vite output is missing the controlled asset base.');
fs.writeFileSync(entry,html.replaceAll(builtBase,'__STATEFALL_ASSET_BASE__'));
fs.writeFileSync(path.join(dist,'VERSION.txt'),`${metadata.version} build ${metadata.build}\n`);
const initial=walk(dist).filter(file=>file.path!=='release.json'&&file.path!=='bundle-report.json');
const report={schema:1,files:initial.filter(file=>/\.(?:js|css)$/.test(file.path)).map(file=>({path:file.path,bytes:file.data.length,gzipBytes:require('node:zlib').gzipSync(file.data,{level:9,mtime:0}).length})),productionJsInventory:initial.filter(file=>/\.js$/.test(file.path)).map(file=>({path:file.path,sha256:sha256(file.data),scanned:true}))};
fs.writeFileSync(path.join(dist,'bundle-report.json'),JSON.stringify(report,null,2)+'\n');
const files=walk(dist).filter(file=>file.path!=='release.json').sort((a,b)=>a.path.localeCompare(b.path));
const release=manifest(metadata.version,metadata.build,metadata.minimumPluginVersion,metadata.signingKeySha256,files,'index.html','flags.js');
fs.writeFileSync(path.join(dist,'release.json'),JSON.stringify(release,null,2)+'\n');
console.log(`dist/release.json ${release.files.length} files sha256 ${sha256(Buffer.from(JSON.stringify(release,null,2)+'\n'))}`);
