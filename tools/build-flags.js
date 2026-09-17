'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const [,,outFile]=process.argv;
if(!outFile) throw new Error('Usage: node tools/build-flags.js <outfile>');
const browser=`
function countryByIdx(i){return {name:COUNTRIES[i][0],layers:COUNTRIES[i].slice(1),idx:i};}
function flagByName(name){const i=COUNTRIES.findIndex(country=>country[0]===name);return i>=0?countryByIdx(i):null;}
function statefallRenderFlags(root){(root||document).querySelectorAll('[data-sf-flag]').forEach(element=>{if(element.dataset.done)return;let flag=null;const value=element.dataset.sfFlag;try{flag=value[0]==='{'?JSON.parse(value):flagByName(value);}catch{}if(!flag||!flag.layers)return;const width=+element.dataset.w||36,height=+element.dataset.h||24,canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;canvas.style.width=width+'px';canvas.style.height=height+'px';canvas.style.verticalAlign='middle';canvas.style.borderRadius='2px';canvas.style.boxShadow='0 0 0 1px rgba(255,255,255,.25)';const context=canvas.getContext('2d');context.scale(2,2);drawFlag(context,flag,0,0,width,height);element.replaceChildren(canvas);element.dataset.done='1';});}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>statefallRenderFlags());else statefallRenderFlags();}
if(typeof module!=='undefined')module.exports={COUNTRIES,EMBLEMS,EMBLEM_LABEL,drawFlag,drawEmblem,countryByIdx,flagByName};
`;
fs.mkdirSync(path.dirname(path.resolve(outFile)),{recursive:true});
import(pathToFileURL(path.resolve(__dirname,'..','game','src','config','flags.mjs')).href).then(({standaloneFlagsSource})=>{
  fs.writeFileSync(outFile,'// Statefall flags - generated from source modules; do not edit.\n'+standaloneFlagsSource()+browser);
  console.log('flags.js',fs.statSync(outFile).size,'bytes');
}).catch(error=>{console.error(error);process.exitCode=1;});
