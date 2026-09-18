export function calculateCentroid(W,H,owner,player){
  let sx=0,sy=0,n=0;
  for(let t=0;t<W*H;t+=7) if(owner[t]===player.id){ sx+=t%W; sy+=(t-t%W)/W; n++; }
  return n?[sx/n+.5,sy/n+.5]:[player.sx,player.sy];
}

export function calculatePlayerLabelPositions(W,H,owner,players){
  const N4=[[1,0],[-1,0],[0,1],[0,-1]];
  const idx=(x,y)=>y*W+x,inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const seen=new Uint8Array(W*H),q=new Int32Array(W*H),best={};
  for(let t0=0;t0<W*H;t0++){
    const playerId=owner[t0];
    if(playerId<0||seen[t0]) continue;
    let head=0,tail=0,n=0,sx=0,sy=0;
    q[tail++]=t0;
    seen[t0]=1;
    while(head<tail){
      const tile=q[head++],x=tile%W,y=(tile-x)/W;
      n++;
      sx+=x;
      sy+=y;
      for(const [dx,dy] of N4){
        if(!inb(x+dx,y+dy)) continue;
        const neighbor=idx(x+dx,y+dy);
        if(!seen[neighbor]&&owner[neighbor]===playerId){ seen[neighbor]=1; q[tail++]=neighbor; }
      }
    }
    if(!best[playerId]||n>best[playerId].n) best[playerId]={n,x:sx/n,y:sy/n};
  }
  const positions=[];
  for(const player of players){
    const position=best[player.id];
    if(!position){ positions[player.id]=null; continue; }
    let x=Math.round(position.x),y=Math.round(position.y);
    if(!inb(x,y)||owner[idx(x,y)]!==player.id){
      let found=false;
      for(let radius=1;radius<=60&&!found;radius++){
        for(let dy=-radius;dy<=radius&&!found;dy++) for(let dx=-radius;dx<=radius;dx++){
          if(Math.abs(dx)!==radius&&Math.abs(dy)!==radius) continue;
          const nextX=x+dx,nextY=y+dy;
          if(inb(nextX,nextY)&&owner[idx(nextX,nextY)]===player.id){ x=nextX; y=nextY; found=true; break; }
        }
      }
    }
    positions[player.id]=[x+.5,y+.5];
  }
  return positions;
}
