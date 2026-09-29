// Fixed-artwork muzzle anchors for eight atlas headings; never rotate the painted hull.
const GUNS={
 warship:[[237,107],[222,129],[180,145],[138,132],[121,110],[134,84],[180,81],[225,83]],
 scout:[[251,96.5],[243,117],[180,137],[116,117],[109,97],[122,70],[180,66],[240,70]],
 battleship:[[233,108],[218,126],[180,137],[140,124],[120,109],[135,75],[180,130],[220,81]],
 heavytransport:[[147.5,69],[145,67],[180,72],[215,68],[213,73],[203,98],[180,117],[157,100]]
};
export function headingPhase(heading){const phase=((heading/(Math.PI/4))%8+8)%8,index=Math.floor(phase),f=phase-index;return {index,next:(index+1)%8,blend:f*f*(3-2*f)};}
export function shipMuzzles(type,heading){const table=GUNS[type];if(!table)return null;const {index,next,blend}=headingPhase(heading),a=table[index],b=table[next],x=a[0]+(b[0]-a[0])*blend,y=a[1]+(b[1]-a[1])*blend;return [[x,y,heading+(type==='heavytransport'?Math.PI:0),0]];}
export function unitAttachment(heading,x,y){const dx=x-180,dy=y-116;return [180+Math.cos(heading)*dx-Math.sin(heading)*dy,116+Math.sin(heading)*dx+Math.cos(heading)*dy];}

// Action bookkeeping is presentation-only. A first observation never invents a shot.
export function createMotionTracker(){
 let states=new WeakMap(),tick=-1,time=0,lastNow=null;
 return {
 reset(){states=new WeakMap();tick=-1;time=0;lastNow=null;},
 begin(nextTick,now,paused){if(nextTick<tick){states=new WeakMap();time=nextTick/10;lastNow=null;}if(lastNow!==null&&!paused)time+=Math.max(0,Math.min(.1,(now-lastNow)/1000));if(lastNow===null)time=nextTick/10;tick=nextTick;lastNow=now;return time;},
 observe(source,values,active=false){let old=states.get(source);let triggered=false;if(old){triggered=values.some((v,i)=>typeof v==='number'?v>(old.values[i]??0):v!==old.values[i]);if(triggered)old.at=time;}else old={at:-100,values};old.values=values;states.set(source,old);return {age:active?time%2:time-old.at,triggered,time};}
 };
}
