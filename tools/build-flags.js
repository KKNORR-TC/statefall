// Extracts the flag table and drawing routines from the game into a standalone flags.js for the website.
const fs=require('fs'); const [,, gameFile, outFile]=process.argv;
const html=fs.readFileSync(gameFile,'utf8'); const src=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
function grabLine(prefix){ const i=src.indexOf(prefix); if(i<0) throw new Error('missing '+prefix); const j=src.indexOf('\n',i); return src.slice(i,j); }
function balanced(start){ let depth=0,inStr=null,k=start; for(;k<src.length;k++){ const ch=src[k]; if(!inStr&&ch==='/'&&src[k+1]==='/'){ k=src.indexOf('\n',k); continue; } if(inStr){ if(ch==='\\'){ k++; continue; } if(ch===inStr) inStr=null; continue; } if(ch==="'"||ch==='"'||ch==='`'){ inStr=ch; continue; } if(ch==='['||ch==='{'||ch==='(') depth++; else if(ch===']'||ch==='}'||ch===')'){ depth--; if(depth===0) return k; } } throw new Error('unbalanced from '+start); }
function grabFunc(name){ const i=src.indexOf('\nfunction '+name+'('); if(i<0) throw new Error('missing fn '+name); const open=src.indexOf('{',src.indexOf(')',i)); const end=balanced(open); return src.slice(i+1,end+1); }
function grabConst(name){ const i=src.indexOf('\nconst '+name+'='); if(i<0) throw new Error('missing const '+name); // bracket-balanced statement
  let depth=0,inStr=null,k=i+1; for(;k<src.length;k++){ const ch=src[k]; if(!inStr&&ch==='/'&&src[k+1]==='/'){ k=src.indexOf('\n',k); continue; } if(inStr){ if(ch==='\\'){ k++; continue; } if(ch===inStr) inStr=null; continue; } if(ch==="'"||ch==='"'||ch==='`'){ inStr=ch; continue; } if(ch==='['||ch==='{'||ch==='(') depth++; else if(ch===']'||ch==='}'||ch===')'){ depth--; if(depth===0){ const semi=src.indexOf(';',k); return src.slice(i+1,semi+1); } } } throw new Error('unterminated '+name); }
const parts=[];
parts.push('// Statefall flags — generated from the game file; do not edit by hand.');
parts.push(grabLine("const R='#d52b1e',Wt='#ffffff'"));
parts.push(grabConst('COUNTRIES'));
parts.push(grabConst('EMBLEMS'));
parts.push(grabConst('EMBLEM_LABEL'));
parts.push(grabFunc('drawEmblem'));
parts.push(grabFunc('drawFlag'));
parts.push("function countryByIdx(i){ return {name:COUNTRIES[i][0],layers:COUNTRIES[i].slice(1),idx:i}; }");
parts.push("function flagByName(n){ const i=COUNTRIES.findIndex(c=>c[0]===n); return i>=0?countryByIdx(i):null; }");
parts.push(`// Render every [data-sf-flag] element on the page: data-sf-flag is a country name or a JSON {name,layers}; data-w/data-h size.
function statefallRenderFlags(root){ (root||document).querySelectorAll('[data-sf-flag]').forEach(el=>{ if(el.dataset.done) return; let f=null; const v=el.dataset.sfFlag; try{ f=v[0]==='{'?JSON.parse(v):flagByName(v); }catch(e){} if(!f||!f.layers) return; const w=+el.dataset.w||36,h=+el.dataset.h||24; const c=document.createElement('canvas'); c.width=w*2; c.height=h*2; c.style.width=w+'px'; c.style.height=h+'px'; c.style.verticalAlign='middle'; c.style.borderRadius='2px'; c.style.boxShadow='0 0 0 1px rgba(255,255,255,.25)'; const x=c.getContext('2d'); x.scale(2,2); drawFlag(x,f,0,0,w,h); el.innerHTML=''; el.appendChild(c); el.dataset.done='1'; }); }
if(typeof document!=='undefined'){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>statefallRenderFlags()); else statefallRenderFlags(); }
if(typeof module!=='undefined') module.exports={COUNTRIES,EMBLEMS,EMBLEM_LABEL,drawFlag,drawEmblem,countryByIdx,flagByName};`);
fs.writeFileSync(outFile,parts.join('\n\n')); console.log('flags.js',fs.statSync(outFile).size,'bytes');
