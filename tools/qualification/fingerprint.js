const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
module.exports=function simulationFingerprint(){
 const hash=createHash('sha256');
 function walk(dir){for(const name of fs.readdirSync(dir).sort()){const file=path.join(dir,name);if(fs.statSync(file).isDirectory())walk(file);else if(/\.(mjs|js)$/.test(file))hash.update(fs.readFileSync(file));}}
 walk(path.resolve(__dirname,'../../game/src/sim'));return hash.digest('hex');
};
