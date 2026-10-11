export interface ViewportPoint {x:number;y:number;}
export interface LottieViewport extends ViewportPoint {zoom:number;}
/** Spatial policy is borrowed from the host; no graph or playback authority. */
export interface LottieNavigationPolicy {
 isPanGesture(input:{button:number;altKey:boolean;isPrimaryModifier:boolean}):boolean;
 panOffset(input:{viewportStart:ViewportPoint;pointerStart:ViewportPoint;pointerCurrent:ViewportPoint}):ViewportPoint;
 scaleAroundPoint(input:{viewport:LottieViewport;screenPoint:ViewportPoint;nextZoom:number}):LottieViewport;
 gridProjection?(input:LottieViewport & {width:number;height:number}):{gridMinorScreenSize:number;gridMajorScreenSize:number;gridMinorOffsetX:number;gridMinorOffsetY:number;gridMajorOffsetX:number;gridMajorOffsetY:number};
 nextZoom(zoom:number,direction:1|-1):number;
}
export function createLottieNavigation(policy:LottieNavigationPolicy){
 let view:LottieViewport={x:0,y:0,zoom:1};
 let start:{point:ViewportPoint;view:LottieViewport;id:number;explicit:boolean}|null=null,panned=false;
 return {
  read:()=>({...view}),
  restore(value:unknown){const v=value as Partial<LottieViewport>|null;if(!v||![v.x,v.y,v.zoom].every(n=>typeof n==='number'&&Number.isFinite(n))||v.zoom!<=0)return;const next={x:v.x!,y:v.y!,zoom:Math.max(0.05,Math.min(32,v.zoom!))};if(next.x===view.x&&next.y===view.y&&next.zoom===view.zoom)return;view=next;start=null;panned=false;},
  reset(){start=null;panned=false;view={x:0,y:0,zoom:1};},
  zoom(point:ViewportPoint,direction:1|-1){if(start)return false;const nextZoom=policy.nextZoom(view.zoom,direction);if(nextZoom===view.zoom)return false;view=policy.scaleAroundPoint({viewport:view,screenPoint:point,nextZoom});return true;},
  down(e:{button:number;altKey:boolean;ctrlKey:boolean;metaKey:boolean;pointerId:number;clientX:number;clientY:number}){
   if(start||(e.button!==0&&e.button!==1)||!policy.isPanGesture({button:e.button,altKey:e.altKey,isPrimaryModifier:e.ctrlKey||e.metaKey}))return false;
   start={point:{x:e.clientX,y:e.clientY},view:{...view},id:e.pointerId,explicit:e.button===1||e.altKey};panned=start.explicit;return true;
  },
  move(e:{pointerId:number;clientX:number;clientY:number}){if(!start||start.id!==e.pointerId)return false;
   if(!panned&&Math.hypot(e.clientX-start.point.x,e.clientY-start.point.y)<=5)return false;
   panned=true;view={...start.view,...policy.panOffset({viewportStart:start.view,pointerStart:start.point,pointerCurrent:{x:e.clientX,y:e.clientY}})};return true;
  },
  up(id:number){if(!start||start.id!==id)return false;const consumed=panned;start=null;panned=false;return consumed;},
  cancel(){start=null;panned=false;}
 };
}
/** Transform inside SVG so native CTMs, clipping and non-scaling strokes agree.
 * Feedback is rebuilt from source ancestry and stays above the authored paint. */
export function mountLottieNavigationProjection(canvas:HTMLElement,stage:HTMLElement,read:()=>LottieViewport){
 const svg=canvas.querySelector('svg');if(!svg)return()=>{};
 const group=canvas.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('data-lottie-view-transform','');
 for(const child of Array.from(svg.children))if(!['defs','title','desc'].includes(child.tagName))group.append(child);
 svg.append(group);
 return()=>{const m=svg.getScreenCTM(),r=stage.getBoundingClientRect(),v=read();if(!m)return;
  // Conjugate the screen-space camera by the SVG fit transform (including letterboxing).
  const dx=v.x+(v.zoom-1)*(m.e-r.left),dy=v.y+(v.zoom-1)*(m.f-r.top),det=m.a*m.d-m.b*m.c;
  if(Math.abs(det)<1e-12)return;
  group.setAttribute('transform',`matrix(${v.zoom} 0 0 ${v.zoom} ${(m.d*dx-m.c*dy)/det} ${(-m.b*dx+m.a*dy)/det})`);
 };
}
