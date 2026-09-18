import {REGION_MIN,LAND_MIN,CONTINENT_MIN} from './rules.mjs';

const N4=[[1,0],[-1,0],[0,1],[0,-1]];
const SYL=['al','dra','ke','sh','or','mi','van','tor','is','el','ra','no','qu','ith','ar','bel','os','ty','ul','mar'];

export function createMapGeneration({W,H,engineState,settings,setup,MAPS,random,rnd,pick,landCombat}){
  const mapState=engineState.map;
  const {land,region,river,rough,regions}=mapState;
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const {isCoast}=landCombat;

  function genMap(){
    engineState.resetMap();
    const layers=[[18,.5],[36,.5],[72,.6],[144,.7]];
    const grids=layers.map(([s])=>{
      const gw=Math.ceil(W/s)+2, gh=Math.ceil(H/s)+2;
      return {s,gw,gh,v:Float32Array.from({length:gw*gh},()=>random())};
    });
    const smooth=t=>t*t*(3-2*t);
    const n=(x,y)=>{
      let v=0, amp=0;
      grids.forEach((g,i)=>{
        const fx=x/g.s, fy=y/g.s, x0=Math.floor(fx), y0=Math.floor(fy), tx=smooth(fx-x0), ty=smooth(fy-y0);
        const a=g.v[y0*g.gw+x0], b=g.v[y0*g.gw+x0+1], c=g.v[(y0+1)*g.gw+x0], d=g.v[(y0+1)*g.gw+x0+1];
        v+=((a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty)*layers[i][1]; amp+=layers[i][1];
      });
      return v/amp;
    };
    // seed several continents far apart, shape each with noise, sprinkle islands in open ocean
    const GEN={random:{K:[6,8],r:[70,125],gap:18,body:0.7,thr:0.25,isl:0.68},islands_l:{K:[12,16],r:[38,62],gap:14,body:0.75,thr:0.25,isl:0.72},islands_m:{K:[22,30],r:[24,38],gap:10,body:0.8,thr:0.25,isl:0.74},islands_s:{K:[45,65],r:[12,22],gap:7,body:0.9,thr:0.22,isl:0.76}}[settings.map]||{K:[6,8],r:[70,125],gap:18,body:0.7,thr:0.25,isl:0.68};
    const conts=[]; const K=GEN.K[0]+Math.floor(random()*(GEN.K[1]-GEN.K[0]+1));
    for(let tries=0;tries<4000&&conts.length<K;tries++){
      const r=rnd(GEN.r[0],GEN.r[1]), x=rnd(r+6,W-r-6), y=rnd(r+6,H-r-6);
      if(conts.every(c=>Math.hypot(c.x-x,c.y-y)>c.r+r+GEN.gap)) conts.push({x,y,r,ax:rnd(0.75,1.35),rot:rnd(0,Math.PI),a1:rnd(0.12,0.32),k1:2+Math.floor(random()*3),p1:rnd(0,6.28),a2:rnd(0.05,0.18),k2:5+Math.floor(random()*4),p2:rnd(0,6.28)});
    }
    const rn=(()=>{ const L=[[6,.5],[12,.5],[24,.7]]; const gs=L.map(([sz])=>{ const gw=Math.ceil(W/sz)+2, gh=Math.ceil(H/sz)+2; return {sz,gw,v:Float32Array.from({length:gw*gh},()=>random())}; });
      return (x,y)=>{ let v=0,amp=0; gs.forEach((g,i)=>{ const fx=x/g.sz,fy=y/g.sz,x0=Math.floor(fx),y0=Math.floor(fy),tx=smooth(fx-x0),ty=smooth(fy-y0); const a=g.v[y0*g.gw+x0],b=g.v[y0*g.gw+x0+1],c=g.v[(y0+1)*g.gw+x0],d=g.v[(y0+1)*g.gw+x0+1]; v+=((a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty)*L[i][1]; amp+=L[i][1]; }); return v/amp; }; })();
    if(MAPS[settings.map]){ // prebuilt map: decode the country grid
      engineState.setSetupMap(MAPS[settings.map],new Int16Array(W*H)); let i=0; const r=setup.PRESET.rle; for(let k=0;k<r.length;k+=2){ const v=r[k]-1, n=r[k+1]; for(let j=0;j<n;j++) setup.cid[i++]=v; }
      mapState.landCount=0; for(let t=0;t<W*H;t++){ rough[t]=rn(t%W,(t-t%W)/W); if(setup.cid[t]>=0){ land[t]=1; mapState.landCount++; } }
      findRegions(); for(const rg of regions) if(rg.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===rg.id){ land[t]=0; region[t]=-1; mapState.landCount--; } rg.size=0; }
      nameRegionsByContinent(); carveRivers(); cleanupFragments(); return;
    }
    engineState.setSetupMap(null,null);
    if(settings.map==='atoll'){ // a great ring of land around a central lagoon, open sea outside, gaps and lumps from the noise
      const cx=W/2, cy=H/2, ax=W*0.36, ay=H*0.33, rot=rnd(-0.2,0.2), a1=rnd(0.05,0.12), k1=2+Math.floor(random()*3), p1=rnd(0,6.28);
      const chans=[]; { const nC=2+Math.floor(random()*2); const base=rnd(0,6.28); for(let i=0;i<nC;i++) chans.push({a:base+i*6.28/nC+rnd(-0.5,0.5),w:rnd(0.05,0.09)}); } // passages from the sea into the lagoon
      mapState.landCount=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); rough[t]=rn(x,y);
        const ux=x-cx, uy=y-cy; const rx=ux*Math.cos(rot)+uy*Math.sin(rot), ry=-ux*Math.sin(rot)+uy*Math.cos(rot);
        const th=Math.atan2(ry/ay,rx/ax); const e=Math.hypot(rx/ax,ry/ay)*(1+a1*Math.sin(k1*th+p1)); // 1 = ring centerline
        const width=0.22+0.09*Math.sin(3*th+p1*2)+0.07*Math.sin(7*th-p1); // ring thickness varies around the loop
        const ring=1-Math.abs(e-1)/width; // 1 at the centerline, 0 at the edges of the ring
        const v=ring*0.75+n(x,y)*0.45+rough[t]*0.3-0.42;
        const lagoonIsle=e<0.45&&n(x,y)>0.74&&rough[t]>0.5; // a few islets inside the lagoon
        const inChannel=chans.some(c=>{ let d=th-c.a; d=Math.atan2(Math.sin(d),Math.cos(d)); return Math.abs(d)<c.w&&e>0.55; });
        if((v>0.25&&!inChannel)||lagoonIsle){ land[t]=1; mapState.landCount++; } }
      findRegions(); for(const rg of regions) if(rg.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===rg.id){ land[t]=0; region[t]=-1; mapState.landCount--; } rg.size=0; }
      carveRivers(); cleanupFragments(); return;
    }
    if(settings.map==='land'){ // one great landmass: lakes from the noise field, many rivers, no ocean
      mapState.landCount=0; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); rough[t]=rn(x,y); const v=n(x,y); if(v<0.71){ land[t]=1; mapState.landCount++; } }
      findRegions(); for(const rg of regions) if(rg.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===rg.id){ land[t]=0; region[t]=-1; mapState.landCount--; } rg.size=0; }
      // small ponds become land again so lakes are few and large
      { const seen=new Uint8Array(W*H), q=new Int32Array(W*H); for(let t0=0;t0<W*H;t0++){ if(land[t0]||seen[t0]) continue; let h=0,tl=0; q[tl++]=t0; seen[t0]=1; const ch=[t0];
        while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const nn=idx(x+dx,y+dy); if(!land[nn]&&!seen[nn]){ seen[nn]=1; q[tl++]=nn; ch.push(nn); } } }
        if(ch.length<400){ for(const t of ch){ land[t]=1; mapState.landCount++; } } }
        findRegions(); }
      carveRivers(true); cleanupFragments(); return;
    }
    mapState.landCount=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      rough[idx(x,y)]=rn(x,y);
      let best=0, near=1e9;
      for(const c of conts){ const ux=x-c.x, uy=y-c.y; const rx=ux*Math.cos(c.rot)+uy*Math.sin(c.rot), ry=-ux*Math.sin(c.rot)+uy*Math.cos(c.rot); const th=Math.atan2(ry,rx);
        const rr=c.r*(1+c.a1*Math.sin(c.k1*th+c.p1)+c.a2*Math.sin(c.k2*th+c.p2)); // lumpy outline, different for every island
        const d=Math.hypot(rx*c.ax,ry/c.ax); near=Math.min(near,d-rr); const f=1-d/rr; if(f>best) best=f; }
      const nv=n(x,y);
      let v=best*GEN.body+nv*0.45+rough[idx(x,y)]*0.3-0.28;
      if(near>12&&nv>GEN.isl) v=1;
      if(v>GEN.thr){land[idx(x,y)]=1;mapState.landCount++;}
    }
    findRegions();
    for(const r of regions) if(r.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===r.id){ land[t]=0; region[t]=-1; mapState.landCount--; } r.size=0; }
    carveRivers(); cleanupFragments();
  }
  function cleanupFragments(){
    { // fragments the rivers cut off (or created mid-stream) that are too small to matter become water
      const seen=new Uint8Array(W*H), q=new Int32Array(W*H);
      for(let t0=0;t0<W*H;t0++){ if(!land[t0]||seen[t0]) continue; let h=0,tl=0; q[tl++]=t0; seen[t0]=1; const chunk=[t0];
        while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&!seen[n]){ seen[n]=1; q[tl++]=n; chunk.push(n); } } }
        if(chunk.length<LAND_MIN) for(const t of chunk){ land[t]=0; river[t]=1; mapState.landCount--; if(region[t]>=0) regions[region[t]].size--; } }
    }
  }
  function nameRegionsByContinent(){ // on real maps, landmasses take the name of the continent most of their countries belong to
    const used={};
    for(const rg of regions){ if(rg.size<REGION_MIN) continue; const tally={}; for(let t=0;t<W*H;t+=3){ if(region[t]!==rg.id||setup.cid[t]<0) continue; const c=setup.PRESET.cont[setup.cid[t]]||'Land'; tally[c]=(tally[c]||0)+1; }
      let best='Land',bn=0; for(const k in tally) if(tally[k]>bn){bn=tally[k];best=k;} used[best]=(used[best]||0)+1; rg.name=used[best]>1?`${best} (${used[best]})`:best; rg.cont=rg.size>=CONTINENT_MIN; }
  }
  function regionName(cont){ let n=''; const k=2+Math.floor(random()*2); for(let i=0;i<k;i++) n+=pick(SYL); n=n[0].toUpperCase()+n.slice(1); return cont?n:'Isle of '+n; }
  function findRegions(){ // flood-fill landmasses
    region.fill(-1); regions.length=0; const q=new Int32Array(W*H);
    for(let t0=0;t0<W*H;t0++){ if(!land[t0]||region[t0]>=0) continue;
      const id=regions.length; let h=0,tl=0; q[tl++]=t0; region[t0]=id; let size=0, sx=0, sy=0;
      while(h<tl){ const c=q[h++]; size++; sx+=c%W; sy+=(c-c%W)/W; const x=c%W,y=(c-x)/W;
        for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&region[n]<0){region[n]=id;q[tl++]=n;} } }
      regions.push({id,size,cx:sx/size,cy:sy/size,cont:size>=CONTINENT_MIN,name:''});
    }
    for(const r of regions) if(r.size>=REGION_MIN) r.name=regionName(r.cont);
  }
  function carveRivers(landMode){
    for(const r of regions){ if(!r.cont) continue;
      const coast=[]; for(let t=0;t<W*H;t+=2){ if(region[t]!==r.id||!land[t]) continue; const x=t%W,y=(t-x)/W; if(isCoast(t)||(landMode&&(x<2||y<2||x>=W-2||y>=H-2))) coast.push(t); }
      if(coast.length<20) continue;
      const count=landMode?Math.min(14,4+Math.floor(r.size/12000)):Math.min(3,1+Math.floor(r.size/9000));
      for(let k=0;k<count;k++){
        const A=pick(coast); const ax=A%W,ay=(A-ax)/W; let B=A,bd=0;
        for(let i=0;i<40;i++){ const c=pick(coast); const d=(c%W-ax)**2+((c-c%W)/W-ay)**2; if(d>bd){bd=d;B=c;} }
        const bx=B%W,by=(B-bx)/W, L=Math.hypot(bx-ax,by-ay); if(L<60) continue;
        const nx=-(by-ay)/L, ny=(bx-ax)/L, a1=rnd(8,22), a2=rnd(3,8), f1=rnd(1,2.5), f2=rnd(4,7), p1=rnd(0,6.28), p2=rnd(0,6.28);
        for(let i=0;i<=L;i+=0.7){ const u=i/L, off=a1*Math.sin(u*Math.PI*f1+p1)*Math.sin(u*Math.PI)+a2*Math.sin(u*Math.PI*f2+p2);
          const x=ax+(bx-ax)*u+nx*off, y=ay+(by-ay)*u+ny*off;
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const X=Math.round(x+dx),Y=Math.round(y+dy); if(!inb(X,Y)) continue; if(dx*dx+dy*dy>1.5) continue;
            const t=idx(X,Y); if(land[t]){ land[t]=0; river[t]=1; mapState.landCount--; regions[region[t]].size--; } } }
      }
    }
  }

  return Object.freeze({genMap,cleanupFragments,nameRegionsByContinent,findRegions,carveRivers,regionName});
}
