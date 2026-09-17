'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};

const server=http.createServer((request,response)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400).end();return;}
  if(pathname==='/'||pathname==='/index.html')pathname='/index.html';
  if(pathname.includes('..')||pathname.includes('\\')||pathname.includes('\0')){response.writeHead(403).end();return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){response.writeHead(error.code==='ENOENT'?404:500).end();return;}
    if(pathname==='/index.html')data=Buffer.from(data.toString('utf8').replaceAll('__STATEFALL_ASSET_BASE__','/'));
    response.writeHead(200,{'Cache-Control':'no-store','Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
const port=Number(process.env.PORT||4174);
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Statefall dist server listening on http://127.0.0.1:${port}\n`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
