export const MAX_MAP_LABEL_ENTRIES=4096;
export const MAX_MAP_LABEL_LABELS=12288;
export const MAX_MAP_LABEL_CHARS=131072;
export const MAX_MAP_LABEL_CONTAINERS=4096;
export const MAX_MAP_LABEL_IDLE_CONTAINERS=512;
export const MAX_MAP_LABEL_SPRITES=12288;
export const MAX_MAP_LABEL_IDLE_SPRITES=1536;
export const MAX_MAP_LABEL_TEXTURES=4096;
export const MAX_MAP_LABEL_SOURCE_BYTES=64*1024*1024;

const finite=value=>Number.isFinite(Number(value));
const color=value=>typeof value==='string'&&value.length>0;
const fontSize=font=>Math.max(1,Number(/([0-9]+(?:\.[0-9]+)?)px/.exec(font)?.[1])||10);
const validFlag=flag=>{ if(!Array.isArray(flag?.layers)||flag.layers.length>256||flag.layers.some(layer=>!Array.isArray(layer)||layer.length>64)) return false; try{ return JSON.stringify(flag).length<=65536; }catch{ return false; } };
const freezeLayers=layers=>Object.freeze(layers.map(layer=>Object.freeze({...layer})));
const textLabel=(kind,key,x,y,text,font,align,baseline,layers)=>{ const size=fontSize(font),stroke=Math.max(0,...layers.map(layer=>Number(layer.width)||0)),halfWidth=Math.max(size,size*String(text).length)*1.25+stroke+2,height=size*2+stroke+2; return Object.freeze({kind,key,x,y,text,font,align,baseline,layers:freezeLayers(layers),fontSize:size,bounds:Object.freeze({left:x-halfWidth,top:y-height,right:x+halfWidth,bottom:y+height})}); };

function inheritedState(input){
  const value=input?.inheritedCanvasState||{};
  return {globalAlpha:finite(value.globalAlpha)?Number(value.globalAlpha):1,lineJoin:['round','bevel'].includes(value.lineJoin)?value.lineJoin:'miter',lineCap:['round','square'].includes(value.lineCap)?value.lineCap:'butt',lineDash:Array.isArray(value.lineDash)?value.lineDash.map(Number):[],lineDashOffset:finite(value.lineDashOffset)?Number(value.lineDashOffset):0,lineWidth:finite(value.lineWidth)&&Number(value.lineWidth)>=0?Number(value.lineWidth):1,strokeStyle:color(value.strokeStyle)?value.strokeStyle:'#000000',fillStyle:color(value.fillStyle)?value.fillStyle:'#000000',font:typeof value.font==='string'?value.font:'10px sans-serif',textAlign:['left','right','center','start','end'].includes(value.textAlign)?value.textAlign:'start',textBaseline:['top','hanging','middle','alphabetic','ideographic','bottom'].includes(value.textBaseline)?value.textBaseline:'alphabetic'};
}

function applyState(context,state){
  context.globalAlpha=state.globalAlpha; context.lineJoin=state.lineJoin; context.lineCap=state.lineCap; context.setLineDash(state.lineDash); context.lineDashOffset=state.lineDashOffset; context.lineWidth=state.lineWidth; context.strokeStyle=state.strokeStyle; context.fillStyle=state.fillStyle; context.font=state.font; context.textAlign=state.textAlign; context.textBaseline=state.textBaseline;
}

function validate(input){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},draftPicks=Array.isArray(input?.draftPicks)?input.draftPicks:[],areas=Array.isArray(input?.areas)?input.areas:[];
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!finite(input?.now)||!finite(input?.draftDoneAt)||!Number.isSafeInteger(input?.meId)) throw new TypeError('invalid map label source');
  if(typeof input?.draftActive!=='boolean'||typeof input?.garrisonEnabled!=='boolean'||!Number.isInteger(input?.hoverArea)) throw new TypeError('invalid map label state');
  for(const pick of draftPicks) if(!pick||!Number.isSafeInteger(pick.owner)||!Number.isSafeInteger(pick.n)||pick.n<1||!finite(pick.x)||!finite(pick.y)||(pick.player&&(!color(pick.player.color)||typeof pick.player.name!=='string'||!validFlag(pick.player.flag)))) throw new TypeError('invalid draft label source');
  for(const area of areas) if(!area||!Number.isSafeInteger(area.id)||!finite(area.cx)||!finite(area.cy)||!finite(area.troops)||!finite(area.tiles)) throw new TypeError('invalid garrison label source');
  return {camera,viewport,draftPicks,areas};
}

export function formatMapLabelNumber(value){ const n=Math.round(value); return n>=1e9?(n/1e9).toFixed(1)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(0)+'k':n>=1000?(n/1000).toFixed(1)+'k':String(n); }

export function paintMapLabelsCanvas(context,input,{drawFlag,onlyKind=null}={}){
  const {camera,draftPicks,areas}=validate(input),state=inheritedState(input),order=[]; applyState(context,state);
  const showDraft=draftPicks.length&&(input.draftActive||Number(input.now)-Number(input.draftDoneAt)<25000);
  if(showDraft){
    const fadeA=input.draftActive?1:Math.max(0,1-(Number(input.now)-Number(input.draftDoneAt)-18000)/7000); context.globalAlpha=fadeA; state.globalAlpha=fadeA;
    for(const d of draftPicks){ const p=d.player; if(!p) continue; const px=camera.x+Number(d.x)*camera.scale,py=camera.y+Number(d.y)*camera.scale,fw=Math.max(22,Math.min(40,camera.scale*6)),fh=fw*2/3;
      if(!onlyKind||onlyKind==='draft-flag'){ if(typeof drawFlag!=='function') throw new TypeError('missing map label flag painter'); order.push('draft-flag'); drawFlag(context,p.flag,px-fw/2,py-fh/2,fw,fh); context.strokeStyle=d.owner===input.meId?'#ffd27a':'rgba(255,255,255,.7)'; context.lineWidth=d.owner===input.meId?2.5:1.5; context.strokeRect(px-fw/2,py-fh/2,fw,fh); }
      if(!onlyKind||onlyKind==='draft-pick'){ order.push('draft-pick'); context.fillStyle=p.color; context.beginPath(); context.arc(px+fw/2,py-fh/2,Math.max(8,fw*.32),0,Math.PI*2); context.fill(); context.strokeStyle='#0f1a26'; context.lineWidth=1.5; context.stroke(); context.fillStyle='#fff'; context.font=`bold ${Math.max(10,fw*.36)}px "Segoe UI",system-ui,sans-serif`; context.textAlign='center'; context.textBaseline='middle'; context.fillText(String(d.n),px+fw/2,py-fh/2+.5); context.textBaseline='alphabetic'; }
      else { context.strokeStyle='#0f1a26'; context.lineWidth=1.5; context.fillStyle='#fff'; context.font=`bold ${Math.max(10,fw*.36)}px "Segoe UI",system-ui,sans-serif`; context.textAlign='center'; context.textBaseline='alphabetic'; }
      if(camera.scale>=.9&&(!onlyKind||onlyKind==='draft-owner')){ order.push('draft-owner'); context.font=`bold ${Math.max(10,Math.min(14,camera.scale*2.6))}px "Segoe UI",system-ui,sans-serif`; context.fillStyle='#fff'; context.strokeStyle='rgba(0,0,0,.7)'; context.lineWidth=3; const text=d.owner===input.meId?'You':p.name; context.strokeText(text,px,py+fh/2+13); context.fillText(text,px,py+fh/2+13); }
    }
    context.globalAlpha=1; state.globalAlpha=1;
  }
  if(input.garrisonEnabled&&areas.length>1&&camera.scale>=.9){ context.font='bold 12px "Segoe UI",system-ui,sans-serif'; context.textAlign='center'; context.lineWidth=3; for(let index=0;index<areas.length;index++){ const a=areas[index]; if(a.tiles<20&&index!==0) continue; const text=formatMapLabelNumber(a.troops)+' ⚑',px=camera.x+Number(a.cx)*camera.scale,py=camera.y+Number(a.cy)*camera.scale+16; if(!onlyKind||onlyKind==='garrison-count'){ order.push('garrison-count'); context.strokeStyle=input.hoverArea===a.id?'rgba(255,210,122,.9)':'rgba(0,0,0,.6)'; context.fillStyle='#fff'; context.strokeText(text,px,py); context.fillText(text,px,py); } } }
  return Object.freeze(order);
}

export function createMapLabelLayerModel(){
  const build=(input,limits={})=>{
    const {camera,viewport,draftPicks,areas}=validate(input),maximum={entries:limits.entries??MAX_MAP_LABEL_ENTRIES,labels:limits.labels??MAX_MAP_LABEL_LABELS,chars:limits.chars??MAX_MAP_LABEL_CHARS};
    for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid map label ${name} cap`);
    const canvasState=inheritedState(input),entries=[],labels=[],keys=new Set(),counts={draftPicks:draftPicks.length,draftEntries:0,garrisonAreas:areas.length,garrisonEntries:0,labels:0,visibleLabels:0,chars:0,culled:0},showDraft=draftPicks.length&&(input.draftActive||Number(input.now)-Number(input.draftDoneAt)<25000),intersects=bounds=>bounds.right>=-1&&bounds.bottom>=-1&&bounds.left<=viewport.width+1&&bounds.top<=viewport.height+1,claim=key=>{ if(keys.has(key)) throw new TypeError('duplicate map label stable key'); keys.add(key); },addEntry=(key,category,order,items)=>{ counts.labels+=items.length; counts.chars+=items.reduce((sum,label)=>sum+(label.text?.length||0),0); if(counts.draftEntries+counts.garrisonEntries+1>maximum.entries) throw new RangeError('entry-cap'); if(counts.labels>maximum.labels) throw new RangeError('label-cap'); if(counts.chars>maximum.chars) throw new RangeError('char-cap'); const visible=items.filter(item=>intersects(item.bounds)); counts.culled+=items.length-visible.length; if(!visible.length) return; entries.push(Object.freeze({key,category,order,items:Object.freeze(visible)})); labels.push(...visible); };
    let order=0;
    if(showDraft){ const alpha=input.draftActive?1:Math.max(0,1-(Number(input.now)-Number(input.draftDoneAt)-18000)/7000); canvasState.globalAlpha=alpha;
      for(const d of draftPicks){ const key=`draft:${d.owner}:${d.n}`; claim(key); const p=d.player; if(!p) continue; const px=camera.x+Number(d.x)*camera.scale,py=camera.y+Number(d.y)*camera.scale,fw=Math.max(22,Math.min(40,camera.scale*6)),fh=fw*2/3,items=[],pickText=String(d.n),pickFont=`bold ${Math.max(10,fw*.36)}px "Segoe UI",system-ui,sans-serif`,flagPad=Math.ceil((d.owner===input.meId?2.5:1.5)/2+1),pickRadius=Math.max(8,fw*.32),pickX=px+fw/2,pickY=py-fh/2;
        items.push(Object.freeze({kind:'draft-flag',key:`${key}:flag`,x:px,y:py,alpha,width:fw,height:fh,flag:p.flag,stroke:d.owner===input.meId?'#ffd27a':'rgba(255,255,255,.7)',strokeWidth:d.owner===input.meId?2.5:1.5,bounds:Object.freeze({left:px-fw/2-flagPad,top:py-fh/2-flagPad,right:px+fw/2+flagPad,bottom:py+fh/2+flagPad})}));
        items.push(Object.freeze({kind:'draft-pick',key:`${key}:pick`,x:pickX,y:pickY,alpha,radius:pickRadius,badgeColor:p.color,text:pickText,font:pickFont,align:'center',baseline:'middle',layers:freezeLayers([{operation:'fill',text:pickText,color:'#fff',width:0}]),bounds:Object.freeze({left:pickX-pickRadius-2,top:pickY-pickRadius-2,right:pickX+pickRadius+2,bottom:pickY+pickRadius+2})}));
        canvasState.strokeStyle='#0f1a26'; canvasState.lineWidth=1.5; canvasState.fillStyle='#fff'; canvasState.font=pickFont; canvasState.textAlign='center'; canvasState.textBaseline='alphabetic';
        if(camera.scale>=.9){ const text=d.owner===input.meId?'You':p.name,font=`bold ${Math.max(10,Math.min(14,camera.scale*2.6))}px "Segoe UI",system-ui,sans-serif`; items.push(Object.freeze({...textLabel('draft-owner',`${key}:owner`,px,py+fh/2+13,text,font,'center','alphabetic',[{operation:'stroke',text,color:'rgba(0,0,0,.7)',width:3},{operation:'fill',text,color:'#fff',width:0}]),alpha})); canvasState.font=font; canvasState.strokeStyle='rgba(0,0,0,.7)'; canvasState.lineWidth=3; }
        addEntry(key,'draft',order++,items); counts.draftEntries++;
      }
      canvasState.globalAlpha=1;
    }
    if(input.garrisonEnabled&&areas.length>1&&camera.scale>=.9){ canvasState.font='bold 12px "Segoe UI",system-ui,sans-serif'; canvasState.textAlign='center'; canvasState.lineWidth=3; for(let index=0;index<areas.length;index++){ const a=areas[index],key=`garrison:${input.meId}:${a.id}`; claim(key); if(a.tiles<20&&index!==0) continue; const text=formatMapLabelNumber(a.troops)+' ⚑',stroke=input.hoverArea===a.id?'rgba(255,210,122,.9)':'rgba(0,0,0,.6)',item=textLabel('garrison-count',`${key}:count`,camera.x+Number(a.cx)*camera.scale,camera.y+Number(a.cy)*camera.scale+16,text,canvasState.font,'center',canvasState.textBaseline,[{operation:'stroke',text,color:stroke,width:3},{operation:'fill',text,color:'#fff',width:0}]); addEntry(key,'garrison',order++,[item]); canvasState.strokeStyle=stroke; canvasState.fillStyle='#fff'; counts.garrisonEntries++; } }
    counts.visibleLabels=labels.length;
    return Object.freeze({entries:Object.freeze(entries),labels:Object.freeze(labels),counts:Object.freeze(counts),limits:Object.freeze(maximum),viewport:Object.freeze(viewport),canvasState:Object.freeze({...canvasState,lineDash:Object.freeze(canvasState.lineDash.slice())})});
  };
  return Object.freeze({build,reset(){}});
}
