const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const feedback=require('./feedback-store.cjs');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.wav':'audio/wav','.ogg':'audio/ogg'};
http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
 if(name==='/feedback'){
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method==='GET'){try{return reply(200,feedback.get(root));}catch{return reply(500,{error:'Could not read saved feedback.'});}}
  if(req.method!=='POST')return reply(405,{error:'Method not allowed.'});
  if(req.headers.host!=='127.0.0.1:4187'||req.headers.origin!=='http://127.0.0.1:4187'||req.headers['content-type']!=='application/json')return reply(403,{error:'Submit feedback from the local field test.'});
  let body='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size<=65536)body+=chunk;});req.on('end',()=>{if(size>65536)return reply(413,{error:'Feedback is too large.'});try{reply(200,feedback.submit(root,JSON.parse(body)));}catch(e){reply(409,{error:e.message});}});return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let file;
 if(name.startsWith('/score/')){
   let tracks;try{tracks=JSON.parse(fs.readFileSync(path.join(root,'score-library.json'),'utf8')).tracks;}catch{res.writeHead(503);return res.end();}
   const row=tracks.find(t=>t.id===name.slice(7));if(!row||path.basename(row.file)!==row.file){res.writeHead(404);return res.end();}
   file=path.resolve(root,'../../../audio tracks',row.file);
 }else{file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}}
 fs.stat(file,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
   let start=0,end=stat.size-1,status=200;const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
   if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}
     if(!m[1])start=Math.max(0,stat.size-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
     if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}
     status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
   }
   headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();
   const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 });
}).listen(4187,'127.0.0.1',()=>console.log('Statefall audio audition: http://127.0.0.1:4187'));
