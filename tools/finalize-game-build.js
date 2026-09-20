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
const assetDir=path.join(dist,'assets'),assets=fs.readdirSync(assetDir).filter(file=>/\.(?:js|css)$/.test(file)).map(file=>({file,data:fs.readFileSync(path.join(assetDir,file))}));
let renames=new Map(assets.map(({file})=>[file,file]));
for(let pass=0;pass<=assets.length;pass++){
  const next=new Map();
  for(const asset of assets){
    let data=asset.data.toString('utf8').replaceAll('/__STATEFALL_ASSET_BASE__/assets/','./');
    for(const [source,target] of renames) data=data.replaceAll(source,target);
    const extension=path.extname(asset.file),stem=path.basename(asset.file,extension).split('.')[0];
    next.set(asset.file,`${stem}.${sha256(Buffer.from(data)).slice(0,12)}${extension}`);
  }
  if(Array.from(next).every(([source,target])=>renames.get(source)===target)){renames=next;break;}
  if(pass===assets.length)throw new Error('Asset fingerprint references did not converge.');
  renames=next;
}
for(const asset of assets){
  let data=asset.data.toString('utf8').replaceAll('/__STATEFALL_ASSET_BASE__/assets/','./');
  for(const [source,target] of renames) data=data.replaceAll(source,target);
  fs.writeFileSync(path.join(assetDir,renames.get(asset.file)),data);
  if(renames.get(asset.file)!==asset.file)fs.unlinkSync(path.join(assetDir,asset.file));
  html=html.replaceAll(`assets/${asset.file}`,`assets/${renames.get(asset.file)}`);
}
const builtBase='/__STATEFALL_ASSET_BASE__/';
if(!html.includes(builtBase))throw new Error('Vite output is missing the controlled asset base.');
fs.writeFileSync(entry,html.replaceAll(builtBase,'__STATEFALL_ASSET_BASE__'));
fs.writeFileSync(path.join(dist,'VERSION.txt'),`${metadata.version} build ${metadata.build}\n`);
const initial=walk(dist).filter(file=>file.path!=='release.json'&&file.path!=='bundle-report.json');
const report={schema:1,files:initial.filter(file=>/\.(?:js|css)$/.test(file.path)).map(file=>({path:file.path,bytes:file.data.length,gzipBytes:require('node:zlib').gzipSync(file.data,{level:9,mtime:0}).length})),assetCategories:{atlasManifests:initial.filter(file=>/\.atlas\.json$/i.test(file.path)).map(file=>({path:file.path,bytes:file.data.length})),atlasTextures:initial.filter(file=>/\.(?:png|webp)$/i.test(file.path)&&!file.path.includes('howto/')).map(file=>({path:file.path,bytes:file.data.length})),fonts:initial.filter(file=>/\.(?:woff2?|ttf|otf)$/i.test(file.path)).map(file=>({path:file.path,bytes:file.data.length})),audio:initial.filter(file=>/\.(?:mp3|ogg|wav|m4a)$/i.test(file.path)).map(file=>({path:file.path,bytes:file.data.length}))},productionJsInventory:initial.filter(file=>/\.js$/.test(file.path)).map(file=>({path:file.path,sha256:sha256(file.data),scanned:true}))};
fs.writeFileSync(path.join(dist,'bundle-report.json'),JSON.stringify(report,null,2)+'\n');
const files=walk(dist).filter(file=>file.path!=='release.json').sort((a,b)=>a.path.localeCompare(b.path));
const release=manifest(metadata.version,metadata.build,metadata.minimumPluginVersion,metadata.signingKeySha256,files,'index.html','flags.js');
fs.writeFileSync(path.join(dist,'release.json'),JSON.stringify(release,null,2)+'\n');
console.log(`dist/release.json ${release.files.length} files sha256 ${sha256(Buffer.from(JSON.stringify(release,null,2)+'\n'))}`);
