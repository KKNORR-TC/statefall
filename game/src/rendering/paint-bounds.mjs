// One logical CSS pixel covers unscaled Canvas and Pixi vector antialiasing.
// Callers include geometric stroke extent first, then apply their margin once.
export const RASTER_ANTIALIAS_MARGIN_CSS=1;

export function conservativePaintBounds(left,top,right,bottom,kind='paint',margin=RASTER_ANTIALIAS_MARGIN_CSS){
  margin=Math.max(RASTER_ANTIALIAS_MARGIN_CSS,Number(margin)||0);
  return Object.freeze({left:left-margin,top:top-margin,right:right+margin,bottom:bottom+margin,kind});
}

export const paintBoundsIntersect=(a,b)=>a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;
export const paintBoundsIntersectViewport=(value,viewport)=>value.right>=0&&value.bottom>=0&&value.left<=viewport.width&&value.top<=viewport.height;
