'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const {MINIMUM_FRAMES,MINIMUM_DURATION_MS,STABLE_WINDOW_START_MS,MINIMUM_STABLE_SAMPLES,MINIMUM_STABLE_DURATION_MS,STABLE_COLLECTION_TARGET_MS,REQUIRED_BROWSERS,REQUIRED_LAYERS,CPU_P95_MAXIMUM_MS,CPU_P99_MAXIMUM_MS,PLATEAU_EXCLUDED_PATHS}=require('./phase-e-qualification-contract');

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const git=(root,args,options={})=>execFileSync('git',args,{cwd:root,...options});
const relevant=relative=>{
  const value=relative.replaceAll('\\','/');
  if(value.startsWith('node_modules/')||value.startsWith('dist/')||value.startsWith('.artifacts/')||value.startsWith('docs/evidence/')) return false;
  return value.startsWith('game/')||value.startsWith('tests/')||value.startsWith('tools/')||value.startsWith('prototypes/')||/^(?:package(?:-lock)?\.json|vite\.config\.js|playwright(?:\.wordpress)?\.config\.js)$/.test(value);
};
const candidateRelevant=relative=>{
  const value=relative.replaceAll('\\','/');
  if(value.startsWith('node_modules/')||value.startsWith('dist/')||value.startsWith('.artifacts/')||value.startsWith('docs/evidence/phase-e-')) return false;
  return value.startsWith('game/')||value.startsWith('tests/')||value.startsWith('tools/')||value.startsWith('prototypes/')||value.startsWith('docs/')||/^(?:README\.md|CHANGELOG\.md|package(?:-lock)?\.json|vite\.config\.js|playwright(?:\.wordpress)?\.config\.js|\.gitignore)$/.test(value);
};

function sourceFiles(root,predicate){
  const listed=git(root,['ls-files','--cached','--others','--exclude-standard','-z']).toString('utf8').split('\0').filter(Boolean).filter(predicate).sort((a,b)=>a.localeCompare(b,'en'));
  const files=listed.map(relative=>({path:relative.replaceAll('\\','/'),sha256:sha256(fs.readFileSync(path.join(root,relative)))}));
  const manifestText=files.map(value=>`${value.path}\0${value.sha256}\n`).join('');
  return {files,manifestSha256:sha256(manifestText)};
}

function createSourceEvidence(root){
  const {files,manifestSha256}=sourceFiles(root,relevant);
  const pathspec=['game','tests','tools','prototypes','package.json','package-lock.json','vite.config.js','playwright.config.js','playwright.wordpress.config.js'];
  const status=git(root,['status','--porcelain=v1','--untracked-files=all','--',...pathspec],{encoding:'utf8'}).replaceAll('\r\n','\n');
  const diff=git(root,['diff','--binary','HEAD','--',...pathspec]);
  const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const buildSource=fs.readFileSync(path.join(root,'game/src/config/build.js'),'utf8');
  return {algorithm:'sha256',manifestSha256,fileCount:files.length,files,head:git(root,['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!status,dirtyStatus:status.trim().split('\n').filter(Boolean),dirtyStatusSha256:sha256(status),dirtyDiffSha256:sha256(diff),version:packageJson.version,build:(buildSource.match(/GAME_BUILD='([^']+)'/)||[])[1]||null};
}

function createCandidateSourceEvidence(root){
  const {files,manifestSha256}=sourceFiles(root,candidateRelevant),packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),buildSource=fs.readFileSync(path.join(root,'game/src/config/build.js'),'utf8');
  return {algorithm:'sha256',manifestSha256,fileCount:files.length,files,head:git(root,['rev-parse','HEAD'],{encoding:'utf8'}).trim(),version:packageJson.version,build:(buildSource.match(/GAME_BUILD='([^']+)'/)||[])[1]||null};
}

function verifyCandidateSourceEvidence(root,recorded){
  if(!recorded) throw new Error('Review manifest has no candidate source evidence');
  const current=createCandidateSourceEvidence(root);
  for(const key of ['algorithm','manifestSha256','fileCount','head','version','build']) if(recorded[key]!==current[key]) throw new Error(`Candidate source mismatch for ${key}: recorded ${recorded[key]}, current ${current[key]}`);
  if(JSON.stringify(recorded.files)!==JSON.stringify(current.files)) throw new Error('Candidate source path/hash list differs from current source');
  return current;
}

function verifyReport(root,reportPath){
  const report=JSON.parse(fs.readFileSync(reportPath,'utf8')),current=createSourceEvidence(root),recorded=report.source;
  if(!recorded) throw new Error('Report has no source evidence');
  for(const key of ['manifestSha256','head','dirtyStatusSha256','dirtyDiffSha256','version','build']) if(recorded[key]!==current[key]) throw new Error(`Report source mismatch for ${key}: recorded ${recorded[key]}, current ${current[key]}`);
  if(report.type==='phase-e-browser-matrix') verifyMatrixReport(root,report);
  else verifyHardwareReport(report);
  return current;
}

function assert(condition,message){ if(!condition) throw new Error(`Report verification failed: ${message}`); }
function equal(value,expected,message){ assert(value===expected,`${message}: recorded ${value}, recomputed ${expected}`); }
function deepEqual(value,expected,message){ assert(JSON.stringify(value)===JSON.stringify(expected),`${message} differs from recomputed evidence`); }
function percentile(values,fraction){ const sorted=[...values].sort((a,b)=>a-b); return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*fraction)-1))]||0; }
function summarize(values){ assert(Array.isArray(values)&&values.length>0&&values.every(value=>Number.isFinite(value)&&value>=0),'timing samples must be a nonempty array of finite nonnegative numbers'); return {count:values.length,p50:percentile(values,.5),p95:percentile(values,.95),p99:percentile(values,.99),max:Math.max(...values)}; }
function stableComparable(snapshot,excluded){
  const visit=(value,path_)=>{
    if(value===null||typeof value!=='object') return value;
    if(Array.isArray(value)) return value.map((item,index)=>visit(item,`${path_}[${index}]`));
    return Object.fromEntries(Object.entries(value).filter(([key])=>!excluded.some(pattern=>new RegExp(pattern).test(`${path_}.${key}`))).map(([key,item])=>[key,visit(item,`${path_}.${key}`)]));
  };
  return visit(snapshot,'snapshot');
}
function verifyHardwareReport(report){
  assert(report.schema>=4,'hardware schema must be at least 4');
  const expectedContract={requiredBrowsers:[...REQUIRED_BROWSERS],requiredLayers:[...REQUIRED_LAYERS],minimumFrames:MINIMUM_FRAMES,minimumDurationMs:MINIMUM_DURATION_MS,stableWindowStartMs:STABLE_WINDOW_START_MS,minimumStableSamples:MINIMUM_STABLE_SAMPLES,minimumStableDurationMs:MINIMUM_STABLE_DURATION_MS,stableCollectionTargetMs:STABLE_COLLECTION_TARGET_MS,resourceSampleIntervalMs:1000,cpuP95MaximumMs:CPU_P95_MAXIMUM_MS,cpuP99MaximumMs:CPU_P99_MAXIMUM_MS,webgl2:true,plateauExcludedPaths:[...PLATEAU_EXCLUDED_PATHS]};
  for(const [key,value] of Object.entries(expectedContract)) deepEqual(report.contract?.[key],value,`${key} contract`);
  assert(Array.isArray(report.results)&&report.results.length===REQUIRED_BROWSERS.length,'exactly the required browser results are required');
  deepEqual(report.results.map(value=>value.browser.name).sort(),[...REQUIRED_BROWSERS].sort(),'browser identities');
  for(const result of report.results){
    assert(Array.isArray(result.resources)&&result.resources.length>0,`${result.browser.name} resource samples are required`);
    deepEqual(result.requiredLayers,[...REQUIRED_LAYERS],`${result.browser.name} required layers`);
    const stable=result.resources.filter(value=>value.elapsedMs>=STABLE_WINDOW_START_MS),first=stable[0],last=stable.at(-1),comparable=first&&stableComparable(first.snapshot,PLATEAU_EXCLUDED_PATHS);
    const submissionMs=summarize(result.submissionSamplesMs),rafIntervalMs=summarize(result.rafIntervalSamplesMs),gpuMs=summarize(result.gpuSamplesMs);
    deepEqual(result.submissionMs,submissionMs,`${result.browser.name} CPU summary`);
    deepEqual(result.rafIntervalMs,rafIntervalMs,`${result.browser.name} RAF summary`);
    deepEqual(result.gpuMs,gpuMs,`${result.browser.name} GPU summary`);
    equal(result.submissionSamplesMs.length,result.frames,`${result.browser.name} CPU sample count/frame count`);
    const identityText=`${result.identity?.vendor||''} ${result.identity?.renderer||''} ${result.identity?.version||''}`;
    const recognized=/intel|nvidia|geforce|amd|radeon|apple|arc/i.test(identityText),software=/swiftshader|llvmpipe|software|microsoft basic|null|generic|virtualbox|vmware/i.test(identityText),platformContext=report.platform?.type==='Windows_NT'?/(?:direct3d|d3d\d*|angle)/i.test(identityText):report.platform?.type==='Darwin'?/metal/i.test(identityText):/(?:opengl|vulkan|mesa)/i.test(identityText);
    const canonicalKeys=['state','hash','digest','rng','tick'],canonical=canonicalKeys.every(key=>result.before?.[key]!==undefined&&JSON.stringify(result.before[key])===JSON.stringify(result.after?.[key]));
    let fallbackCountersZero=true;
    const inspectCounters=(value,path_='')=>{ if(!value||typeof value!=='object') return; for(const [key,item] of Object.entries(value)){ const current=path_?`${path_}.${key}`:key; if(typeof item==='number'&&(/(?:resourceLimitFallback|compositingConflictFallback)\.count$/i.test(current)||/(?:fallbacks|capFailures|capRejects|capHits)$/i.test(current))&&item!==0) fallbackCountersZero=false; else inspectCounters(item,current); } };
    for(const sample of result.resources){
      deepEqual(sample.requiredLayers,[...REQUIRED_LAYERS],`${result.browser.name} sample required layers`);
      for(const name of REQUIRED_LAYERS) assert(sample.layers?.[name]?.owned===true&&sample.layers[name].representative>0&&sample.layers[name].fallbackCount===0,`${result.browser.name} ${name} must be owned, nonzero, and fallback-free in every sample`);
      inspectCounters(sample.snapshot);
    }
    const gates={
      browser:!!result.browser.version&&REQUIRED_BROWSERS.includes(result.browser.name),
      duration:result.durationMs>=MINIMUM_DURATION_MS,
      frames:result.frames>=MINIMUM_FRAMES,
      webgl:result.identity.webgl2===true&&result.identity.debugInfo===true,
      identity:!result.identity.headless&&[result.identity.vendor,result.identity.renderer,result.identity.version].every(value=>typeof value==='string'&&value.trim())&&recognized&&!software&&platformContext,
      timers:result.gpuStatus==='extension-available-reliable-samples'&&gpuMs.count>0&&result.gpuDisjoint===0&&result.gpuQueryErrors===0,
      context:result.contextLosses===0&&result.contextRestores===0&&result.startRenderer.active==='pixi-hybrid'&&result.endRenderer.active==='pixi-hybrid'&&result.startRenderer.contextState==='ready'&&result.endRenderer.contextState==='ready',
      gl:Array.isArray(result.glErrors)&&result.glErrors.length===0,
      layers:result.resources.every(sample=>REQUIRED_LAYERS.every(name=>sample.layers[name].owned===true&&sample.layers[name].representative>0&&sample.layers[name].fallbackCount===0)),
      plateau:stable.length>=MINIMUM_STABLE_SAMPLES&&last.elapsedMs-first.elapsedMs>=MINIMUM_STABLE_DURATION_MS&&stable.every(sample=>JSON.stringify(stableComparable(sample.snapshot,PLATEAU_EXCLUDED_PATHS))===JSON.stringify(comparable)),
      fallback:result.endRenderer.compositingFallback===false&&fallbackCountersZero,
      sourceManifest:true,
      canonical,
      failures:Array.isArray(result.failures)&&result.failures.length===0,
      cpu:submissionMs.p95<=CPU_P95_MAXIMUM_MS&&submissionMs.p99<=CPU_P99_MAXIMUM_MS
    };
    for(const [key,value] of Object.entries(gates)) equal(result.gates[key],value,`${result.browser.name} ${key} gate`);
    equal(result.stableWindow.startMs,first.elapsedMs,`${result.browser.name} stable start`);
    equal(result.stableWindow.endMs,last.elapsedMs,`${result.browser.name} stable end`);
    equal(result.stableWindow.durationMs,last.elapsedMs-first.elapsedMs,`${result.browser.name} stable duration`);
    equal(result.stableWindow.sampleCount,stable.length,`${result.browser.name} stable samples`);
    equal(result.resourcePlateau,gates.plateau,`${result.browser.name} plateau boolean`);
    equal(result.allLayers,gates.layers,`${result.browser.name} all-layers boolean`);
    equal(result.canonicalPreserved,canonical,`${result.browser.name} canonical boolean`);
    assert(Array.isArray(result.plateauDeltas)&&result.plateauDeltas.length===0,`${result.browser.name} reported plateau deltas must be empty`);
    equal(result.passed,Object.values(gates).every(Boolean),`${result.browser.name} pass predicate`);
  }
  equal(report.passed,report.results.every(value=>value.passed),'hardware report pass predicate');
}
function collectPlaywrightTests(suites,values=[]){
  for(const suite of suites||[]){ for(const spec of suite.specs||[]) for(const test of spec.tests||[]) values.push({project:test.projectName,status:test.status,results:test.results||[]}); collectPlaywrightTests(suite.suites,values); }
  return values;
}
function classifyPlaywrightTest(test){ const last=test.results.at(-1)?.status; if(test.status==='expected'&&last==='passed') return 'passed'; if(test.status==='skipped'||last==='skipped') return 'skipped'; if(test.status==='flaky') return 'flaky'; return 'failed'; }
function matrixSummary(playwright,projects){
  const tests=collectPlaywrightTests(playwright.suites),empty=()=>({total:0,passed:0,skipped:0,failed:0,flaky:0,interrupted:0,timedOut:0}),counts=empty(),perProject=Object.fromEntries(projects.map(project=>[project,{...empty(),durationMs:0}]));
  for(const test of tests){ const category=classifyPlaywrightTest(test),last=test.results.at(-1)?.status; counts.total++; counts[category]++; counts.interrupted+=last==='interrupted'?1:0; counts.timedOut+=last==='timedOut'?1:0; assert(perProject[test.project],`raw matrix contains unexpected project ${test.project}`); const project=perProject[test.project]; project.total++; project[category]++; project.interrupted+=last==='interrupted'?1:0; project.timedOut+=last==='timedOut'?1:0; project.durationMs+=test.results.reduce((sum,result)=>sum+(Number(result.duration)||0),0); }
  return {counts,perProject};
}
function verifyMatrixReport(root,report){
  assert(report.schema>=2,'matrix schema must be at least 2');
  equal(report.workers,1,'matrix worker count');
  assert(report.timeoutBudgetMs>=1800000,'matrix timeout budget must be at least 30 minutes');
  assert(report.isolation?.portsFreeBeforeRun&&report.isolation?.reuseExistingServer===false&&report.isolation?.freshPlaywrightWorkers,'matrix isolation evidence');
  assert(Array.isArray(report.projects)&&report.projects.length===11&&new Set(report.projects).size===11,'matrix project inventory');
  const expectedPath='docs/evidence/phase-e-browser-matrix.raw.json.gz'; equal(report.rawReport?.path,expectedPath,'matrix retained raw path'); equal(report.rawReport?.format,'playwright-json-gzip','matrix retained raw format');
  const rawPath=path.resolve(root,expectedPath); assert(rawPath.startsWith(path.resolve(root,'docs/evidence')+path.sep)&&fs.existsSync(rawPath),'matrix retained raw file must exist under docs/evidence');
  const compressed=fs.readFileSync(rawPath); equal(report.rawReport.compressedBytes,compressed.length,'matrix compressed byte size'); equal(report.rawReport.compressedSha256,sha256(compressed),'matrix compressed hash');
  let raw; try{ raw=zlib.gunzipSync(compressed); }catch(error){ throw new Error(`Report verification failed: matrix retained raw gzip is invalid: ${error.message}`); }
  equal(report.rawReport.uncompressedBytes,raw.length,'matrix uncompressed byte size'); equal(report.rawReport.uncompressedSha256,sha256(raw),'matrix uncompressed hash');
  let playwright; try{ playwright=JSON.parse(raw); }catch(error){ throw new Error(`Report verification failed: matrix retained raw JSON is invalid: ${error.message}`); }
  const recomputed=matrixSummary(playwright,report.projects); deepEqual(report.counts,recomputed.counts,'matrix counts'); deepEqual(report.perProject,recomputed.perProject,'matrix per-project counts and durations'); deepEqual(report.playwrightStats,playwright.stats,'matrix Playwright stats');
  equal(report.counts.total,report.counts.passed+report.counts.skipped+report.counts.failed+report.counts.flaky,'matrix result count');
  const zero=report.counts.failed===0&&report.counts.flaky===0&&report.counts.interrupted===0&&report.counts.timedOut===0;
  equal(report.zeroFailures,zero,'matrix zero-failure predicate');
  assert(/--workers=1/.test(report.command)&&/--reporter=json/.test(report.command),'matrix command must retain deterministic JSON execution');
  equal(report.passed,zero&&report.counts.total===report.counts.passed+report.counts.skipped&&report.projects.every(value=>report.perProject[value]?.total>0),'matrix pass predicate');
}

module.exports={createSourceEvidence,createCandidateSourceEvidence,verifyCandidateSourceEvidence,verifyReport,verifyHardwareReport,verifyMatrixReport,summarize,matrixSummary};

if(require.main===module){
  const root=path.resolve(__dirname,'..'),index=process.argv.indexOf('--verify-report');
  if(index<0||!process.argv[index+1]) throw new Error('Usage: node tools/source-evidence-manifest.js --verify-report <report.json>');
  const reportPath=path.resolve(root,process.argv[index+1]); verifyReport(root,reportPath); process.stdout.write(`Verified ${path.relative(root,reportPath)} against current executable source.\n`);
}
