export const CAMERA_MIN_SCALE=0.35;
export const CAMERA_MAX_SCALE=12;

const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;

export function createCamera({x=0,y=0,scale=4,minScale=CAMERA_MIN_SCALE,maxScale=CAMERA_MAX_SCALE}={}){
  const state={x:finite(x,0),y:finite(y,0),scale:finite(scale,4)};
  const clampScale=value=>Math.min(maxScale,Math.max(minScale,finite(value,state.scale)));
  state.scale=clampScale(state.scale);

  const camera={
    get x(){ return state.x; }, set x(value){ state.x=finite(value,state.x); },
    get y(){ return state.y; }, set y(value){ state.y=finite(value,state.y); },
    get s(){ return state.scale; }, set s(value){ state.scale=clampScale(value); },
    get scale(){ return state.scale; }, set scale(value){ state.scale=clampScale(value); },
    snapshot(){ return {x:state.x,y:state.y,scale:state.scale}; },
    worldToScreen(worldX,worldY){ return {x:state.x+worldX*state.scale,y:state.y+worldY*state.scale}; },
    screenToWorld(screenX,screenY){ return {x:(screenX-state.x)/state.scale,y:(screenY-state.y)/state.scale}; },
    screenToTile(screenX,screenY,width,height){
      const world=camera.screenToWorld(screenX,screenY),tileX=Math.floor(world.x),tileY=Math.floor(world.y);
      return tileX>=0&&tileY>=0&&tileX<width&&tileY<height?tileY*width+tileX:-1;
    },
    zoomAt(screenX,screenY,nextScale){
      const world=camera.screenToWorld(screenX,screenY),clamped=clampScale(nextScale);
      state.scale=clamped; state.x=screenX-world.x*clamped; state.y=screenY-world.y*clamped;
      return camera.snapshot();
    },
    pan(dx,dy){ state.x+=finite(dx,0); state.y+=finite(dy,0); return camera.snapshot(); },
    centerOn(worldX,worldY,viewportWidth,viewportHeight){
      state.x=viewportWidth/2-worldX*state.scale; state.y=viewportHeight/2-worldY*state.scale;
      return camera.snapshot();
    },
    focus(worldX,worldY,viewportWidth,viewportHeight,nextScale=state.scale){ state.scale=clampScale(nextScale); return camera.centerOn(worldX,worldY,viewportWidth,viewportHeight); },
    visibleBounds(viewportWidth,viewportHeight){
      const topLeft=camera.screenToWorld(0,0),bottomRight=camera.screenToWorld(viewportWidth,viewportHeight);
      return {left:topLeft.x,top:topLeft.y,right:bottomRight.x,bottom:bottomRight.y,width:bottomRight.x-topLeft.x,height:bottomRight.y-topLeft.y};
    },
    preserveResizeCenter(oldWidth,oldHeight,newWidth,newHeight){
      if(oldWidth<=0||oldHeight<=0) return camera.snapshot();
      const focus=camera.screenToWorld(oldWidth/2,oldHeight/2);
      return camera.centerOn(focus.x,focus.y,newWidth,newHeight);
    }
  };
  return camera;
}
