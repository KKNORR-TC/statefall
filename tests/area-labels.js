const assert = require('node:assert/strict');
(async () => {
  const {buildAreaLabels} = await import('../game/src/rendering/area-labels.mjs');
  const regions = [{name:'Main',size:500},{name:'Small',size:10},{name:'East',size:900},{}];
  function reference(areas, a) {
    const i=areas.indexOf(a);if(i===0)return 'Home';
    const rg=a.region,r=regions[rg],base=r&&r.name&&r.size>=100?r.name:'Area '+(i+1);
    const twins=areas.filter(b=>b!==a&&areas.indexOf(b)!==0&&b.region===rg);if(!twins.length)return base;
    const home=areas[0],dx=a.cx-home.cx,dy=a.cy-home.cy,dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'E':'W'):(dy>0?'S':'N');
    const same=twins.filter(b=>{const bx=b.cx-home.cx,by=b.cy-home.cy;return (Math.abs(bx)>Math.abs(by)?(bx>0?'E':'W'):(by>0?'S':'N'))===dir;}).length;
    return base+' '+dir+(same?' '+areas.filter(b=>areas.indexOf(b)<=i&&b!==home&&b.region===rg).length:'');
  }
  let state=91;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  for(let run=0;run<80;run++){
    const areas=Array.from({length:run%40},()=>({cx:random()%100-50,cy:random()%100-50,region:random()%5}));
    const before=JSON.stringify(areas),labels=buildAreaLabels(areas,a=>a.region,regions,100);
    for(const a of areas)assert.equal(labels.get(a),reference(areas,a));
    assert.equal(JSON.stringify(areas),before);
  }
  let reads=0;
  const large=Array.from({length:5000},(_,i)=>({cx:i%100,cy:Math.floor(i/100),region:i%4}));
  const labels=buildAreaLabels(large,a=>{reads++;return a.region;},regions,100);
  assert.equal(labels.size,5000);assert.equal(reads,4999);
  console.log('Area label exact-reference and linear-scaling regressions PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
