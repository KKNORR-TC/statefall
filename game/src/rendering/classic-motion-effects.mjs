const air=new Set(['fighter','bomber','carrier','spy']);
// Shared lightweight presentation effects. No simulation state, RNG, timers or particles are owned here.
export function createClassicMotionPainter(){
 let intensity=.8,point=null;
 function dot(c,x,y,r,color,alpha=1){c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.globalAlpha=1;}
function smoke(c,x,y,t,amount=1){if(point)[x,y]=point(x,y);for(let j=0;j<5;j++){const f=(t*.24+j/5)%1;dot(c,x+f*12+Math.sin(j*7)*2,y-f*30,2+f*7,'#a2afaf',(1-f)*.14*intensity*amount);}}
function glow(c,x,y,t){if(point)[x,y]=point(x,y);dot(c,x,y,4,'#80e3d2',(.25+.18*Math.sin(t*2))*intensity);dot(c,x,y,1.2,'#d4fff0',.7*intensity);}
// Anchors measured on the actual cached artwork in 360 x 220 preview coordinates.
// Separate from actor centers: x, y, firing angle, delay within the staged volley.
const muzzleAnchors={
 battery:[[233,116.5,-.08,0]],
 shore:[[124,77,-2.68,0],[123,95,-2.68,.12],[124,77,-2.68,.3],[123,95,-2.68,.42]],
 bertha:[[124.5,89.5,-2.7,0]],
 scout:[[251,96.5,-.03,0]],
 warship:[[237,107,0,0],[237,110,0,.07]],
 battleship:[[233,105,0,0],[233,108,0,.07],[233,111,0,.14]],
 heavytransport:[[147.5,69,-2.9,0]],
 'port:2':[[119,145.5,2.43,0],[204.5,160,2.43,.12]]
};
function muzzleFlash(c,x,y,angle,age,heavy){
 if(age<0||age>2.5)return;
 if(age<.18){const fade=(1-age/.18)*Math.min(1,intensity),length=(heavy?17:11)*(1-age*2);
  c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=fade;
  c.fillStyle='#ffbd66';c.beginPath();c.moveTo(0,0);c.lineTo(length*.5,-3.5);c.lineTo(length,0);c.lineTo(length*.5,3.5);c.closePath();c.fill();
  c.fillStyle='#fff2c7';c.beginPath();c.moveTo(0,0);c.lineTo(length*.65,-1.5);c.lineTo(length*.85,0);c.lineTo(length*.65,1.5);c.closePath();c.fill();c.restore();
 }
 // Smoke starts at the muzzle and drifts in the firing direction before rising.
 for(let j=0;j<4;j++){const a=age-j*.04;if(a<0)continue;const f=Math.min(1,a/2.5),d=f*17;dot(c,x+Math.cos(angle)*d,y+Math.sin(angle)*d-f*12,1+f*(heavy?8:5),'#adb6b5',(1-f)*.12*intensity);}
}

 return function paintMotion(c,{key:k,level=1,time:t=0,age=-100,scale=1,strength=.8,muzzles=null,wingtips=null,unitPoint=null,moving=true,shieldActive=true,nativeActions=false,impact=true}={}){
 intensity=strength;point=unitPoint;const card={level},active=age>=0&&age<2.5,still=false;
 c.save();
  if(!still){if((moving||k==='factory')&&['factory','warship','truck','merchant','heavytransport','privateer','cruiser','battleship'].includes(k))smoke(c,k==='factory'?138:k==='truck'?148:174,k==='factory'?75:k==='truck'?127:107,t,k==='truck'?.35:1);
 if(['factory','radar','rship'].includes(k))glow(c,k==='factory'?200:180,k==='factory'?131:k==='radar'?104:103,t);
 if(moving&&['sub','hunter'].includes(k)){for(let j=0;j<4;j++){const f=(t*.3+j/4)%1;const [x,y]=unitPoint?unitPoint(108-f*14,117):[108-f*14,117];dot(c,x,y,1+f,'#a6d6d9',(1-f)*.22*intensity);}}
 if(air.has(k)){
  // Fixed heading in this study: port is the upper wing, starboard the lower.
  const pulse=Math.pow((1+Math.cos(t*Math.PI*2/1.8))/2,3);
  const brightness=Math.min(1,intensity*(.65+.65*pulse));
  const tips=wingtips||{fighter:[[158,89],[151,142]],bomber:[[139,74],[140,159]],carrier:[[187,82],[181,151]],spy:[[178,75],[176,154]]}[k];
  for(const [i,[x,y]] of tips.entries()){const color=i===0?'#ff5960':'#66e6a0';
    dot(c,x,y,6.5,color,brightness*(.12+.15*pulse));
    dot(c,x,y,2.5,color,brightness);
    dot(c,x,y,1,'#fff5e8',brightness*.8);
  }
 }
 if(shieldActive&&(k==='shield'||k==='airfield'&&card.level===2)){glow(c,180,132,t);c.strokeStyle=`rgba(118,217,237,${(.09+.03*Math.sin(t*1.7))*intensity})`;c.beginPath();c.ellipse(180,139,64,42,0,Math.PI,Math.PI*2);c.stroke();}
 if(active&&scale>.4){const gunPoints=muzzles||muzzleAnchors[k+':'+card.level]||muzzleAnchors[k]||[];for(const [x,y,angle,delay] of gunPoints)muzzleFlash(c,x,y,angle,age-delay,k==='bertha'||k==='battleship');
 if(k==='shield'&&impact){c.strokeStyle=`rgba(131,231,255,${(1-age/2.5)*.65*intensity})`;c.lineWidth=2;c.beginPath();c.ellipse(212,111,4+age*12,5+age*15,-.5,0,Math.PI*2);c.stroke();}
 if(['radar','lradar','rship','hunter','spy','jammer'].includes(k)){c.strokeStyle=`rgba(127,220,204,${(1-age/2.5)*.25*intensity})`;c.beginPath();c.ellipse(180,150,25+age*30,8+age*10,0,0,Math.PI*2);c.stroke();}
 if(['truck','engcmd'].includes(k))for(let j=0;j<6;j++){const f=(age*2+j*.17)%1;const [sx,sy]=unitPoint?unitPoint(211,130):[211,130];dot(c,sx+f*(j%2?9:-8),sy+f*15,1,'#ffda81',(1-f)*intensity);}}
 if(!still){
  if(k==='city'){
   // Window openings traced on the city facade; no free-floating center beacon.
   const banks=[{xs:[135.5,143,150.5],ys:[149,155.5,162]},{xs:[166,179,193],ys:[136,143.5,151,156.5]},{xs:[208,215.5,223],ys:[154.5,161]}];
   banks.forEach((bank,bi)=>bank.ys.forEach((y,row)=>bank.xs.forEach((x,col)=>{
    const local=age-bi*.3-row*.06,lit=active&&local>=0;
    const strength=lit?Math.min(1,local*8)*Math.min(1,(2.5-age)*2):((row+col+bi)%3===0?.22:0);
    if(strength<=0)return;
    c.save();c.globalAlpha=Math.min(1,intensity*strength);c.fillStyle='#ffe2a0';c.shadowColor='#ffce76';c.shadowBlur=lit?5:1;
    c.fillRect(x-1,y-1.6,2,3.2);c.restore();
   })));
  }
  if(k==='command'){
   // Mast indicator and satellite-dish feed measured on the cached command artwork.
   dot(c,173.5,90,1.5,'#a7e9ff',(.4+.18*Math.sin(t*2))*Math.min(1,intensity));
   if(active&&scale>.4){
    for(let j=0;j<3;j++){
     const a=age-j*.5;if(a<0||a>.85)continue;
     const fade=(1-a/.85)*Math.min(1,intensity),travel=a*24;
     c.save();c.translate(197.5,108);c.rotate(-2.25);
     c.strokeStyle='rgba(141,224,255,'+(fade*.8)+')';c.lineWidth=1.8;c.lineCap='round';
     c.beginPath();c.moveTo(travel,0);c.lineTo(travel+5,0);c.stroke();c.restore();
     dot(c,197.5,108,4,'#8de0ff',fade*.25);dot(c,197.5,108,1.6,'#e0f9ff',fade);
    }
   }
  }
  if(k==='flightops'){
   // Glass corners traced on the control tower, independent of the ground-building roof.
   c.save();c.beginPath();c.moveTo(129,95);c.lineTo(146,99);c.lineTo(169,93);c.lineTo(166,106);c.lineTo(147,112);c.lineTo(132,106);c.closePath();c.clip();
   c.fillStyle='rgba(111,215,249,'+((active?.22:.06)*intensity)+')';c.fillRect(127,92,44,22);
   if(active){const x=125+(age/2.5)*52,g=c.createLinearGradient(x-7,0,x+7,0);g.addColorStop(0,'rgba(162,235,255,0)');g.addColorStop(.5,'rgba(194,247,255,'+Math.min(.8,intensity*.65)+')');g.addColorStop(1,'rgba(162,235,255,0)');c.fillStyle=g;c.fillRect(x-7,92,14,22);}
   c.restore();
  }
  if(k==='troopcmd'){
   dot(c,183,104,1.5,'#ffc477',(.4+.2*Math.sin(t*2))*intensity);
   if(active&&scale>.4){c.save();c.lineWidth=1.6;
    for(let j=0;j<3;j++){const a=age-j*.4;if(a<0||a>1.2)continue;const r=3+a*17;c.strokeStyle='rgba(255,198,119,'+((1-a/1.2)*.8*Math.min(1,intensity))+')';c.beginPath();c.arc(183,108,r,-1.2,.4);c.stroke();}
    c.restore();
   }
  }
  if(['port','sam','silo','fort','subbase','engcmd','lradar','jammer','satellite'].includes(k)){glow(c,180,135,t);if(card.level>1||k==='jammer')glow(c,208,146,t+1.5);}
  if(k==='airfield')for(let j=0;j<5;j++)dot(c,145+j*16,178,1.5,'#f7dc9a',(.25+.6*Math.pow((Math.sin(t*2-j*.8)+1)/2,4))*intensity);
  if(['port','subbase'].includes(k)){c.strokeStyle='#88c4cf33';for(let j=0;j<3;j++){const f=(t*.2+j/3)%1;c.beginPath();c.ellipse(180,177,35+f*30,3+f*8,0,0,Math.PI*2);c.stroke();}}
  if(active&&scale>.4){
   if(k==='airfield'){
    // Staged departure signal; the upgraded hangar uses a wider apron layout.
    const level=card.level||1,fade=Math.max(0,1-age/2.5);
    for(let row=0;row<2;row++)for(let j=0;j<6;j++){
     const x=level===2?133+j*18:139+j*16,y=level===2?171+row*10:166+row*12;
     const phase=(age*2.4-j*.16)%1,lit=phase>=0&&phase<.42;
     const a=Math.min(1,intensity)*fade*(lit?1:.22);
     dot(c,x,y,5,'#ffe0a0',a*.3);dot(c,x,y,2.1,'#fff2be',a);
    }
    if(level===2&&impact){c.save();c.strokeStyle='rgba(116,221,255,'+(fade*.65*Math.min(1,intensity))+')';c.lineWidth=2;
     c.beginPath();c.ellipse(180,149,70+age*4,49+age*2,0,Math.PI,Math.PI*2);c.stroke();c.restore();}
   }
   if(k==='fort'){
    const level=card.level||1,fade=Math.max(0,1-age/2.5),wave=(age*1.35)%1;
    c.save();c.strokeStyle='rgba(135,215,255,'+(fade*.7*intensity)+')';c.lineWidth=2.2;
    const w=60+(level-1)*7+wave*14,h=23+(level-1)*3+wave*6;
    c.beginPath();c.moveTo(180,169-h);c.lineTo(180+w,169);c.lineTo(180,169+h);c.lineTo(180-w,169);c.closePath();c.stroke();
    for(let j=0;j<4;j++){const a=Math.max(0,1-Math.abs(age-(.15+j*.22))/.3)*Math.min(1,intensity);const x=180+(j%2?1:-1)*(39+(level-1)*5),y=j<2?122:153;dot(c,x,y,6+level,'#8edbff',a*.35);dot(c,x,y,2.5,'#e2f5ff',a);}
    c.restore();
   }
   if(['sam','silo','satellite','cruiser'].includes(k)){for(let j=0;j<(k==='cruiser'?3:1);j++){const a=age-j*.3;if(a>=0&&a<1.8){smoke(c,176+j*10,110-a*23,a,1-a/1.8);dot(c,176+j*10,110-a*27,2,'#ffcc81',(1-a/1.8)*intensity);}}}
   if(['sub','hunter'].includes(k))for(let j=0;j<6;j++)dot(c,243+age*18-j*4,119,1.3,'#bbe7e8',(1-age/2.5)*.6*intensity);
   if(!nativeActions&&k==='privateer'){c.strokeStyle='#d7c494';c.setLineDash([3,4]);c.beginPath();c.moveTo(192,128);c.lineTo(220+age*7,157);c.stroke();c.setLineDash([]);}
   if(['transport','heavytransport','merchant'].includes(k))for(let j=0;j<3;j++){c.fillStyle='rgba(229,199,136,'+(1-age/2.5)+')';const [cx,cy]=unitPoint?unitPoint(236+age*9-j*5,137+j*3):[236+age*9-j*5,137+j*3];c.fillRect(cx,cy,3,3);}

   if(!nativeActions&&k==='bomber')for(let j=0;j<3;j++){const a=age-j*.3;if(a>=0){c.fillStyle='#c6c3a4';c.fillRect(182-j*8,126+a*21,2,5);}}
   if(!nativeActions&&k==='carrier')for(let j=0;j<3;j++){const a=age-j*.3;if(a>=0){const x=177-j*14,y=140+a*14;c.strokeStyle='#e5e8db';c.beginPath();c.arc(x,y,5,Math.PI,0);c.lineTo(x,y+8);c.closePath();c.stroke();dot(c,x,y+10,1.5,'#bdb8a2');}}
  }
 }
 }c.restore();
 }
}
