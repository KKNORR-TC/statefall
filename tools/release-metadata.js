'use strict';

const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'..','game','src','config','build.js'),'utf8');
const signingSource=fs.readFileSync(path.resolve(__dirname,'..','game','src','config','signing.js'),'utf8');
function value(name){const match=source.match(new RegExp(`export const ${name}='([^']+)';`));if(!match)throw new Error(`Missing ${name} in build metadata`);return match[1];}
const signingKey=(signingSource.match(/export const STATEFALL_SIGN_KEY='([^']+)';/)||[])[1];
if(!signingKey)throw new Error('Missing STATEFALL_SIGN_KEY in signing metadata');
module.exports={version:value('GAME_VERSION'),build:value('GAME_BUILD'),minimumPluginVersion:value('REQUIRES_PLUGIN'),simulationBaselineVersion:value('SIMULATION_BASELINE_VERSION'),signingKeySha256:require('node:crypto').createHash('sha256').update(signingKey).digest('hex')};
