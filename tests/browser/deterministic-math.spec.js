const {test,expect}=require('@playwright/test');
test('portable simulation math matches the historical runtime bit for bit',async({page},info)=>{
 test.skip(!['chromium-desktop','firefox-desktop','webkit-desktop'].includes(info.project.name),'numeric portability runs once per desktop browser');
 const inputs=Array.from({length:2000},(_,i)=>[(i-1000)/317,(i%337-169)/71]);
 inputs.push([0,-0],[-0,0],[NaN,Infinity],[Infinity,-Infinity],[Number.MAX_VALUE,Number.MIN_VALUE],[1e100,-1e100],[1e308,1e-308]);
 const expected=inputs.map(([x,y])=>[Math.sin(x),Math.cos(x),Math.atan(x),Math.atan2(y,x),Math.hypot(x,y)]);
 await page.goto('/?browserTest=1');
 const differences=await page.evaluate(async({inputs,expected})=>{
  const math=await import('/src/sim/strict-math.mjs'),out=[];
  for(let i=0;i<inputs.length;i++){const [x,y]=inputs[i],actual=[math.sin(x),math.cos(x),math.atan(x),math.atan2(y,x),math.hypot(x,y)];for(let j=0;j<actual.length;j++)if(!Object.is(actual[j],expected[i][j]))out.push({input:inputs[i],function:j,actual:actual[j],expected:expected[i][j]});}
  return out;
 },{inputs,expected});
 expect(differences).toEqual([]);
});
