const assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{sha256}=require('../game/src/sim/sha256.mjs');
const samples=['','abc','The quick brown fox jumps over the lazy dog','🙂 é 中 \u0000 \ud800'];
for(let length=0;length<260;length++)samples.push('x'.repeat(length),'a🙂中'.repeat(length));
samples.push('abcdefgh01234567'.repeat(65536));
for(const input of samples)assert.equal(sha256(input),createHash('sha256').update(input).digest('hex'),'digest for '+input.length+' UTF-16 code units');
console.log('SHA-256 native-oracle vectors PASS ('+samples.length+' cases)');
