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
  const {helpRoster,renderHelpRoster}=await import(pathToFileURL(path.resolve(root,'../help-roster.mjs')).href);
  const {HELP_ART}=await import(pathToFileURL(path.resolve(root,'../help-art.mjs')).href);
  const {STRUCT,SHIPS}=await import(pathToFileURL(path.resolve(root,'../sim/rules.mjs')).href);
  for(const [tab,count] of [['build',25],['ships',11],['air',4]]){
    const cards=helpRoster(tab);assert.equal(cards.length,count);
    assert.equal(new Set(cards.map(c=>c.key)).size,count);
    for(const card of cards){
      assert.ok(card.use.length>70,`${card.key} missing practical guidance`);
      const image=fs.readFileSync(fileURLToPath(HELP_ART[card.key]));
      assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
    }
    const html=renderHelpRoster(tab,()=> 'portrait.png');
    assert.equal((html.match(/class="sf-unit-card"/g)||[]).length,count);
    assert.equal((html.match(/<strong>How to use<\/strong>/g)||[]).length,count);
    assert.doesNotMatch(html,/undefined|file:\/\//);
    assert.ok(fs.readFileSync(path.join(root,tab+'.html'),'utf8').includes(`<!-- HELP_PAGE:${tab} -->`));
  }
  for(const [key,s]of Object.entries(STRUCT))assert.ok(helpRoster('build').some(c=>c.key===key&&c.stats.includes(`${s.cost} gold`)),`missing building ${key}`);
  for(const [key,s]of Object.entries(SHIPS))assert.ok(helpRoster('ships').some(c=>c.key===key&&c.stats.includes(`${s.cost} gold`)),`missing ship ${key}`);
  const {renderHelpGuide}=await import(pathToFileURL(path.resolve(root,'../help-guide.mjs')).href);
  const {assertHelpRelease}=await import(pathToFileURL(path.resolve(root,'../help-release.mjs')).href);
  const {GAME_VERSION}=await import(pathToFileURL(path.resolve(root,'../config/build.js')).href);
  assert.doesNotThrow(()=>assertHelpRelease());
  assert.throws(()=>assertHelpRelease('future-version','future-build'),/Update the About/);
  for(const [tab]of contract.HELP_TABS){
    const html=renderHelpGuide(tab,{resolveImage:key=>{assert.ok(HELP_ART[key],key);return 'portrait.png';}});
    assert.doesNotMatch(html,/undefined|file:\/\/|<table|1\.10\.32/);
    assert.match(html,/<h2>/);
    assert.match(html,/<img /);
  }
  assert.match(renderHelpGuide('about'),new RegExp('data-release="'+GAME_VERSION.replaceAll('.','\\.')+'"'));
  for(const tool of ['build-howto.js','build-flags.js']){
    const source=fs.readFileSync(path.resolve(__dirname,'..','tools',tool),'utf8');
    assert.doesNotMatch(source,/\beval\s*\(|<script|styles\.css|legacy-game/);
  }
  console.log('Static help and release-tool module contracts PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
