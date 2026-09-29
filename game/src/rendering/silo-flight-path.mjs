// Presentation-only trajectory. Tick ages are shared by the hatch and projectile.
export const SILO_LIFTOFF=4.65/1.4;
export const SILO_JOIN=5;
export function siloFlightPosition(m,age,W,scale){
 const x=m.from%W+.5,y=Math.floor(m.from/W)+.5,tx=m.t%W+.5,ty=Math.floor(m.t/W)+.5,h=Math.hypot(tx-x,ty-y)*.35;
 const normal=a=>{const k=Math.min(1,a/m.flight);return [x+(tx-x)*k,y+(ty-y)*k-Math.sin(k*Math.PI)*h];};
 if(age>=SILO_JOIN)return normal(age);
 const start=[x,y-65*scale];if(age<=SILO_LIFTOFF)return start;
 const duration=SILO_JOIN-SILO_LIFTOFF,u=(age-SILO_LIFTOFF)/duration,end=normal(SILO_JOIN),v0=[0,-7*1.4*scale],v1=[(tx-x)/m.flight,(ty-y)/m.flight-Math.cos(SILO_JOIN/m.flight*Math.PI)*Math.PI*h/m.flight];
 return start.map((p,i)=>(2*u**3-3*u*u+1)*p+(u**3-2*u*u+u)*duration*v0[i]+(-2*u**3+3*u*u)*end[i]+(u**3-u*u)*duration*v1[i]);
}
