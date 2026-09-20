'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const net=require('node:net');
const path=require('node:path');
const zlib=require('node:zlib');
const {spawnSync}=require('node:child_process');
const {createSourceEvidence,verifyReport}=require('./source-evidence-manifest');

const root=path.resolve(__dirname,'..');
const output=path.resolve(root,process.env.STATEFALL_MATRIX_OUTPUT||'docs/evidence/phase-e-browser-matrix.json');
const rawOutput=path.resolve(root,'.artifacts/phase-e-browser-matrix-playwright.json');
const retainedRawOutput=path.resolve(root,'docs/evidence/phase-e-browser-matrix.raw.json.gz');
const projects=['chromium-desktop','firefox-desktop','webkit-desktop','chromium-mobile','webkit-mobile','chromium-reduced-motion','chromium-source-contract','chromium-built-contract','chromium-desktop-scale-1','chromium-desktop-scale-1.5','chromium-desktop-scale-2'];
const playwrightArgs=['playwright','test',...projects.map(value=>`--project=${value}`),'--workers=1','--reporter=json'];
const command=`npx ${playwrightArgs.join(' ')}`;
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

function portAvailable(port){
  return new Promise(resolve=>{ const server=net.createServer(); server.once('error',()=>resolve(false)); server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true))); });
}

function collectTests(suites,values=[]){
  for(const suite of suites||[]){
    for(const spec of suite.specs||[]) for(const test of spec.tests||[]) values.push({project:test.projectName,status:test.status,expectedStatus:test.expectedStatus,results:(test.results||[]).map(value=>({status:value.status,duration:value.duration||0,retry:value.retry||0}))});
    collectTests(suite.suites,values);
  }
  return values;
}

function classify(test){
  const last=test.results.at(-1)?.status;
  if(test.status==='expected'&&last==='passed') return 'passed';
  if(test.status==='skipped'||last==='skipped') return 'skipped';
  if(test.status==='flaky') return 'flaky';
  return 'failed';
}

function run(command_,args,options={}){
  const result=spawnSync(command_,args,{cwd:root,encoding:'utf8',stdio:options.capture?'pipe':'inherit',shell:process.platform==='win32',...options.env&&{env:options.env}});
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error(`${command_} ${args.join(' ')} failed with exit code ${result.status}${result.stderr?`\n${result.stderr}`:''}`);
  return result;
}

async function main(){
  const verifyIndex=process.argv.indexOf('--verify-report');
  if(verifyIndex>=0){ const reportPath=path.resolve(root,process.argv[verifyIndex+1]||path.relative(root,output)); verifyReport(root,reportPath); console.log(`Verified ${path.relative(root,reportPath)} against current executable source.`); return; }
  if(!(await portAvailable(4173))||!(await portAvailable(4174))) throw new Error('Matrix isolation failed: ports 4173/4174 are already in use');
  fs.mkdirSync(path.dirname(rawOutput),{recursive:true});
  fs.mkdirSync(path.dirname(output),{recursive:true});
  run('npm',['run','build:game']);
  const started=Date.now(),result=run('npx',playwrightArgs,{capture:true,env:{...process.env,PLAYWRIGHT_JSON_OUTPUT_NAME:rawOutput}}),ended=Date.now();
  if(result.stdout?.trim()&&!fs.existsSync(rawOutput)) fs.writeFileSync(rawOutput,result.stdout);
  const raw=fs.readFileSync(rawOutput),playwright=JSON.parse(raw),tests=collectTests(playwright.suites),counts={total:tests.length,passed:0,skipped:0,failed:0,flaky:0,interrupted:0,timedOut:0};
  for(const test of tests){
    counts[classify(test)]++;
    if(test.results.at(-1)?.status==='interrupted') counts.interrupted++;
    if(test.results.at(-1)?.status==='timedOut') counts.timedOut++;
  }
  const perProject=Object.fromEntries(projects.map(project=>{ const selected=tests.filter(value=>value.project===project),value={total:selected.length,passed:0,skipped:0,failed:0,flaky:0,interrupted:0,timedOut:0,durationMs:0}; for(const test of selected){ value[classify(test)]++; value.interrupted+=test.results.at(-1)?.status==='interrupted'?1:0; value.timedOut+=test.results.at(-1)?.status==='timedOut'?1:0; value.durationMs+=test.results.reduce((sum,item)=>sum+(item.duration||0),0); } return [project,value]; }));
  const compressed=zlib.gzipSync(raw,{level:9,mtime:0}); fs.writeFileSync(retainedRawOutput,compressed);
  const report={schema:2,type:'phase-e-browser-matrix',generatedAt:new Date(ended).toISOString(),source:createSourceEvidence(root),isolation:{ports:[4173,4174],portsFreeBeforeRun:true,reuseExistingServer:false,freshPlaywrightWorkers:true},command,precommand:'npm run build:game',projects,workers:1,timeoutBudgetMs:1800000,startedAt:new Date(started).toISOString(),endedAt:new Date(ended).toISOString(),durationMs:ended-started,playwrightStats:playwright.stats,counts,perProject,zeroFailures:counts.failed===0&&counts.flaky===0&&counts.interrupted===0&&counts.timedOut===0,rawReport:{format:'playwright-json-gzip',path:'docs/evidence/phase-e-browser-matrix.raw.json.gz',compressedBytes:compressed.length,uncompressedBytes:raw.length,compressedSha256:sha256(compressed),uncompressedSha256:sha256(raw)},passed:false};
  report.passed=report.zeroFailures&&report.counts.total===report.counts.passed+report.counts.skipped&&report.projects.every(value=>report.perProject[value]?.total>0);
  fs.writeFileSync(output,`${JSON.stringify(report,null,2)}\n`);
  console.log(`Matrix: ${counts.passed} passed, ${counts.skipped} skipped, ${counts.failed} failed in ${(report.durationMs/1000).toFixed(3)} s`);
  console.log(`Report: ${path.relative(root,output)}`);
  if(!report.passed) throw new Error('The complete Phase E browser matrix did not pass cleanly');
}

if(require.main===module) main().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
module.exports={collectTests};
