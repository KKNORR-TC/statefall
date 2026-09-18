import {createCamera} from './camera.mjs';
import {createViewport} from './viewport.mjs';
import {createRenderer} from './renderer-factory.mjs';

const stage=document.getElementById('stage'),canvas=document.getElementById('map'),camera=createCamera();
let renderer=null;
const viewport=createViewport({element:stage,canvas,onResize:(next,previous)=>{
  camera.preserveResizeCenter(previous.cssWidth,previous.cssHeight,next.cssWidth,next.cssHeight);
  renderer?.resize(next);
}});
renderer=await createRenderer({stage,metrics:()=>viewport.metrics});
const lifecycleListeners=new Set();
let destroyed=false,suspended=false,restoreFailure=null;
const runtime={camera,viewport,renderer,
  onLifecycle(listener){ lifecycleListeners.add(listener); return ()=>lifecycleListeners.delete(listener); },
  diagnostics(){ return {destroyed,suspended,restoreFailure,listenerCount:lifecycleListeners.size,...viewport.diagnostics()}; }
};
window.addEventListener('pagehide',event=>{
  if(event.persisted){ suspended=true; viewport.suspend(); renderer.suspend(); for(const listener of lifecycleListeners) listener('suspend'); return; }
  destroyed=true; for(const listener of lifecycleListeners) listener('destroy'); lifecycleListeners.clear(); viewport.destroy(); renderer.destroy();
});
window.addEventListener('pageshow',async event=>{
  if(!event.persisted||destroyed) return;
  viewport.resume();
  try{ await renderer.resume(viewport.metrics); restoreFailure=null; }
  catch(error){ restoreFailure=String(error?.message||error).slice(0,160); console.error('[statefall] rendering restore failed',restoreFailure); }
  finally{ suspended=false; for(const listener of lifecycleListeners) listener('resume'); }
});

export function renderingRuntime(){ return runtime; }
