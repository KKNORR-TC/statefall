'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {createServer}=require('./dist-server.js');

const ROOT=path.resolve(__dirname,'..');
const CAPTURE_DIST=path.join(ROOT,'.artifacts','trailer-dist');
const VIEWPORT={width:1580,height:720}; // The current 300px sidebar layout leaves a 1280x720 Canvas.

function parseArgs(argv,defaultFrames){
  const positional=[],options={frames:defaultFrames,smoke:false,help:false};
  for(let i=0;i<argv.length;i++){
    const value=argv[i];
    if(value==='--smoke'){options.smoke=true;options.frames=1;}
    else if(value==='--help'||value==='-h')options.help=true;
    else if(value==='--frames'){
      const count=Number.parseInt(argv[++i],10);
      if(!Number.isInteger(count)||count<1)throw new Error('--frames requires a positive integer');
      options.frames=count;
    }else if(value.startsWith('--'))throw new Error(`Unknown option: ${value}`);
    else positional.push(value);
  }
  return {options,positional};
}

function listen(server){
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve(server.address().port));
  });
}

function close(server){return new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}

async function openCapture(output){
  if(!fs.existsSync(path.join(CAPTURE_DIST,'index.html'))){
    throw new Error('Built capture assets are unavailable: .artifacts/trailer-dist/index.html is missing. Run "npm run build:trailer" first.');
  }
  fs.rmSync(output,{recursive:true,force:true});
  fs.mkdirSync(output,{recursive:true});
  const server=createServer(CAPTURE_DIST);
  let browser;
  try{
    const port=await listen(server);
    try{browser=await chromium.launch({headless:true});}
    catch(error){throw new Error(`Playwright Chromium is unavailable. Run "npx playwright install chromium".\n${error.message}`);}
    const context=await browser.newContext({viewport:VIEWPORT,deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'reduce'});
    const page=await context.newPage(),failures=[];
    page.on('pageerror',error=>failures.push(`page error: ${error.message}`));
    page.on('requestfailed',request=>failures.push(`request failed: ${request.url()} (${request.failure()?.errorText||'unknown'})`));
    await page.addInitScript(()=>{
      window.__STATEFALL_TEST_MODE__=true;
      localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));
    });
    return {browser,context,page,server,baseURL:`http://127.0.0.1:${port}`,output,failures,index:0};
  }catch(error){
    if(browser)await browser.close().catch(()=>{});
    if(server.listening)await close(server).catch(()=>{});
    throw error;
  }
}

async function loadGame(capture){
  await capture.page.goto(`${capture.baseURL}/index.html?browserTest=1`,{waitUntil:'networkidle'});
  const hasBridge=await capture.page.evaluate(()=>typeof window.__STATEFALL_TEST__==='object');
  if(!hasBridge)throw new Error('The built assets do not contain the guarded capture bridge. Run "npm run build:trailer" first; a normal production build intentionally strips it.');
}

async function startMatch(capture,{seed,map='random',country='Norway',difficulty='hard',quick=false,instant=false,fog=false,noCap=false}={}){
  await loadGame(capture);
  const {page}=capture;
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator(`#maps button[data-m="${map}"]`).click();
  await page.locator('#seedIn').fill(seed);
  await page.locator('#diffSel').selectOption(difficulty);
  try{await page.locator('#countrySel').selectOption({label:country});}
  catch{throw new Error(`Unknown country: ${country}`);}
  if(quick)await page.locator('#quickStart').check();
  if(instant)await page.locator('#instantOn').check();
  if(fog)await page.locator('#fogOn').check();
  if(noCap){await page.locator('#settingsBtn').click();await page.locator('#stNoCap').check();await page.locator('#settingsClose').click();}
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.__STATEFALL_TEST__?.status().ready===true);
  const status=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  if(!status.paused)await page.evaluate(()=>window.__STATEFALL_TEST__.pause());
}

async function command(capture,name,...args){
  return capture.page.evaluate(({name,args})=>{
    const operation=window.__STATEFALL_TEST__[name];
    if(typeof operation!=='function')throw new Error(`Capture bridge command unavailable: ${name}`);
    return operation(...args);
  },{name,args});
}

async function frame(capture){
  await command(capture,'freezePresentation');
  const file=path.join(capture.output,`f${String(capture.index++).padStart(5,'0')}.jpg`);
  await capture.page.locator('#map').screenshot({path:file,type:'jpeg',quality:92,animations:'disabled'});
  return file;
}

async function finish(capture){
  const errors=[];
  if(capture.browser)try{await capture.browser.close();}catch(error){errors.push(error);}
  if(capture.server?.listening)try{await close(capture.server);}catch(error){errors.push(error);}
  if(capture.failures.length)errors.unshift(new Error(capture.failures.join('\n')));
  if(errors.length)throw new AggregateError(errors,'Trailer capture failed');
}

async function run(output,work){
  const capture=await openCapture(output);
  let failure;
  try{await work(capture);}catch(error){failure=error;}
  try{await finish(capture);}catch(error){if(failure)failure=new AggregateError([failure,error],'Trailer capture and cleanup failed');else failure=error;}
  if(failure)throw failure;
  return capture.index;
}

module.exports={command,frame,parseArgs,run,startMatch};
