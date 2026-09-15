const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');

function inspect(S){
  assert.equal(S.stateOracleVersion,'statefall-authoritative-state/v1','unexpected state oracle version');
  const serialization=S.serializeCanonicalState();
  return {version:S.stateOracleVersion,serialization,digest:createHash('sha256').update(serialization).digest('hex')};
}

function assertInvariants(S,label='state'){
  assert.deepEqual(S.checkStateInvariants(),[],`${label}: authoritative state invariants failed`);
}

function firstDifference(a,b){
  const left=JSON.parse(a),right=JSON.parse(b),walk=(x,y,path)=>{
    if(Object.is(x,y)) return null;
    if(!x||!y||typeof x!=='object'||typeof y!=='object') return `${path}: ${JSON.stringify(x)} != ${JSON.stringify(y)}`;
    const keys=[...new Set([...Object.keys(x),...Object.keys(y)])].sort();
    for(const key of keys){ if(!(key in x)||!(key in y)) return `${path}.${key}: missing on ${key in x?'right':'left'}`; const found=walk(x[key],y[key],`${path}.${key}`); if(found) return found; }
    return null;
  };
  return walk(left,right,'state')||'';
}

module.exports={inspect,assertInvariants,firstDifference};
