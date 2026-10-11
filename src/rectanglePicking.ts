import { projectedPathBounds } from './projectedGeometry.js';
import { resolveProjectedPaths } from './highlight.js';
import { compositionClipRectangle } from './picking.js';
import type { LottiePathNode } from './paths.js';
import type { LottieSelectionBounds } from './contracts.js';

/** Full containment of each evaluated contribution. Clipped composition rectangles are intersected. */
export function readLottieSelectionBounds(renderer:Parameters<typeof resolveProjectedPaths>[0],nodes:readonly LottiePathNode[],geometryCache=new Map<string,ReturnType<typeof projectedPathBounds>>()):LottieSelectionBounds[]{
  const result:LottieSelectionBounds[]=[];
  const styles=new Map<Element,CSSStyleDeclaration>(),matrices=new Map<SVGGraphicsElement,DOMMatrix|null>();
  const styleAt=(element:Element)=>{let value=styles.get(element);if(!value){value=element.ownerDocument.defaultView!.getComputedStyle(element);styles.set(element,value);}return value;};
  const matrixAt=(element:SVGGraphicsElement)=>{if(!matrices.has(element))matrices.set(element,element.getScreenCTM?.()??null);return matrices.get(element)!;};
  for(const node of nodes){
    if(!node.selectable||(!['path','shape'].includes(node.kind)&&!node.solid))continue;
    const contributions: LottieSelectionBounds['bounds'][]=[];
    for(const projected of resolveProjectedPaths(renderer,node)){
      const {path,d}=projected;
      const matrix=matrixAt(path);if(!matrix||Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)<1e-12)continue;
      if(!geometryCache.has(d)){if(geometryCache.size>=2048)geometryCache.delete(geometryCache.keys().next().value!);geometryCache.set(d,projectedPathBounds(d));}
      const box=geometryCache.get(d);if(!box)continue;
      const transform=(box:{x:number;y:number;width:number;height:number},matrix:DOMMatrix)=>{
        const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
        return {left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
      };
      const bounds=transform(box,matrix);let admitted=true;
      for(let element:Element|null=path;element&&element.namespaceURI==='http://www.w3.org/2000/svg';element=element.parentElement){
        const style=styleAt(element);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0){admitted=false;break;}
        if((element.getAttribute('mask')&&element.getAttribute('mask')!=='none')||(style.maskImage&&style.maskImage!=='none')){admitted=false;break;}
        const clip=element.getAttribute('clip-path');if(!clip||clip==='none')continue;
        const id=clip.match(/#([^)'"\s]+)/)?.[1],definition=id?path.ownerDocument.getElementById(id):null;
        if(definition===projected.qualifiedClip)continue;
        const clipBox=compositionClipRectangle(definition),clipMatrix=matrixAt(element as SVGGraphicsElement);
        if(!clipBox||!clipMatrix){admitted=false;break;}
        const limit=transform(clipBox,clipMatrix);
        bounds.left=Math.max(bounds.left,limit.left);bounds.right=Math.min(bounds.right,limit.right);
        bounds.top=Math.max(bounds.top,limit.top);bounds.bottom=Math.min(bounds.bottom,limit.bottom);
      }
      if(admitted&&bounds.right>=bounds.left&&bounds.bottom>=bounds.top)contributions.push({...bounds,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top});
    }
    if(contributions.length){
      const left=Math.min(...contributions.map(b=>b.left)),top=Math.min(...contributions.map(b=>b.top)),right=Math.max(...contributions.map(b=>b.right)),bottom=Math.max(...contributions.map(b=>b.bottom));
      result.push({id:node.id,bounds:{left,top,right,bottom,width:right-left,height:bottom-top}});
    }
  }
  return result;
}
