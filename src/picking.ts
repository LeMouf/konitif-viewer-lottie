import { resolveProjectedPath, resolveProjectedPaths } from './highlight.js';
import type { LottiePathNode } from './paths.js';

/** Transient interaction state only. Canonical selection remains the Viewer port. */
export function createDepthPickCycle(tolerance = 5) {
  let previous: {x:number;y:number;key:string;ids:string[];chosen:string|null}|null=null;
  return { reset(){previous=null;}, pick(x:number,y:number,key:string,ids:readonly string[],selected:readonly string[]) {
    const continuing=previous && Math.hypot(x-previous.x,y-previous.y)<=tolerance && key===previous.key
      && ids.length===previous.ids.length && ids.every((id,i)=>id===previous!.ids[i]) && selected.length===1 && selected[0]===previous.chosen;
    const index=continuing?(ids.indexOf(previous!.chosen!)+1)%ids.length:0;
    const chosen=ids[index]??null;previous={x,y,key,ids:[...ids],chosen};return chosen;
  }};
}

/** Qualify only untransformed, user-space rectangles. The pinned vendor emits
 * composition clips as rect and precomposition clips as an M/L/Z path.
 * This is an exact rectangle recognition, never a path bounding-box fallback.
 */
export function compositionClipRectangle(definition:Element|null): {x:number;y:number;width:number;height:number}|null {
  if(!definition||definition.children.length!==1||definition.getAttribute('clipPathUnits')==='objectBoundingBox'||definition.hasAttribute('transform'))return null;
  const shape=definition.children[0];
  if(shape.hasAttribute('transform')||shape.hasAttribute('clip-path')||shape.hasAttribute('mask'))return null;
  if([definition,shape].some(element=>['transform','clip-path','mask'].some(name=>(element as SVGElement).style?.getPropertyValue(name))))return null;
  if(shape.tagName==='rect'){
    if(Number(shape.getAttribute('rx')??0)!==0||Number(shape.getAttribute('ry')??0)!==0)return null;
    const x=Number(shape.getAttribute('x')??0),y=Number(shape.getAttribute('y')??0),width=Number(shape.getAttribute('width')),height=Number(shape.getAttribute('height'));
    return [x,y,width,height].every(Number.isFinite)&&width>0&&height>0?{x,y,width,height}:null;
  }
  if(shape.tagName!=='path')return null;
  const d=shape.getAttribute('d')??'';
  const tokens=d.match(/[MLZmlz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)??[];
  if(d.replace(/[MLZmlz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g,'')||tokens.length!==13||tokens[0]!=='M'||tokens[3]!=='L'||tokens[6]!=='L'||tokens[9]!=='L'||!['Z','z'].includes(tokens[12]))return null;
  const points=[0,3,6,9].map(i=>[Number(tokens[i+1]),Number(tokens[i+2])]);
  if(!points.flat().every(Number.isFinite))return null;
  const xs=[...new Set(points.map(p=>p[0]))],ys=[...new Set(points.map(p=>p[1]))];
  if(xs.length!==2||ys.length!==2||new Set(points.map(p=>p.join(','))).size!==4)return null;
  if(points.some((p,i)=>{const q=points[(i+1)%4];return (p[0]===q[0])===(p[1]===q[1]);}))return null;
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.abs(xs[1]-xs[0]),height:Math.abs(ys[1]-ys[0])};
}

function visibilityAt(path: SVGGraphicsElement,qualifiedClip:Element|undefined,styles:Map<Element,CSSStyleDeclaration>): (x:number,y:number)=>boolean {
  const doc=path.ownerDocument,win=doc.defaultView;if(!win)return ()=>false;
  const limits:{rect:{x:number;y:number;width:number;height:number};inverse:DOMMatrix}[]=[];
  for(let element:Element|null=path;element&&element.namespaceURI==='http://www.w3.org/2000/svg';element=element.parentElement){
    let style=styles.get(element);if(!style){style=win.getComputedStyle(element);styles.set(element,style);}
    if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return ()=>false;
    if((element.getAttribute('mask')&&element.getAttribute('mask')!=='none')|| (style.maskImage&&style.maskImage!=='none'))return ()=>false;
    const clip=element.getAttribute('clip-path');
    if(clip&&clip!=='none'){
      const id=clip.match(/#([^)'"\s]+)/)?.[1],definition=id?doc.getElementById(id):null;
      // Only a solid's explicitly qualified additive mask may bypass rectangle admission.
      if(definition===qualifiedClip)continue;
      const rect=compositionClipRectangle(definition);
      if(!rect)return ()=>false;
      const matrix=(element as SVGGraphicsElement).getScreenCTM?.();if(!matrix)return ()=>false;
      limits.push({rect,inverse:matrix.inverse()});
    }
  }
  return (x,y)=>limits.every(({rect,inverse})=>{const point=new DOMPoint(x,y).matrixTransform(inverse);return point.x>=rect.x&&point.x<=rect.x+rect.width&&point.y>=rect.y&&point.y<=rect.y+rect.height;});
}

/** Evaluated-frame cache owned by one renderer. Reset for camera/frame/visibility changes. */
export function createLottiePickCache(){return {styles:new Map<Element,CSSStyleDeclaration>(),visibility:new WeakMap<SVGGraphicsElement,Map<Element|undefined,(x:number,y:number)=>boolean>>(),matrices:new WeakMap<SVGGraphicsElement,DOMMatrix>(),bounds:new WeakMap<SVGGraphicsElement,DOMRect>(),probe:null as CanvasRenderingContext2D|null};}

/** Renderer-owned evaluated projection; source/frame/visibility/preview changes
 * must invalidate it. A uniform camera change only remaps screen coordinates. */
export function createLottiePathPicker(renderer:Parameters<typeof resolveProjectedPath>[0],readNodes:()=>readonly LottiePathNode[]){
  const geometry=new WeakMap<SVGGraphicsElement,{d:string;geometry:Path2D}>();
  let version=0,evaluatedVersion=-1,baseMatrix:DOMMatrix|null=null,evaluation=createLottiePickCache();
  let previous:{x:number;y:number;key:string;hits:string[]}|undefined;
  return {
    invalidate(){version++;previous=undefined;},
    hitTest(x:number,y:number){
      const matrix=renderer.layerElement?.getScreenCTM();
      const key=[version,matrix?.a,matrix?.b,matrix?.c,matrix?.d,matrix?.e,matrix?.f].join(':');
      if(matrix&&previous?.x===x&&previous.y===y&&previous.key===key)return previous.hits;
      let pickX=x,pickY=y,margin=6;
      if(matrix&&baseMatrix&&evaluatedVersion===version){
        const mapping=typeof baseMatrix.multiply==='function'?baseMatrix.multiply(matrix.inverse()):null;
        if(mapping&&Math.abs(mapping.b)<1e-9&&Math.abs(mapping.c)<1e-9&&mapping.a>0&&Math.abs(mapping.a-mapping.d)<1e-9){
          const point=new DOMPoint(x,y).matrixTransform(mapping);pickX=point.x;pickY=point.y;margin*=mapping.a;
        }else evaluatedVersion=-1;
      }
      if(!matrix||evaluatedVersion!==version){evaluation=createLottiePickCache();evaluatedVersion=version;baseMatrix=matrix??null;pickX=x;pickY=y;margin=6;}
      const hits=hitTestLottiePaths(renderer,readNodes(),pickX,pickY,margin,geometry,evaluation);
      if(matrix)previous={x,y,key,hits};
      return hits;
    }
  };
}

/** Geometric tests use individual path contributions, never bounding boxes or highlight overlays. */
export function hitTestLottiePaths(renderer: Parameters<typeof resolveProjectedPath>[0],nodes:readonly LottiePathNode[],x:number,y:number,marginPx=6,geometryCache?:WeakMap<SVGGraphicsElement,{d:string;geometry:Path2D}>,cache=createLottiePickCache()): string[] {
  const hits:{id:string;paint:SVGGraphicsElement;order:number;near:boolean}[]=[];
  let probe=cache.probe;
  const styles=cache.styles;
  nodes.forEach((node,order)=>{
    if(!node.selectable||(!['path','shape'].includes(node.kind)&&!node.solid))return;
    for(const projected of resolveProjectedPaths(renderer,node)){
    let policies=cache.visibility.get(projected.path);if(!policies){policies=new Map();cache.visibility.set(projected.path,policies);}
    let admitted=policies.get(projected.qualifiedClip);if(!admitted){admitted=visibilityAt(projected.path,projected.qualifiedClip,styles);policies.set(projected.qualifiedClip,admitted);}
    if(!admitted(x,y))continue;
    let matrix=cache.matrices.get(projected.path);if(!matrix){matrix=projected.path.getScreenCTM()??undefined;if(matrix)cache.matrices.set(projected.path,matrix);}if(!matrix||Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)<1e-12)return;
    const style=styles.get(projected.path)!;
    let bounds=cache.bounds.get(projected.path);if(!bounds&&projected.path.getBoundingClientRect){bounds=projected.path.getBoundingClientRect();cache.bounds.set(projected.path,bounds);}
    // Broad rejection only; final picking still uses exact fill/stroke geometry.
    const inflation=Math.max(0,marginPx)+(parseFloat(style.strokeWidth)||1)*Math.max(1,parseFloat(style.strokeMiterlimit)||4)*Math.hypot(matrix.a,matrix.b,matrix.c,matrix.d)/2;
    if(bounds&&[bounds.left,bounds.top,bounds.right,bounds.bottom,inflation].every(Number.isFinite)&&(x<bounds.left-inflation||x>bounds.right+inflation||y<bounds.top-inflation||y>bounds.bottom+inflation))continue;
    const point=new DOMPoint(x,y).matrixTransform(matrix.inverse());
    probe??=projected.path.ownerDocument.createElement('canvas').getContext('2d');cache.probe=probe;if(!probe)return;
    let cached=geometryCache?.get(projected.path);
    if(!cached||cached.d!==projected.d){cached={d:projected.d,geometry:new Path2D(projected.d)};geometryCache?.set(projected.path,cached);}
    const geometry=cached.geometry;
    probe.lineWidth=parseFloat(style.strokeWidth)||1;probe.lineCap=style.strokeLinecap as CanvasLineCap;probe.lineJoin=style.strokeLinejoin as CanvasLineJoin;
    probe.miterLimit=parseFloat(style.strokeMiterlimit)||4;
    probe.setLineDash(style.strokeDasharray==='none'?[]:style.strokeDasharray.split(/[ ,]+/).map(parseFloat));
    probe.lineDashOffset=parseFloat(style.strokeDashoffset)||0;
    const fill=style.fill!=='none'&&Number(style.fillOpacity)>0,stroke=style.stroke!=='none'&&Number(style.strokeOpacity)>0;
    const exact=(fill&&probe.isPointInPath(geometry,point.x,point.y,style.fillRule as CanvasFillRule))||(stroke&&probe.isPointInStroke(geometry,point.x,point.y));
    let near=false;
    if(!exact&&(fill||stroke)&&Number.isFinite(marginPx)&&marginPx>0){
      // Transform the evaluated contribution into screen coordinates first, so
      // the interaction corridor stays constant under zoom and unequal scales.
      const screen=new Path2D();
      if(typeof screen.addPath==='function'&&[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].every(Number.isFinite)){
        screen.addPath(geometry,{a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f});
        probe.lineWidth=marginPx*2;probe.lineCap='round';probe.lineJoin='round';probe.setLineDash([]);probe.lineDashOffset=0;
        near=probe.isPointInStroke(screen,x,y);
      }
    }
    if(exact||near)hits.push({id:node.id,paint:projected.path,order,near:!exact});
    }
  });
  // Later SVG paint is visually above earlier paint. Shared paint has no separate z-order: source order is a stable tie-break.
  hits.sort((a,b)=>Number(a.near)-Number(b.near)||(a.paint===b.paint?a.order-b.order:(a.paint.compareDocumentPosition(b.paint)&4)?1:-1));
  return [...new Set(hits.map(hit=>hit.id))];
}
