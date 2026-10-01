'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {fileURLToPath,pathToFileURL}=require('node:url');
const [,,outDir]=process.argv;
if(!outDir)throw new Error('Usage: node tools/build-howto.js <outdir>');

Promise.all(['help-contract.mjs','help-guide.mjs','help-art.mjs','help-release.mjs'].map(file=>import(pathToFileURL(path.resolve(__dirname,'..','game','src',file)).href))).then(([{HELP_SOURCE_ROOT,HELP_SOURCE_FILES,HELP_TABS},{renderHelpGuide},{HELP_ART},{assertHelpRelease}])=>{
  assertHelpRelease();
  const sourceRoot=fileURLToPath(HELP_SOURCE_ROOT);
  for(const relative of HELP_SOURCE_FILES){
    const target=path.resolve(outDir,relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const source=fs.readFileSync(path.join(sourceRoot,relative),'utf8');
    // Embedded portraits work in both the WordPress shortcode and standalone pages,
    // without leaking filesystem URLs or depending on a theme's asset base path.
    const html=source.replace(/<!-- HELP_PAGE:(\w+) -->/g,(_,tab)=>{
      const nav='<div class="sf-nav"><nav aria-label="How to play">'+HELP_TABS.map(([key,label])=>`<a href="${relative.includes('/')?'../'+key+'/':'./'+key+'.html'}"${tab===key?' aria-current="page"':''}>${label}</a>`).join(' · ')+'</nav></div>';
      return '<div class="sf-howto">'+renderHelpGuide(tab,{nav,resolveImage:key=>'data:image/webp;base64,'+fs.readFileSync(fileURLToPath(HELP_ART[key])).toString('base64'),loading:'lazy'})+'</div>';
    });
    fs.writeFileSync(target,html);
  }
  console.log('copied',HELP_TABS.length,'pages to',outDir);
}).catch(error=>{console.error(error);process.exitCode=1;});
