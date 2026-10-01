const {test,expect}=require('@playwright/test');

for(const custom of [false,true]) test(`restart preserves active match settings and ${custom?'custom':'standard'} country`,async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;window.__STATEFALL_TEST_PAUSE_ON_START__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:0,music:0}));});
  await page.goto('/index.html?browserTest=1');
  await page.waitForFunction(()=>window.__STATEFALL_TEST__&&!document.getElementById('bootStatus'));
  await page.evaluate(custom=>window.__STATEFALL_TEST__.applySettings({map:'islands_m',diff:'hard',teams:2,country:custom?-1:0,customFlag:custom?{name:'Restart nation',layers:[['h','#123456','#abcdef']],userId:7}:null,quick:true,fog:true,instant:true,risky:false,endgame:false,billionaire:false,garrison:true,troops:240,gold:0,bots:false,noCap:true,pauseBuild:true,allowed:['city','port','scout']}),custom);
  await page.locator('#seedIn').fill('RESTARTSETTINGS');
  await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
  const initial=await page.evaluate(()=>({settings:window.__STATEFALL_TEST__.replayPayload().settings,hash:window.__STATEFALL_TEST__.stateHash()}));
  await page.evaluate(()=>{
    window.__STATEFALL_TEST__.advance(12);
    // A loaded match or stale form must not change the restart configuration.
    document.getElementById('fogOn').checked=false;
    document.getElementById('stGold').value='100';
  });
  await page.locator('#restartBtn').click();
  await page.locator('#restartYes').click();
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#bootStatus')).toHaveCount(0);
  await expect(page.locator('#fogOn')).toBeChecked();
  await expect(page.locator('#stGold')).toHaveValue('0');
  await expect(page.locator('input[data-u="silo"]')).not.toBeChecked();
  await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.replayPayload().settings)).toEqual(initial.settings);
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.stateHash())).toEqual(initial.hash);
  expect(errors).toEqual([]);
});

test('restart keeps custom opponents through repeated restarts from the pause menu',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.__STATEFALL_TEST_MODE__=true;
    window.__STATEFALL_TEST_PAUSE_ON_START__=true;
    localStorage.setItem('statefall-audio',JSON.stringify({master:0,music:0}));
    if(!sessionStorage.getItem('restart-fixture-installed')){
      sessionStorage.setItem('restart-fixture-installed','1');
      sessionStorage.setItem('statefall-restart',JSON.stringify({seed:'RESTARTBOTS',map:'random',diff:'normal',country:0,troops:120,gold:100,bots:true,customBots:[{userId:8,name:'Returning rival',layers:[['h','#123456','#abcdef']],slot:0}]}));
    }
  });
  await page.goto('/index.html?browserTest=1');
  let initial;
  for(let attempt=0;attempt<3;attempt++){
    await page.waitForFunction(()=>window.__STATEFALL_TEST__&&!document.getElementById('bootStatus'));
    await page.locator('#startBtn').click();
    await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
    const state=await page.evaluate(()=>({settings:window.__STATEFALL_TEST__.replayPayload().settings,hash:window.__STATEFALL_TEST__.stateHash()}));
    expect(state.settings.customBots).toEqual([{userId:8,name:'Returning rival',layers:[['h','#123456','#abcdef']],slot:0}]);
    if(initial) expect(state).toEqual(initial); else initial=state;
    if(attempt===2) break;
    await page.locator('#pauseBtn').click();
    await page.locator('#pmRestart').click();
    await page.locator('#restartYes').click();
    await expect(page.locator('#start')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
