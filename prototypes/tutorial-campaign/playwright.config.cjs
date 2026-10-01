const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:__dirname,testMatch:['engine.spec.cjs','opening.spec.cjs'],timeout:90000,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:4190',viewport:{width:1440,height:900}},webServer:{cwd:require('node:path').resolve(__dirname,'../..'),command:'node prototypes/tutorial-campaign/server.cjs',env:{TUTORIAL_PORT:'4190'},url:'http://127.0.0.1:4190/?browserTest=1',reuseExistingServer:false,timeout:30000},projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'firefox',use:{browserName:'firefox'}},{name:'webkit',use:{browserName:'webkit'}}]});

// Keep agent-run tests silent even when explicitly run headed.
for(const project of module.exports.projects||[]){
 const browser=project.use?.browserName||project.use?.defaultBrowserType||'chromium';
 project.use.launchOptions={...project.use.launchOptions,...(browser==='firefox'?{firefoxUserPrefs:{'media.volume_scale':'0.0'}}:browser==='chromium'?{args:['--mute-audio']}: {})};
}
