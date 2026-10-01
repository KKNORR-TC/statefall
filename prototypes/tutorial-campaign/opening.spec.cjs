const {test,expect}=require('@playwright/test');
test('whole cards activate and guide returns to the current setup step',async({page})=>{
 await page.goto('/?browserTest=1&art=classic&opening=1');await expect(page.locator('#openingSaved')).toBeVisible();
 await page.locator('#openingSaved').click({position:{x:12,y:12}});await expect(page.locator('#modal')).toBeVisible();await page.locator('#modal [data-close]').click();
 for(let step=-1;step<4;step++){
  if(step===0)await page.locator('#guidedMatch').click();else if(step>0)await page.locator('#setupNext').click();
  await page.locator('#helpBtn1').click();await expect(page.locator('#help')).toBeVisible();await expect(page.locator('#start')).toBeHidden();
  if(step===1)await page.keyboard.press('Escape');else if(step===2)await page.locator('#helpClose').click();else await page.locator('#openingGuideReturn').click();
  await expect(page.locator('#start')).toBeVisible();if(step>=0)await expect(page.locator(['#setupMode','#setupBattlefield','#setupCountry','#setupReview'][step])).toBeVisible();
 }
 await page.locator('#setupBack').click();await page.locator('#setupBack').click();await page.locator('#setupBack').click();await page.locator('#setupBack').click();
 await page.locator('.learnChoice').click({position:{x:12,y:12}});await expect(page.locator('#trainingTitle')).toHaveText('Your actual starting country',{timeout:30000});
});
test('random match reviews selections and rerolls before starting',async({page})=>{
 await page.goto('/?browserTest=1&art=classic&opening=1');await expect(page.locator('#randomMatch')).toBeVisible();
 // Fixed draw verifies both selectors use randomness; the engine still starts normally.
 await page.evaluate(()=>{Math.random=()=>0.99;});
 await page.locator('#randomMatch').click();await expect(page.locator('#setupReview')).toBeVisible();expect(await page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready||false)).toBe(false);await expect(page.locator('#setupRecap')).toContainText('Impossible');await page.evaluate(()=>{Math.random=()=>0.01;});await page.locator('#randomReroll').click();await expect(page.locator('#setupRecap')).toContainText('Super easy');await page.locator('#startBtn').click();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready)).toBe(true);
 await expect(page.locator('#diffSel option:checked')).toHaveText('Super easy');await expect(page.locator('#maps .on')).toHaveText('Continents');await expect(page.locator('#start')).toBeHidden();
});
test('exclusive layout, readable difficulty, rule summary and reset',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?browserTest=1&art=classic&opening=1');
 await page.locator('#guidedMatch').click();await expect(page.locator('#setupMode')).toBeVisible();await expect(page.locator('#openingSummary')).toContainText('Standard rules');
 await expect(page.locator('#openingNew')).toHaveCount(0);
 await expect(page.locator('#diffSel option:checked')).toHaveText('Normal');
 await expect(page.locator('#difficultyHelp')).toContainText('Even footing');
 await expect(page.locator('#setupMode > .toggleRow')).toBeVisible();await expect(page.locator('#fogOn')).toBeVisible();await expect(page.locator('#setupBattlefield')).toBeHidden();
 for(const id of ['quickStart','riskyOn','endgameOn','']){
  await page.locator('#openingLayout').selectOption(id);
  expect(await page.locator('#modes input[data-group=layout]').evaluateAll(inputs=>inputs.filter(i=>i.checked).map(i=>i.id))).toEqual(id?[id]:[]);
 }
 await page.locator('#fogOn').check();await expect(page.locator('#activeRules')).toContainText('Fog of war');
 await page.locator('#teamSel').selectOption('2');await expect(page.locator('#activeRules')).toContainText('2 teams');
 await page.locator('#resetStandard').click();await expect(page.locator('#activeRules')).toHaveText('Standard rules');await expect(page.locator('#teamSel')).toHaveValue('0');
 await page.locator('#setupNext').click();await expect(page.locator('#setupBattlefield')).toBeVisible();await expect(page.locator('#diffSel')).toBeVisible();await page.locator('#diffSel').selectOption('easy');await page.locator('#maps [data-m=europe]').click();await page.locator('#setupBack').click();await expect(page.locator('#setupMode')).toBeVisible();await page.locator('#setupNext').click();await expect(page.locator('#diffSel')).toHaveValue('easy');await expect(page.locator('#maps .on')).toHaveText('Europe');await page.locator('#setupNext').click();await expect(page.locator('#setupCountry')).toBeVisible();await page.locator('#countrySel').selectOption({label:'Hungary'});await page.locator('#setupNext').click();await expect(page.locator('#setupRecap')).toContainText('Hungary');await page.locator('#setupBack').click();await expect(page.locator('#countrySel option:checked')).toHaveText('Hungary');await page.locator('#setupNext').click();await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const box=await page.locator('#startBtn').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(844);
 await expect(page.locator('#openingContinue')).toBeHidden();await page.locator('#startBtn').click();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready)).toBe(true);expect(errors).toEqual([]);
});
test('continue uses the saved-game provider and reports failure without losing access',async({page})=>{
 await page.route('**/tutorial/opening-preview.mjs',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace("const card=",`window.__STATEFALL_OPENING_SAVES__={latest:async()=>({available:true,save:{id:12,slot:'Hungary on Continents'}}),resume:async item=>{window.resumedSave=item.id;throw new Error('test failure');}};const card=`);await route.fulfill({response,body});});
 await page.goto('/?browserTest=1&art=classic&opening=1');await expect(page.locator('#savedMessage')).toHaveText('Hungary on Continents');await page.locator('#openingContinue').click();expect(await page.evaluate(()=>window.resumedSave)).toBe(12);await expect(page.locator('#savedMessage')).toContainText('Could not load');await expect(page.locator('#openingContinue')).toBeEnabled();await expect(page.locator('#gamesBtn')).toBeVisible();
});
