'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {releaseZip,sha256}=require('./package-zip.js');
const metadata=require('./release-metadata.js');

const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const output=path.join(root,'.artifacts');

function walk(directory,prefix=''){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    return entry.isDirectory()?walk(path.join(directory,entry.name),relative):[{path:relative,data:fs.readFileSync(path.join(directory,entry.name))}];
  });
}

const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(packageJson.version!==metadata.version)throw new Error('Game module and package.json versions do not match.');
const release=JSON.parse(fs.readFileSync(path.join(dist,'release.json'),'utf8'));
const files=walk(dist).filter(file=>file.path!=='release.json');
const archive=releaseZip(files,{version:metadata.version,build:metadata.build,minimumPluginVersion:metadata.minimumPluginVersion,signingKeySha256:metadata.signingKeySha256,entry:'index.html',flags:'flags.js'},generated=>{
  if(JSON.stringify(generated)!==JSON.stringify(release))throw new Error('dist/release.json does not describe the exact build output.');
});
fs.mkdirSync(output,{recursive:true});
const target=path.join(output,`statefall-release-${metadata.version}.zip`);
fs.writeFileSync(target,archive);
fs.writeFileSync(path.join(output,'release-candidate.json'),JSON.stringify({version:metadata.version,build:metadata.build,filename:path.basename(target),sha256:sha256(archive)},null,2)+'\n');
console.log(`${path.relative(root,target)} sha256 ${sha256(archive)}`);
