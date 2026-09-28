// Inspect alpha components and emit crop metadata; never modifies source artwork.
const {loadImage,createCanvas}=require('canvas'),fs=require('fs'),path=require('path');
async function frames(file,{rows=2,count=8}={}){
 const im=await loadImage(file),c=createCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);
 const d=ctx.getImageData(0,0,im.width,im.height).data,seen=new Uint8Array(im.width*im.height),parts=[];
 for(let i=0;i<seen.length;i++){
  if(seen[i]||d[i*4+3]<40)continue;
  const q=[i];seen[i]=1;let x0=im.width,y0=im.height,x1=0,y1=0;
  for(let j=0;j<q.length;j++){const n=q[j],x=n%im.width,y=Math.floor(n/im.width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(const z of [x?n-1:-1,x+1<im.width?n+1:-1,n-im.width,n+im.width])if(z>=0&&z<seen.length&&!seen[z]&&d[z*4+3]>=40){seen[z]=1;q.push(z);}
  }
  if(q.length>2000)parts.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1});
 }
 parts.sort((a,b)=>Math.floor((a.y+a.h/2)/(im.height/rows))-Math.floor((b.y+b.h/2)/(im.height/rows))||a.x-b.x);
 if(parts.length!==count)throw new Error(file+': expected '+count+' separate sprites, found '+parts.length);
 return {width:im.width,height:im.height,referenceWidth:parts[0].w,frames:parts.map((p,i)=>{const x=Math.max(0,p.x-4),y=Math.max(0,p.y-4),bottom=Math.min(im.height,p.y+p.h+4);return [x,y,Math.min(im.width,p.x+p.w+4)-x,bottom-y,p.x+p.w/2,p.y+p.h*([.75,.65,.59,.65,.75,.63,.59,.63][i%8])];})};
}
module.exports={frames};
if(require.main===module)(async()=>{const result={};for(const file of process.argv.slice(2)){const id=path.basename(file,'-directions.png');result[id]=await frames(file);}console.log(JSON.stringify(result,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
