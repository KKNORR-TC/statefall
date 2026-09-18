export const MAX_RENDER_DPR=2;

export function viewportMetrics(cssWidth,cssHeight,deviceDpr=1,maxDpr=MAX_RENDER_DPR){
  const width=Math.max(0,Number(cssWidth)||0),height=Math.max(0,Number(cssHeight)||0);
  const device=Math.max(1,Number(deviceDpr)||1),effective=Math.min(Math.max(1,Number(maxDpr)||1),device);
  return {cssWidth:width,cssHeight:height,deviceDpr:device,effectiveDpr:effective,pixelWidth:Math.max(1,Math.round(width*effective)),pixelHeight:Math.max(1,Math.round(height*effective))};
}

export function clientToLocal(element,clientX,clientY){
  const rect=element.getBoundingClientRect();
  return {x:clientX-rect.left,y:clientY-rect.top};
}

export function resizeCanvas(canvas,metrics){
  if(canvas.width!==metrics.pixelWidth) canvas.width=metrics.pixelWidth;
  if(canvas.height!==metrics.pixelHeight) canvas.height=metrics.pixelHeight;
  return metrics;
}

export function createViewport({element,canvas,maxDpr=MAX_RENDER_DPR,onResize=()=>{}}){
  let current=viewportMetrics(0,0,1,maxDpr),observer=null,destroyed=false,listening=false;
  const measure=()=>{
    if(destroyed) return current;
    const previous=current,rect=element.getBoundingClientRect();
    current=viewportMetrics(rect.width,rect.height,window.devicePixelRatio,maxDpr);
    resizeCanvas(canvas,current); onResize(current,previous);
    return current;
  };
  const windowResize=()=>measure();
  const resume=()=>{
    if(destroyed||listening) return current;
    if(typeof ResizeObserver==='function'){ observer=new ResizeObserver(measure); observer.observe(element); }
    window.addEventListener('resize',windowResize); listening=true;
    return measure();
  };
  const suspend=()=>{
    if(!listening) return;
    observer?.disconnect(); observer=null; window.removeEventListener('resize',windowResize); listening=false;
  };
  resume();
  return {
    measure,suspend,resume,
    local(clientX,clientY){ return clientToLocal(canvas,clientX,clientY); },
    get metrics(){ return current; },
    diagnostics(){ return {destroyed,listening,observerCount:observer?1:0,resizeListenerCount:listening?1:0}; },
    destroy(){ suspend(); destroyed=true; }
  };
}
