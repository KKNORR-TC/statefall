// Crop and resize actual simulator captures; never retouch game art.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('canvas');
const captures=require('./captures.json');
const source=process.argv[2];
if(!source)throw Error('Pass the raw capture directory');
const out=path.join(__dirname,'assets');fs.mkdirSync(out,{recursive:true});
async function crop(file,name,box,width){
 const img=await loadImage(path.join(source,file+'.png'));
 if(img.width!==2560||img.height!==1600)throw Error('Unexpected source dimensions: '+file);
 const [x,y,w,h]=box;if(x<0||y<0||x+w>img.width||y+h>img.height)throw Error('Invalid crop '+name);
 const c=createCanvas(width,Math.round(width*h/w));c.getContext('2d').drawImage(img,x,y,w,h,0,0,c.width,c.height);
 fs.writeFileSync(path.join(out,name+'.jpg'),c.toBuffer('image/jpeg',{quality:.9}));return c;
}
(async()=>{
 const sheet=createCanvas(1200,Math.ceil(captures.length/3)*260),ctx=sheet.getContext('2d');ctx.fillStyle='#101c28';ctx.fillRect(0,0,sheet.width,sheet.height);
 for(const [i,m]of captures.entries()){
  const main=await crop(m.slug+'-detail',m.slug+'-terrain-v3',m.main,1800);
  await crop(m.slug+'-detail',m.slug+'-tile-v3',m.main,600);
  await crop(m.slug+'-detail',m.slug+'-close-v3',m.detail,1200);
  await crop(m.slug+'-overview',m.slug+'-overview-v3',m.overview,1280);
  const x=(i%3)*400,y=Math.floor(i/3)*260;ctx.drawImage(main,x,y,400,225);ctx.fillStyle='#ffffff';ctx.font='18px sans-serif';ctx.fillText(m.name,x+12,y+248);
 }
 await crop('homepage-garrisons','homepage-garrisons-v3',[170,340,1800,1125],1600);
 await crop('homepage-help','homepage-help-v3',[850,125,860,485],860);
 fs.writeFileSync(path.join(source,'terrain-contact-sheet.jpg'),sheet.toBuffer('image/jpeg',{quality:.9}));
 console.log('Prepared 46 gameplay image assets.');
})();
