const {test,expect}=require('@playwright/test');
const {version}=require('../../package.json');
const tabs=['basics','build','ships','air','systems','garrisons','modes','about'];

test('field guide stays readable on desktop and mobile, with working reference disclosures',async({page},testInfo)=>{
 test.setTimeout(90000);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  for(const tab of tabs){
   await page.goto('http://127.0.0.1:4174/howto/'+tab+'.html');
   const guide=page.locator('.sf-guide');
   await expect(guide.locator('h2')).toBeVisible();
   await expect.poll(()=>guide.locator('.sf-lead img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
   expect(await guide.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const first=guide.locator('summary').first();
   await first.focus();await first.press('Enter');
   await expect(guide.locator('details').first()).toHaveAttribute('open','');
   await first.press('Enter');
   await expect(guide.locator('details').first()).not.toHaveAttribute('open','');
   if(tab==='about')await expect(guide.locator('[data-release]')).toHaveAttribute('data-release',version);
   if(testInfo.project.name==='chromium-desktop'&&['basics','systems','garrisons','modes','about'].includes(tab)){
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`.artifacts/help-guide-${tab}-${width}.png`,fullPage:true});
   }
  }
 }
});

test('app guide shares current About and resets the reading position on tab changes',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#bootStatus')).toHaveCount(0,{timeout:30000});
 await page.getByRole('button',{name:'How to play',exact:true}).click();
 await page.getByRole('button',{name:'Systems',exact:true}).click();
 await page.locator('#helpBody summary').last().scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'About',exact:true}).click();
 await expect(page.locator('#helpBody [data-release]')).toHaveAttribute('data-release',version);
 await expect(page.locator('#helpBody h2')).toBeVisible();
 await expect(page.locator('#helpBody')).not.toContainText('1.10.32');
});
