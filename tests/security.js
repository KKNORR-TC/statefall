const assert=require('node:assert/strict');
const boot=require('../tools/harness.js');

const {S}=boot({seed:'SECURITY',diff:'normal',render:false,gridW:120,gridH:69});
const payload='<img src=x onerror=globalThis.__statefallXss=1>';
S.applySettings({
  customFlag:{name:payload,layers:[['h','#ffffff']],userId:1},
  customBots:[{name:payload,layers:[['h','#ffffff']],userId:2,slot:0}],
});

assert.ok(!S.START.customBots[0].name.includes('<'),'replay custom bot name retained executable markup');
assert.ok(!S.START.customBots[0].name.includes('>'),'replay custom bot name retained executable markup');
S.applySettings({customBots:[{name:'Player_1@example.test',layers:[null],userId:2,slot:0}]});
assert.equal(S.START.customBots[0].name,'Player_1@example.test','safe display-name punctuation was not preserved');
assert.deepEqual(S.START.customBots[0].layers,[['h','#ffffff','#0038a8']],'malformed replay flag did not fall back safely');
const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'..','game','index.html'),'utf8');
const notice=source.slice(source.indexOf('function showNotice'),source.indexOf('function invasionNotice'));
assert.ok(!notice.includes('innerHTML'),'notices still render untrusted content through innerHTML');
console.log('PASS replay identity markup is normalized before simulation setup');
