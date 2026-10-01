const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4187/score-library.html');await page.waitForSelector('article');assert.equal(await page.locator('article').count(),16);
 await page.getByRole('button',{name:'Building / quiet',exact:true}).click();await page.waitForFunction(()=>!player.paused&&player.currentTime>0);
 const building=await page.evaluate(()=>current.title);assert.ok(['Drift and Divide','Iron Coast','Siege Map Drift'].includes(building));
 await page.getByRole('button',{name:'Radio override',exact:true}).click();await page.getByRole('button',{name:'Battle',exact:true}).click();assert.equal(await page.evaluate(()=>current.title),building);
 await page.getByRole('button',{name:'By situation',exact:true}).click();await page.waitForFunction(()=>!player.paused&&current.title!== 'Drift and Divide');assert.ok(await page.evaluate(()=>assignments[current.id].roles.includes('battle')));
 await page.getByRole('button',{name:'Ashes of Victory — strongest',exact:true}).click();await page.waitForFunction(()=>!player.paused&&player.currentTime>=115);
 await page.evaluate(()=>{player.currentTime=excerptEnd-.1;});await page.waitForFunction(()=>player.paused);assert.equal(await page.evaluate(()=>current.title),'Ashes of Victory');
 const first=page.locator('article').first();await first.getByLabel('I have reviewed these assignments').check();await first.getByLabel('Building',{exact:true}).check();
 await page.reload();await page.waitForSelector('article');assert.equal(await page.locator('article').first().getByLabel('I have reviewed these assignments').isChecked(),true);assert.equal(await page.locator('article').first().getByLabel('Building',{exact:true}).isChecked(),true);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export track assignments'}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'statefall-score-assignments.json');
 const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'score-library.json')));for(const t of catalog.tracks){const response=await page.request.get('http://127.0.0.1:4187/score/'+t.id,{headers:{Range:'bytes=0-43'}});assert.equal(response.status(),206);assert.equal((await response.body()).length,44);}
 assert.equal((await page.request.get('http://127.0.0.1:4187/score/unknown')).status(),404);
 const id=catalog.tracks[0].id;assert.equal((await page.request.get('http://127.0.0.1:4187/score/'+id,{headers:{Range:'bytes=999999999-'}})).status(),416);
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForSelector('article');await page.evaluate(()=>scrollTo(0,0));
 assert.ok(!(await page.locator('article .meta').allTextContents()).some(t=>/^\d+:60/.test(t)));
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(__dirname,'score-review-mobile.png'),fullPage:false});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(__dirname,'score-review-desktop.png'),fullPage:false});assert.deepEqual(errors,[]);
 const report={passed:true,tracks:16,checks:['situational queue','Radio preserves track on situation changes','return to situation playback','seek and 20-second excerpt stop','saved assignments survive reload','export available','all 16 WAV range responses','unknown file and invalid range rejection','mobile overflow'],errors};fs.writeFileSync(path.join(__dirname,'score-library-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
