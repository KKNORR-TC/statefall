export const MAX_FLOATING_TEXT_ENTRIES=4096;
export const MAX_FLOATING_TEXT_LABELS=4096;
export const MAX_FLOATING_TEXT_CHARS=131072;
export const MAX_FLOATING_TEXT_CONTAINERS=4096;
export const MAX_FLOATING_TEXT_IDLE_CONTAINERS=512;
export const MAX_FLOATING_TEXT_SPRITES=4096;
export const MAX_FLOATING_TEXT_IDLE_SPRITES=512;
export const MAX_FLOATING_TEXT_TEXTURES=4096;
export const MAX_FLOATING_TEXT_SOURCE_BYTES=32*1024*1024;

const finite=value=>Number.isFinite(Number(value));
const color=value=>typeof value==='string'&&value.length>0;

export function advanceFloatingTextPresentation(floaters,advance=true){
  if(!Array.isArray(floaters)) throw new TypeError('invalid floating text presentation array');
  if(advance) for(const floater of floaters){ if(!floater||!finite(floater.age)) throw new TypeError('invalid floating text presentation source'); floater.age++; }
  const frame=floaters.slice(),next=advance?floaters.filter(floater=>floater.age<(floater.big?80:40)):floaters;
  return Object.freeze({frame:Object.freeze(frame),next});
}

function inheritedState(input){
  const value=input?.inheritedCanvasState||{};
  return {globalAlpha:finite(value.globalAlpha)?Number(value.globalAlpha):1,lineJoin:['round','bevel'].includes(value.lineJoin)?value.lineJoin:'miter',lineCap:['round','square'].includes(value.lineCap)?value.lineCap:'butt',lineDash:Array.isArray(value.lineDash)?value.lineDash.map(Number):[],lineDashOffset:finite(value.lineDashOffset)?Number(value.lineDashOffset):0,lineWidth:finite(value.lineWidth)&&Number(value.lineWidth)>=0?Number(value.lineWidth):1,strokeStyle:color(value.strokeStyle)?value.strokeStyle:'#000000',fillStyle:color(value.fillStyle)?value.fillStyle:'#000000',font:typeof value.font==='string'?value.font:'10px sans-serif',textAlign:['left','right','center','start','end'].includes(value.textAlign)?value.textAlign:'start',textBaseline:['top','hanging','middle','alphabetic','ideographic','bottom'].includes(value.textBaseline)?value.textBaseline:'alphabetic'};
}

function applyState(context,state){
  context.globalAlpha=state.globalAlpha; context.lineJoin=state.lineJoin; context.lineCap=state.lineCap; context.setLineDash(state.lineDash); context.lineDashOffset=state.lineDashOffset; context.lineWidth=state.lineWidth; context.strokeStyle=state.strokeStyle; context.fillStyle=state.fillStyle; context.font=state.font; context.textAlign=state.textAlign; context.textBaseline=state.textBaseline;
}

function validate(input,{strict=true}={}){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},floaters=Array.isArray(input?.floaters)?input.floaters:[];
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0) throw new TypeError('invalid floating text camera');
  if(strict) for(const floater of floaters) if(!floater||typeof floater.source!=='object'||!finite(floater.x)||!finite(floater.y)||!finite(floater.age)||typeof floater.text!=='string'||!color(floater.color)||typeof floater.big!=='boolean') throw new TypeError('invalid floating text source');
  return {camera,viewport,floaters};
}

export function paintFloatingTextCanvas(context,input){
  const {camera,floaters}=validate(input,{strict:false}),state=inheritedState(input),order=[]; applyState(context,state);
  for(const f of floaters){
    const big=!!f.big,life=big?80:40; context.globalAlpha=Math.max(0,1-Number(f.age)/life); context.font=`bold ${big?16:11}px "Segoe UI",system-ui,sans-serif`; context.textAlign='center'; context.lineWidth=3; context.strokeStyle='rgba(0,0,0,.6)'; context.fillStyle=f.color; const x=camera.x+(Number(f.x)+.5)*camera.scale,y=camera.y+(Number(f.y)+.5)*camera.scale-Number(f.age)*(big?.9:.6)-(big?4*Math.sin(Number(f.age)/6):0); context.strokeText(f.text,x,y); context.fillText(f.text,x,y); context.globalAlpha=1; order.push('floating-text');
    Object.assign(state,{globalAlpha:1,font:context.font,textAlign:'center',lineWidth:3,strokeStyle:'rgba(0,0,0,.6)',fillStyle:f.color});
  }
  return Object.freeze(order);
}

export function createFloatingTextModel(){
  let identities=new WeakMap(),identitySerial=0;
  const reset=()=>{ identities=new WeakMap(); identitySerial=0; };
  const build=(input,limits={})=>{
    const {camera,viewport,floaters}=validate(input),maximum={entries:limits.entries??MAX_FLOATING_TEXT_ENTRIES,labels:limits.labels??MAX_FLOATING_TEXT_LABELS,chars:limits.chars??MAX_FLOATING_TEXT_CHARS};
    for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid floating text ${name} cap`);
    const chars=floaters.reduce((sum,value)=>sum+value.text.length,0); if(floaters.length>maximum.entries) throw new RangeError('entry-cap'); if(floaters.length>maximum.labels) throw new RangeError('label-cap'); if(chars>maximum.chars) throw new RangeError('char-cap');
    const canvasState=inheritedState(input),entries=[],occurrences=new Map();
    for(let order=0;order<floaters.length;order++){
      const f=floaters[order],big=f.big,life=big?80:40,alpha=Math.max(0,1-f.age/life),font=`bold ${big?16:11}px "Segoe UI",system-ui,sans-serif`,x=camera.x+(f.x+.5)*camera.scale,y=camera.y+(f.y+.5)*camera.scale-f.age*(big?.9:.6)-(big?4*Math.sin(f.age/6):0); let identity=identities.get(f.source); if(!identity){ identity=++identitySerial; identities.set(f.source,identity); } const occurrence=occurrences.get(identity)||0; occurrences.set(identity,occurrence+1);
      const label=Object.freeze({kind:'floating-text',text:f.text,color:f.color,font,align:'center',baseline:canvasState.textBaseline,lineWidth:3,strokeStyle:'rgba(0,0,0,.6)',alpha,x,y}); entries.push(Object.freeze({key:`floater:${identity}:${occurrence}`,source:f.source,order,age:f.age,life,big,x,y,label}));
      Object.assign(canvasState,{globalAlpha:1,font,textAlign:'center',lineWidth:3,strokeStyle:'rgba(0,0,0,.6)',fillStyle:f.color});
    }
    return Object.freeze({entries:Object.freeze(entries),labels:Object.freeze(entries.map(value=>value.label)),counts:Object.freeze({total:floaters.length,visible:floaters.length,culled:0,chars}),limits:Object.freeze(maximum),viewport:Object.freeze(viewport),canvasState:Object.freeze({...canvasState,lineDash:Object.freeze(canvasState.lineDash.slice())})});
  };
  return Object.freeze({build,reset,diagnostics:()=>Object.freeze({identitySerial})});
}
