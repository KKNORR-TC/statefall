// Layered raster artwork; timing and exhaust remain presentation-only.
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export function siloSequence(age){const active=Number.isFinite(age)&&age>=0&&age<9,t=active?age:0;return {phase:!active||t<.8?'Closed':t<2?'Opening hatch':t<3.5?'Raising missile':t<4.3?'Ready to fire':t<4.65?'Ignition':t<6.4?'Lift-off':t<7?'Exhaust clearing':'Closing hatch',open:ease((t-.8)/1.2)*(1-ease((t-7)/1.5)),rise:ease((t-2)/1.5),flight:Math.max(0,t-4.65),ignition:active&&t>=4.3&&t<6.4,smoke:active&&t>=4.3&&t<8,active,t};}
let artwork=null,loading=null,jet=null,smoke=null;
export function loadSiloArt(){return loading??=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{artwork=image;resolve();};image.onerror=()=>{loading=null;reject(new Error('Silo artwork failed to load'));};image.src=new URL('./classic-assets/silo-layered-v2.png',import.meta.url).href;});}
const hash=(x,y)=>{const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);};
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),a=ease(x-ix),b=ease(y-iy);return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b;}
function textures(){if(jet)return;jet=document.createElement('canvas');jet.width=96;jet.height=256;smoke=document.createElement('canvas');smoke.width=smoke.height=96;
 for(const [cv,isJet] of [[jet,true],[smoke,false]]){const c=cv.getContext('2d'),im=c.createImageData(cv.width,cv.height);for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const u=(x-cv.width/2)/(cv.width/2),v=y/cv.height,n=noise(x/17,y/17)*.55+noise(x/7+19,y/7)*.3+noise(x/2,y/2)*.15,i=(y*cv.width+x)*4;
 if(isJet){const width=.22+.32*Math.sin(v*3.1),edge=Math.abs(u)/width,alpha=clamp((1-edge)*2.4+(n-.5)*.9)*Math.pow(1-v,1.1),core=clamp(1-edge*1.7)*(1-v);im.data[i]=255;im.data[i+1]=120+core*135+n*15;im.data[i+2]=40+core*215;im.data[i+3]=alpha*245;}else{const r=Math.hypot(u,(y-48)/48),alpha=clamp((1-r)*2+(n-.5)*1.3);im.data[i]=im.data[i+1]=im.data[i+2]=115+n*95;im.data[i+3]=alpha*155;}}
 c.putImageData(im,0,0);}}
export function paintSilo(c,{age=-1}={}){if(!artwork)return;const q=siloSequence(age);textures();c.save();
 const part=(sx,sy,sw,sh,x,y,w,h)=>c.drawImage(artwork,sx,sy,sw,sh,x,y,w,h);
 // Weathered ring, recessed shaft, pipework and controls from the approved-style sprite.
 part(38,147,573,419,115,99,130,95);
 // Register the hatch hub to the shaft center, not the padded sprite rectangle.
 // Both leaves share this datum so the seam stays centered throughout travel.
 for(const side of [-1,1]){c.save();c.translate(side*q.open*44,0);c.beginPath();c.rect(side<0?129.5:179.5,95,50,90);c.clip();part(741,198,417,314,133.2,103.5,92,65);c.restore();}
 if(q.t>=2&&q.t<6.4){const lift=q.flight*70+q.flight*q.flight*120,base=278-q.rise*121-lift,top=base-112;
 c.save();c.beginPath();c.rect(0,-800,360,944);c.ellipse(180,144,39,21,0,0,Math.PI*2);c.clip();
 // Silver body, original pointed nose and blue band are preserved in the separate missile layer.
 part(235,648,141,527,165,top,30,112);
 if(q.ignition){const f=q.t-4.3,len=25+Math.min(75,f*70);c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.72;for(let j=0;j<3;j++){const ripple=Math.sin(q.t*23+j*2);c.drawImage(jet,174+ripple*.65,base-3,12+j*3,len*(1+j*.13));}c.restore();}
 c.restore();
 // Front lip is drawn over the elevator and exhaust so the missile emerges from inside the shaft.
 c.save();c.beginPath();c.rect(110,157,145,43);c.clip();part(38,147,573,419,115,99,130,95);c.restore();
 }
 if(q.smoke){const a=q.t-4.3,fade=clamp((8-q.t)/1.7);for(let j=0;j<16;j++){const theta=j*2.4,r=8+a*18,x=180+Math.cos(theta)*r,y=155+Math.sin(theta)*r*.27,sz=10+a*7;c.save();c.translate(x,y);c.rotate(Math.sin(j*7)*.4);c.globalAlpha=fade*.48;c.drawImage(smoke,-sz,-sz*.65,sz*2,sz*1.3);c.restore();}}
 c.restore();}
