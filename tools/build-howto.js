// Extracts the How-to-play tabs from the game file into static HTML pages.
// Usage: node build-howto.js <index.html> <outdir>
const fs=require('fs'), path=require('path');
const [,, gameFile, outDir]=process.argv;
const html=fs.readFileSync(gameFile,'utf8');
const src=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
// minimal DOM/canvas stubs so icon and sprite generators produce data URLs
const { createCanvas } = (()=>{ try{ return require('canvas'); }catch(e){ return {createCanvas:null}; } })();
const stub=()=>new Proxy(function(){}, {get:(t,k)=>k==='length'?0:k==='checked'?false:k==='value'?'':(k===Symbol.toPrimitive?()=>800:stub()), set:()=>true, apply:()=>stub()});
function fakeCanvas(){ if(createCanvas){ const c=createCanvas(64,64); return c; } return {width:0,height:0,toDataURL:()=>'',getContext:()=>new Proxy({},{get:()=>()=>({data:new Uint8ClampedArray(4)})})}; }
global.document={querySelector:()=>stub(),getElementById:()=>stub(),createElement:(tag)=>tag==='canvas'?fakeCanvas():stub(),querySelectorAll:()=>[]};
global.window={addEventListener(){},innerWidth:1600,innerHeight:900,STATEFALL_WP:null};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}}; global.sessionStorage=global.localStorage;
global.requestAnimationFrame=()=>{}; global.performance={now:()=>0}; global.setInterval=()=>1; global.clearInterval=()=>{};
global.tip=stub(); global.ovTitle=stub(); global.ovText=stub(); global.overlay=stub(); global.ratio={value:50}; global.location={search:''};
global.crypto={subtle:{}};
let code=src.replace("$('startBtn').onclick=()=>{","var __start=()=>{")+"\nglobal.__HELP=HELP;";
eval(code);
const tabs=[['basics','Basics'],['build','Buildings'],['ships','Ships'],['air','Air'],['systems','Systems'],['garrisons','Garrisons'],['modes','Modes'],['about','About']];
fs.mkdirSync(outDir,{recursive:true});
const cssMatch=html.match(/\.ktable\{[^}]*\}[^]*?(?=\n\s*#help|\n\s*<\/style>)/); // pull the help styles
const helpCss=(html.match(/\.hcards\{[^]*?\}\s*\.hcard[^]*?\}\s*\.hcard img\{[^}]*\}\s*\.hcard \.t\{[^}]*\}\s*\.hcard \.m\{[^}]*\}\s*\.hcard \.d\{[^}]*\}/)||[''])[0];
const ktable=(html.match(/\.ktable\{[^}]*\}\s*\.ktable td\{[^}]*\}\s*\.ktable td:first-child\{[^}]*\}/)||[''])[0];
const nav=tabs.map(([k,n])=>`<a href="../${k}/">${n}</a>`).join(' · ');
for(const [k,n] of tabs){
  const body=__HELP[k]();
  const page=`<!-- generated from the game file; do not edit by hand -->\n<style>.sf-howto{--panel:#1a2634;--panel2:#22303f;--ink:#e8ecef;--muted:#8fa3b8;--gold:#ffd27a;color:var(--ink);font-family:"Segoe UI",system-ui,sans-serif;line-height:1.5}.sf-howto h3{margin:18px 0 6px;font-size:18px}.sf-howto p{margin:8px 0}.sf-howto .muted{color:var(--muted)}.sf-howto b{color:#fff}\n.sf-howto ${ktable.replace(/\.ktable/g,'.ktable')}\n.sf-howto ${helpCss.replace(/\.hcards/g,'.hcards')}\n.sf-howto .sf-nav{font-size:13px;color:var(--muted);margin:0 0 14px}.sf-howto .sf-nav a{color:#7fb3ff;text-decoration:none}.sf-howto .sf-nav a:hover{text-decoration:underline}</style>\n<div class="sf-howto"><div class="sf-nav">How to play: ${nav}</div>\n${body}\n</div>`;
  fs.mkdirSync(path.join(outDir,k),{recursive:true});
  fs.writeFileSync(path.join(outDir,k,'index.html'),page);
  fs.writeFileSync(path.join(outDir,k+'.html'),page);
}
fs.writeFileSync(path.join(outDir,'tabs.json'),JSON.stringify(tabs));
console.log('wrote',tabs.length,'pages to',outDir);
