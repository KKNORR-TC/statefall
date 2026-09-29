import {paintSilo} from './classic-silo-sequence.mjs';
// Pure Canvas presentation: fixed geometry and bounded draw counts, no simulation RNG.
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
function ellipse(c,x,y,rx,ry,color,alpha=1){c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);c.fill();}
const puffTextures=new Map();
function puffTexture(hot){if(puffTextures.has(hot))return puffTextures.get(hot);const cv=typeof OffscreenCanvas==='function'?new OffscreenCanvas(128,128):document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),im=c.createImageData(128,128);
 const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=ease(x-ix),fy=ease(y-iy);return (hash(ix,iy)*(1-fx)+hash(ix+1,iy)*fx)*(1-fy)+(hash(ix,iy+1)*(1-fx)+hash(ix+1,iy+1)*fx)*fy;};
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const dx=(x-64)/64,dy=(y-64)/64,r=Math.hypot(dx,dy),n=noise(x/21,y/21)*.55+noise(x/9+19,y/9)*.28+noise(x/3,y/3+7)*.17,density=clamp((1-r)*3+(n-.55)*1.4),shade=clamp(n*.85+.18-dy*.12),i=(y*128+x)*4;im.data[i]=hot?180+shade*75:66+shade*114;im.data[i+1]=hot?65+shade*153:65+shade*106;im.data[i+2]=hot?18+shade*87:61+shade*91;im.data[i+3]=Math.round(density*235);}
 c.putImageData(im,0,0);puffTextures.set(hot,cv);return cv;}
function cloud(c,x,y,rx,ry,hot,alpha){c.save();c.translate(x,y);c.rotate(Math.sin(x*7+y*3)*.8);c.globalAlpha=clamp(alpha);const heat=Number(hot);c.drawImage(puffTexture(false),-rx,-ry,rx*2,ry*2);if(heat>0){c.globalAlpha=clamp(alpha)*clamp(heat);c.drawImage(puffTexture(true),-rx,-ry,rx*2,ry*2);}c.restore();}

function rocket(c,x,y,angle,size,thrust,alpha){c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);c.globalAlpha=alpha;
 const body=c.createLinearGradient(0,-4,0,4);body.addColorStop(0,'#6d7c83');body.addColorStop(.35,'#f0ede0');body.addColorStop(.7,'#b1bebf');body.addColorStop(1,'#45515a');c.fillStyle=body;c.beginPath();c.moveTo(19,0);c.lineTo(8,-3.8);c.lineTo(-15,-3.8);c.lineTo(-18,-7);c.lineTo(-21,-7);c.lineTo(-18,0);c.lineTo(-21,7);c.lineTo(-18,7);c.lineTo(-15,3.8);c.lineTo(8,3.8);c.closePath();c.fill();c.fillStyle='#619bbd';c.fillRect(3,-3.8,3,7.6);c.fillStyle='#26343e';c.fillRect(-14,-3.8,2,7.6);
 if(thrust>0){const g=c.createLinearGradient(-16,0,-16-thrust,0);g.addColorStop(0,'#fffce5');g.addColorStop(.3,'#ffe598');g.addColorStop(.65,'#ff8d31');g.addColorStop(1,'rgba(220,57,14,0)');c.fillStyle=g;c.beginPath();c.moveTo(-16,-4);c.quadraticCurveTo(-25,-8,-16-thrust,0);c.quadraticCurveTo(-25,8,-16,4);c.fill();}c.restore();}
export function paintLaunch(c,{kind,age,strength=1}={}){
 if(kind==='silo'){if(age>=0&&age<9)paintSilo(c,{age});return;}
 if(!['silo','sam'].includes(kind)||!Number.isFinite(age)||age<0||age>3.2)return;
 c.save();const fade=clamp((3.2-age)/1.2)*Math.min(1,strength);
 {const x=190,y=73,angle=-.95,travel=age*125+age*age*80;
  for(let j=0;j<14;j++){const a=age-j*.035;if(a<0)continue;const d=Math.min(travel,j*8);cloud(c,x+Math.cos(angle)*d,y+Math.sin(angle)*d,5+a*11,5+a*8,a<.15,fade*.56*clamp(1-age/2.4));}
  for(let j=0;j<6;j++)cloud(c,157+Math.cos(j*2.2)*age*19,124+Math.sin(j*2.2)*age*7,5+age*8,4+age*5,age<.2,fade*.55);
  if(age<.75)rocket(c,x+Math.cos(angle)*travel,y+Math.sin(angle)*travel,angle,.72,30,clamp((.75-age)/.2));
 }c.restore();
}
export function paintMushroomCloud(c,{x,y,radius,age,reducedMotion=false}={}){
 if(![x,y,radius,age].every(Number.isFinite)||radius<=0||age<0||age>=9)return;
 c.save();c.translate(x,y);c.scale(radius/100,radius/100);
 const a=reducedMotion?3:age,growth=ease((a-.2)/3),fade=clamp((9-age)/2.8),rise=18+growth*115,cap=18+growth*71;
 ellipse(c,0,8,30+growth*77,10+growth*23,'#302c27',fade*.35);
 if(!reducedMotion&&a<1.5){const f=clamp(a/1.5);c.strokeStyle='rgba(245,209,153,'+((1-f)*.75)+')';c.lineWidth=4*(1-f)+1;c.beginPath();c.ellipse(0,0,12+f*150,5+f*54,0,0,TAU);c.stroke();cloud(c,0,-12,18+a*47,18+a*40,true,(1-f)*.95);}
 for(let j=0;j<18;j++){const theta=j*2.4,r=24+growth*64;cloud(c,Math.cos(theta)*r,Math.sin(theta)*r*.27+6,14+growth*12,9+growth*7,false,fade*.42);}
 cloud(c,0,-rise*.56,24+growth*9,rise*.58,clamp((3-a)/1.7),fade*.85);
 cloud(c,0,-rise-9,cap,cap*.45,clamp((3.4-a)/1.8),fade);
 for(let j=0;j<16;j++){const f=j/15;cloud(c,Math.sin(j*2.1+a*.7)*(4+f*7),-rise*f,13+f*11+growth*5,15+growth*10,clamp((3-a)/1.7),fade*(.7+.2*f));}
 for(let row=0;row<3;row++)for(let j=0;j<13;j++){const u=(j-6)/6,arch=Math.sqrt(Math.max(0,1-u*u)),curl=Math.sin(j*2.7+a*.65)*3;cloud(c,u*cap*.86,-rise-row*9-arch*cap*.23+curl,cap*(.25+row*.03+Math.sin(j*4)*.05),cap*(.26+row*.025+Math.cos(j*3)*.05),clamp((3.4-a)/1.8),fade*(row===0?.7:.94));}
 if(a<3.6)ellipse(c,0,-rise+cap*.13,cap*.65,cap*.12,'#ee9e53',clamp((3.6-a)/3.6)*.3*fade);
 c.restore();
}
export function createNuclearCloudLayer(){
 let events=[],last=null,tick=-1;
 return {reset(){events=[];last=null;tick=-1;},add(value){if(![value.x,value.y,value.r].every(Number.isFinite))return;events.push({x:value.x,y:value.y,r:value.r,age:0});if(events.length>16)events.shift();},count:()=>events.length,
 render(c,{now,tick:nextTick,paused,camera,width,height,reducedMotion=false,visible=()=>true}){if(nextTick<tick){events=[];last=null;}const dt=last===null||paused?0:Math.max(0,Math.min(.1,(now-last)/1000));last=now;tick=nextTick;for(const e of events){e.age+=dt;const x=camera.x+(e.x+.5)*camera.s,y=camera.y+(e.y+.5)*camera.s,r=e.r*camera.s;if(!visible(e.x,e.y)||x+r*2<0||x-r*2>width||y+r<0||y-r*2.5>height)continue;paintMushroomCloud(c,{x,y,radius:r,age:e.age,reducedMotion});}events=events.filter(e=>e.age<9);}}
}
