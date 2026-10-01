const {test,expect}=require('@playwright/test');

test('in-game guide loads every current unit portrait and practical usage note',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})));
 await page.goto('/');
 await expect(page.locator('#bootStatus')).toHaveCount(0,{timeout:30000});
 await page.getByRole('button',{name:'How to play',exact:true}).click();
 for(const [name,count]of [['Buildings',25],['Ships',11],['Air',4]]){
  await page.getByRole('button',{name,exact:true}).click();
  const cards=page.locator('.sf-unit-card');await expect(cards).toHaveCount(count);
  for(const card of await cards.all()){
   await card.scrollIntoViewIfNeeded();
   const image=card.locator('img');
   await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth===480&&i.naturalHeight===360)).toBe(true);
   await expect(card.getByText('How to use',{exact:true})).toBeVisible();
   expect(await image.evaluate(i=>getComputedStyle(i).objectFit)).toBe('contain');
  }
 }
});

test('packaged website guide is self-contained and readable at narrow widths',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const [tab,count]of [['build',25],['ships',11],['air',4]]){
  await page.goto(`http://127.0.0.1:4174/howto/${tab}.html`);
  await expect(page.locator('.sf-unit-card')).toHaveCount(count);
  for(const image of await page.locator('.sf-unit-art img').all()){
   await image.scrollIntoViewIfNeeded();
   await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth===480)).toBe(true);
   expect(await image.getAttribute('src')).toMatch(/^data:image\/webp;base64,/);
  }
  expect(await page.locator('.sf-unit-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await page.locator('.sf-unit-grid').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 }
});
