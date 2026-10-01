// Local previews mirror the existing site's shared music paths. Score masters
// are not copied into the release ZIP; production already hosts all 16 tracks.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../game/src/audio');
function localScoreMiddleware(request,response,next){
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!pathname.startsWith('/wp-content/uploads/statefall/audio/'))return next();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'approval-manifest.json'),'utf8'));
  const track=manifest.score.find(t=>t.hosted&&new URL(t.hosted.url).pathname===pathname);
  if(!track)return next();
  const file=path.join(root,'assets',track.asset);
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':'audio/ogg','Cache-Control':'no-store'}).end(data);});
}
module.exports={localScoreMiddleware};
