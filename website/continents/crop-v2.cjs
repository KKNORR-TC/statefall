// Crop actual gameplay screenshots only; no terrain retouching or compositing.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('canvas');
const root=process.argv[2];
if(!root)throw Error('Pass the directory containing terrain-v2-*-source.png captures');
(async()=>{
  for(const [source,name,x,y,w,h] of [
    ['coast','continents-coast-v2',450,0,2100,1180],
    ['detail','continents-rivers-v2',650,720,1600,1000]
  ]){
    const img=await loadImage(path.join(root,`terrain-v2-${source}-source.png`));
    if(img.width!==2880||img.height!==1800)throw Error('Unexpected capture dimensions');
    const canvas=createCanvas(w,h);canvas.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);
    fs.writeFileSync(path.join(__dirname,'assets',name+'.jpg'),canvas.toBuffer('image/jpeg',{quality:.94}));
  }
})();
