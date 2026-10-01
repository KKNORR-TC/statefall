const {test,expect}=require('@playwright/test');
test('random match chooses map and difficulty and starts immediately',async({page})=>{
 await page.goto('/?browserTest=1&art=classic&opening=1');await expect(page.locator('#randomMatch')).toBeVisible();
 // Fixed draw verifies both selectors use randomness; the engine still starts normally.
 await page.evaluate(()=>{Math.random=()=>0.99;});
 await page.locator('#randomMatch').click();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready)).toBe(true);
 await expect(page.locator('#diffSel option:checked')).toHaveText('Impossible');await expect(page.locator('#maps .on')).toHaveText('Middle East');await expect(page.locator('#start')).toBeHidden();
});
test('exclusive layout, readable difficulty, rule summary and reset',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?browserTest=1&art=classic&opening=1');
 await page.locator('#guidedMatch').click();await expect(page.locator('#setupMode')).toBeVisible();await expect(page.locator('#openingSummary')).toContainText('Standard rules');
 await expect(page.locator('#openingNew')).toHaveCount(0);
 await expect(page.locator('#diffSel option:checked')).toHaveText('Normal');
 await expect(page.locator('#difficultyHelp')).toContainText('Even footing');
 await page.getByText('Special rules & starting setup',{exact:false}).first().click();
 for(const id of ['quickStart','riskyOn','endgameOn','']){
  await page.locator('#openingLayout').selectOption(id);
  expect(await page.locator('#modes input[data-group=layout]').evaluateAll(inputs=>inputs.filter(i=>i.checked).map(i=>i.id))).toEqual(id?[id]:[]);
 }
 await page.locator('#fogOn').check();await expect(page.locator('#activeRules')).toContainText('Fog of war');
 await page.locator('#teamSel').selectOption('2');await expect(page.locator('#activeRules')).toContainText('2 teams');
 await page.locator('#resetStandard').click();await expect(page.locator('#activeRules')).toHaveText('Standard rules');await expect(page.locator('#teamSel')).toHaveValue('0');
 await page.locator('#setupNext').click();await expect(page.locator('#setupCountry')).toBeVisible();await page.locator('#countrySel').selectOption({label:'Hungary'});await page.locator('#setupNext').click();await expect(page.locator('#setupRecap')).toContainText('Hungary');await page.locator('#setupBack').click();await expect(page.locator('#countrySel option:checked')).toHaveText('Hungary');await page.locator('#setupNext').click();await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const box=await page.locator('#startBtn').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(844);
 await expect(page.locator('#openingContinue')).toBeHidden();await page.locator('#startBtn').click();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready)).toBe(true);expect(errors).toEqual([]);
});
test('continue uses the saved-game provider and reports failure without losing access',async({page})=>{
 await page.route('**/tutorial/opening-preview.mjs',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace("const card=",`window.__STATEFALL_OPENING_SAVES__={latest:async()=>({available:true,save:{id:12,slot:'Hungary on Continents'}}),resume:async item=>{window.resumedSave=item.id;throw new Error('test failure');}};const card=`);await route.fulfill({response,body});});
 await page.goto('/?browserTest=1&art=classic&opening=1');await expect(page.locator('#savedMessage')).toHaveText('Hungary on Continents');await page.locator('#openingContinue').click();expect(await page.evaluate(()=>window.resumedSave)).toBe(12);await expect(page.locator('#savedMessage')).toContainText('Could not load');await expect(page.locator('#openingContinue')).toBeEnabled();await expect(page.locator('#gamesBtn')).toBeVisible();
});
