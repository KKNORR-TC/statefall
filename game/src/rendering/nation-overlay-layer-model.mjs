export const MAX_NATION_OVERLAY_ENTRIES=4096;
export const MAX_NATION_OVERLAY_LABELS=16384;
export const MAX_NATION_OVERLAY_CHARS=262144;
export const MAX_NATION_OVERLAY_PRIMITIVES=65536;
export const MAX_NATION_OVERLAY_SEGMENTS=131072;
export const MAX_NATION_OVERLAY_CONTAINERS=4096;
export const MAX_NATION_OVERLAY_IDLE_CONTAINERS=512;
export const MAX_NATION_OVERLAY_SPRITES=4096;
export const MAX_NATION_OVERLAY_IDLE_SPRITES=512;
export const MAX_NATION_OVERLAY_TEXTURES=4096;
export const MAX_NATION_OVERLAY_SOURCE_BYTES=64*1024*1024;

const TAU=Math.PI*2;
const finite=value=>Number.isFinite(Number(value));
const color=value=>typeof value==='string'&&value.length>0;
const validFlag=flag=>{ try{ return !!flag&&JSON.stringify(flag).length<=65536; }catch{ return false; } };

function inheritedState(input){
  const value=input?.inheritedCanvasState||{},dash=Array.isArray(value.lineDash)?value.lineDash.map(Number):[];
  if(dash.some(item=>!finite(item)||item<0)) throw new TypeError('invalid nation overlay inherited dash');
  return {globalAlpha:finite(value.globalAlpha)?Number(value.globalAlpha):1,lineJoin:['round','bevel'].includes(value.lineJoin)?value.lineJoin:'miter',lineCap:['round','square'].includes(value.lineCap)?value.lineCap:'butt',lineDash:dash,lineDashOffset:finite(value.lineDashOffset)?Number(value.lineDashOffset):0,lineWidth:finite(value.lineWidth)&&Number(value.lineWidth)>=0?Number(value.lineWidth):1,strokeStyle:color(value.strokeStyle)?value.strokeStyle:'#000000',fillStyle:color(value.fillStyle)?value.fillStyle:'#000000',font:typeof value.font==='string'?value.font:'10px sans-serif',textAlign:['left','right','center','start','end'].includes(value.textAlign)?value.textAlign:'start',textBaseline:['top','hanging','middle','alphabetic','ideographic','bottom'].includes(value.textBaseline)?value.textBaseline:'alphabetic'};
}

function applyState(context,state){
  context.globalAlpha=state.globalAlpha; context.lineJoin=state.lineJoin; context.lineCap=state.lineCap; context.setLineDash(state.lineDash); context.lineDashOffset=state.lineDashOffset; context.lineWidth=state.lineWidth; context.strokeStyle=state.strokeStyle; context.fillStyle=state.fillStyle; context.font=state.font; context.textAlign=state.textAlign; context.textBaseline=state.textBaseline;
}

const cloneState=state=>({...state,lineDash:state.lineDash.slice()});
const relationPainted=player=>player.relation!=='none'&&!player.mine&&!player.relationTeam;
const iconExtent=r=>r*1.18+1;

export function drawNationHandshake(context,x,y,r){
  context.save(); context.translate(x,y); const u=r/10; context.scale(u,u); context.lineJoin='round'; context.lineCap='round';
  context.fillStyle='#0f1a26'; context.beginPath(); context.arc(0,0,11,0,TAU); context.fill(); context.strokeStyle='#7fd0ff'; context.lineWidth=1.6; context.stroke();
  context.fillStyle='#7fb3ff'; context.fillRect(-10.5,-1,4.5,4); context.fillRect(6,-5,4.5,4);
  context.fillStyle='#f2d3b3'; context.beginPath(); context.moveTo(-6.5,-4); context.lineTo(-1,-4); context.lineTo(1,-1.5); context.lineTo(-1,2); context.lineTo(-6.5,2); context.closePath(); context.fill();
  context.fillStyle='#e8c29c'; context.beginPath(); context.moveTo(6.5,4); context.lineTo(1,4); context.lineTo(-1,1.5); context.lineTo(1,-2); context.lineTo(6.5,-2); context.closePath(); context.fill();
  context.strokeStyle='#b08a63'; context.lineWidth=.8; context.beginPath(); context.moveTo(-4.5,-1); context.lineTo(-1,-1); context.moveTo(-4.5,.5); context.lineTo(-1,.5); context.stroke();
  context.strokeStyle='#a37a55'; context.beginPath(); context.moveTo(4.5,1); context.lineTo(1,1); context.moveTo(4.5,2.5); context.lineTo(1,2.5); context.stroke(); context.restore();
}

export function drawNationBrokenHeart(context,x,y,r){
  context.save(); context.translate(x,y); const u=r/10; context.scale(u,u); context.lineJoin='round';
  context.fillStyle='#0f1a26'; context.beginPath(); context.arc(0,0,11,0,TAU); context.fill(); context.strokeStyle='#e35d5d'; context.lineWidth=1.6; context.stroke();
  context.fillStyle='#e35d5d'; context.beginPath(); context.moveTo(0,7); context.bezierCurveTo(-9,0,-8,-8,-3,-7); context.bezierCurveTo(-1,-7,0,-5,0,-4); context.bezierCurveTo(0,-5,1,-7,3,-7); context.bezierCurveTo(8,-8,9,0,0,7); context.closePath(); context.fill();
  context.strokeStyle='#0f1a26'; context.lineWidth=1.8; context.lineCap='round'; context.beginPath(); context.moveTo(0,-4); context.lineTo(-2,-1); context.lineTo(1,2); context.lineTo(-1,5); context.stroke(); context.restore();
}

function validate(input){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},players=Array.isArray(input?.players)?input.players:[];
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!finite(input?.now)||!Number.isSafeInteger(input?.tick)||typeof input?.draftActive!=='boolean') throw new TypeError('invalid nation overlay state');
  for(const player of players) if(!player||!Number.isSafeInteger(player.id)||typeof player.name!=='string'||!color(player.color)||!validFlag(player.flag)||!finite(player.x)||!finite(player.y)||!finite(player.tiles)||typeof player.alive!=='boolean'||!['neutral','nation'].includes(player.kind)||typeof player.mine!=='boolean'||!['ally','pact','war','none'].includes(player.relation)||typeof player.relationTeam!=='boolean'||(player.teamColor!==null&&!color(player.teamColor))||!finite(player.handshakeUntil)||!finite(player.heartbreakUntil)||typeof player.troopsText!=='string') throw new TypeError('invalid nation overlay player');
  return {camera,viewport,players};
}

const measure=(fn,font,text)=>{ const value=fn(font,text); if(!value||![value.width,value.ascent,value.descent].every(finite)||value.width<0||value.ascent<0||value.descent<0) throw new TypeError('invalid nation overlay measurement'); return value; };

function layoutEntry(player,input,measureText,incoming){
  const x=input.camera.x+player.x*input.camera.scale,y=input.camera.y+player.y*input.camera.scale,fs=Math.min(46,Math.max(12,12+Math.sqrt(player.tiles)/6)),big=fs>22,labelAlpha=big?Math.max(.45,1-(fs-22)/40):1;
  if(player.kind==='neutral'){
    const font='11px "Segoe UI",system-ui,sans-serif',m=measure(measureText,font,player.name),pad=incoming.lineWidth/2+1;
    return {x,y,fs,big,labelAlpha:1,neutral:true,rasterState:cloneState(incoming),bounds:{left:x-m.width/2-pad,top:y-m.ascent-pad,right:x+m.width/2+pad,bottom:y+m.descent+pad},labels:1,chars:player.name.length,primitives:2,segments:0};
  }
  const nameFont=`bold ${fs}px "Segoe UI",system-ui,sans-serif`,name=measure(measureText,nameFont,player.name),countFont=`${Math.round(fs*.85)}px "Segoe UI",system-ui,sans-serif`,count=measure(measureText,countFont,player.troopsText),fw=Math.max(14,Math.min(90,fs*2.4)),fh=fw*2/3,top=y-fh-fs*.9-4,br=Math.max(9,Math.min(22,fs*.55)),fresh=player.handshakeUntil>input.tick,handshakeScale=fresh?1+.35*Math.abs(Math.sin(input.now/180)):1,heartFraction=(player.heartbreakUntil-input.tick)/150,heartAlpha=Math.min(1,heartFraction*1.6),relationText=relationPainted(player)?(player.relation==='ally'?'ALLY':'PACT'):null,relationFont='bold 10px "Segoe UI",system-ui,sans-serif',relation=relationText?measure(measureText,relationFont,relationText):null,ch=Math.max(6,fs*.45),handshake=player.relation==='ally'&&!player.mine?{x:x+fw/2+br*.9,y:top+br*.2,r:br*handshakeScale}:null,heart=player.heartbreakUntil>input.tick?{x,y:top-br*1.4-(1-heartFraction)*18,r:br*1.15,alpha:heartAlpha}:null,namePad=Math.max(3,fs/4)/2+1,countPad=2.5,relationPad=(player.teamColor?2:1)/2+1; let left=Math.min(x-name.width/2-namePad,x-fw/2-3,x-name.width/2-ch-7,x-count.width/2-countPad),right=Math.max(x+name.width/2+namePad,x+fw/2+3,x+count.width/2+countPad),bottom=Math.max(y+name.descent+namePad,y+fs*1.05+count.descent+countPad,relation?y+fs*1.05+13+relation.descent+relationPad:-Infinity);
  if(handshake){ const extent=iconExtent(handshake.r); left=Math.min(left,handshake.x-extent); right=Math.max(right,handshake.x+extent); }
  let upper=Math.min(y-name.ascent-namePad,top-3); if(handshake){ const extent=iconExtent(handshake.r); upper=Math.min(upper,handshake.y-extent); bottom=Math.max(bottom,handshake.y+extent); } if(heart){ const extent=iconExtent(heart.r); left=Math.min(left,heart.x-extent); right=Math.max(right,heart.x+extent); upper=Math.min(upper,heart.y-extent); bottom=Math.max(bottom,heart.y+extent); }
  return {x,y,fs,big,labelAlpha,neutral:false,rasterState:cloneState(incoming),nameFont,countFont,relationFont,relationText,fw,fh,top,br,handshake,heart,bounds:{left,top:upper,right,bottom},labels:2+(relationText?1:0),chars:player.name.length+player.troopsText.length+(relationText?.length||0),primitives:7+(handshake?8:0)+(heart?4:0)+(player.teamColor?1:0)+(relationText?2:0),segments:(handshake?20:0)+(heart?16:0)+(player.teamColor?4:0)};
}

export function paintNationOverlayEntryCanvas(context,entry,{drawFlag}={}){
  const p=entry.player,{x,y,fs}=entry; applyState(context,entry.rasterState); context.globalAlpha=entry.labelAlpha; context.font=`bold ${fs}px "Segoe UI",system-ui,sans-serif`;
  if(entry.neutral){ context.globalAlpha=1; context.font=`bold ${fs}px "Segoe UI",system-ui,sans-serif`; if(entry.suppressed) return; context.font='11px "Segoe UI",system-ui,sans-serif'; context.fillStyle='rgba(255,255,255,.8)'; context.strokeText(p.name,x,y); context.fillText(p.name,x,y); context.fillStyle='#fff'; context.font='bold 12px "Segoe UI",system-ui,sans-serif'; return; }
  context.globalAlpha=entry.labelAlpha; context.font=entry.nameFont; context.lineWidth=Math.max(3,fs/4); context.strokeStyle='rgba(0,0,0,.7)'; context.strokeText(p.name,x,y); context.lineWidth=Math.max(1.5,fs/9); context.strokeStyle=p.color; context.strokeText(p.name,x,y); context.fillStyle='#fff'; context.fillText(p.name,x,y); context.strokeStyle='rgba(0,0,0,.6)'; context.lineWidth=3;
  const tw=context.measureText(p.name).width,ch=Math.max(6,fs*.45); context.fillStyle=p.color; context.fillRect(x-tw/2-ch-6,y-ch*.9,ch,ch); context.strokeStyle='rgba(255,255,255,.8)'; context.lineWidth=1; context.strokeRect(x-tw/2-ch-6,y-ch*.9,ch,ch); context.fillStyle='#fff'; context.strokeStyle='rgba(0,0,0,.6)'; context.lineWidth=3;
  context.font=entry.countFont; context.strokeText(p.troopsText,x,y+fs*1.05); context.fillText(p.troopsText,x,y+fs*1.05); context.font='bold 12px "Segoe UI",system-ui,sans-serif'; context.lineWidth=3;
  if(typeof drawFlag!=='function') throw new TypeError('missing nation overlay flag painter'); drawFlag(context,p.flag,x-entry.fw/2,entry.top,entry.fw,entry.fh);
  if(entry.handshake){ context.globalAlpha=1; drawNationHandshake(context,entry.handshake.x,entry.handshake.y,entry.handshake.r); }
  if(entry.heart){ context.globalAlpha=entry.heart.alpha; drawNationBrokenHeart(context,entry.heart.x,entry.heart.y,entry.heart.r); context.globalAlpha=entry.labelAlpha; }
  if(p.teamColor){ context.strokeStyle=p.teamColor; context.lineWidth=2; context.strokeRect(x-entry.fw/2-2,y-entry.fh-fs*.9-6,entry.fw+4,entry.fh+4); }
  if(entry.relationText&&!p.relationTeam&&!p.mine){ context.fillStyle=p.relation==='ally'?'#7fd0ff':'#bde5b8'; context.font=entry.relationFont; context.strokeText(entry.relationText,x,y+fs*1.05+13); context.fillText(entry.relationText,x,y+fs*1.05+13); context.fillStyle='#fff'; context.font='bold 12px "Segoe UI",system-ui,sans-serif'; }
  context.globalAlpha=1;
}

export function paintNationOverlaysCanvas(context,input,{drawFlag}={}){
  const {players}=validate(input),state=inheritedState(input),order=[],measureText=input.measureText||((font,text)=>{ context.font=font; const m=context.measureText(text); return {width:m.width,ascent:m.actualBoundingBoxAscent||16,descent:m.actualBoundingBoxDescent||4}; }); applyState(context,state);
  if(input.camera.scale>=1){ state.font='bold 12px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.lineWidth=3; state.strokeStyle='rgba(0,0,0,.6)'; state.fillStyle='#fff'; applyState(context,state); }
  if(input.camera.scale>=1&&!input.draftActive) for(let index=0;index<players.length;index++){ const player=players[index]; if(!player.alive||player.tiles<200) continue; const entry={player,order:index,...layoutEntry(player,input,measureText,{globalAlpha:context.globalAlpha,lineJoin:context.lineJoin,lineCap:context.lineCap,lineDash:context.getLineDash(),lineDashOffset:context.lineDashOffset,lineWidth:context.lineWidth,strokeStyle:context.strokeStyle,fillStyle:context.fillStyle,font:context.font,textAlign:context.textAlign,textBaseline:context.textBaseline}),suppressed:player.kind==='neutral'&&input.camera.scale<1.2}; paintNationOverlayEntryCanvas(context,entry,{drawFlag}); if(entry.suppressed) continue; order.push(player.kind==='neutral'?'neutral':`nation:${player.id}`); }
  if(input.camera.scale>=1) state.globalAlpha=context.globalAlpha=1; return Object.freeze(order);
}

export function createNationOverlayModel(){
  const build=(input,limits={})=>{
    const {camera,viewport,players}=validate(input),maximum={entries:limits.entries??MAX_NATION_OVERLAY_ENTRIES,labels:limits.labels??MAX_NATION_OVERLAY_LABELS,chars:limits.chars??MAX_NATION_OVERLAY_CHARS,primitives:limits.primitives??MAX_NATION_OVERLAY_PRIMITIVES,segments:limits.segments??MAX_NATION_OVERLAY_SEGMENTS}; for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid nation overlay ${name} cap`);
    if(typeof input.measureText!=='function') throw new TypeError('invalid nation overlay measurement'); const keys=new Set(),entries=[]; let labels=0,chars=0,primitives=0,segments=0,culled=0,eligible=0;
    for(const player of players){ const key=`player:${player.id}`; if(keys.has(key)) throw new TypeError('duplicate nation overlay stable key'); keys.add(key); }
    const timeline=camera.scale<1?inheritedState(input):{...inheritedState(input),globalAlpha:1,font:'bold 12px "Segoe UI",system-ui,sans-serif',textAlign:'center',lineWidth:3,strokeStyle:'rgba(0,0,0,.6)',fillStyle:'#fff'};
     if(camera.scale>=1&&!input.draftActive) for(let order=0;order<players.length;order++){ const player=players[order],key=`player:${player.id}`; if(!player.alive||player.tiles<200) continue; const fs=Math.min(46,Math.max(12,12+Math.sqrt(player.tiles)/6)),suppressed=player.kind==='neutral'&&camera.scale<1.2,layout=layoutEntry(player,input,input.measureText,timeline); timeline.font=`bold ${fs}px "Segoe UI",system-ui,sans-serif`; timeline.globalAlpha=player.kind==='neutral'?1:(fs>22?Math.max(.45,1-(fs-22)/40):1); if(suppressed) continue; eligible++; labels+=layout.labels; chars+=layout.chars; primitives+=layout.primitives; segments+=layout.segments; if(eligible>maximum.entries) throw new RangeError('entry-cap'); if(labels>maximum.labels) throw new RangeError('label-cap'); if(chars>maximum.chars) throw new RangeError('char-cap'); if(primitives>maximum.primitives) throw new RangeError('primitive-cap'); if(segments>maximum.segments) throw new RangeError('segment-cap'); if(player.kind==='neutral'){ timeline.font='bold 12px "Segoe UI",system-ui,sans-serif'; timeline.fillStyle='#fff'; }else{ timeline.font='bold 12px "Segoe UI",system-ui,sans-serif'; timeline.fillStyle='#fff'; timeline.strokeStyle=player.teamColor||'rgba(0,0,0,.5)'; timeline.lineWidth=player.teamColor?2:1; timeline.globalAlpha=1; } const b=layout.bounds;if(b.right<0||b.bottom<0||b.left>viewport.width||b.top>viewport.height){ culled++; continue; } entries.push(Object.freeze({key,order,player:Object.freeze({...player}),...layout,suppressed:false,bounds:Object.freeze({...b}),rasterState:Object.freeze({...layout.rasterState,lineDash:Object.freeze(layout.rasterState.lineDash.slice())})})); }
    timeline.globalAlpha=camera.scale>=1?1:timeline.globalAlpha; const canvasState=timeline;
    return Object.freeze({entries:Object.freeze(entries),counts:Object.freeze({players:players.length,eligible,visible:entries.length,culled,labels,chars,primitives,segments}),limits:Object.freeze(maximum),canvasState:Object.freeze({...canvasState,lineDash:Object.freeze(canvasState.lineDash.slice())})});
  };
  return Object.freeze({build,reset(){}});
}
