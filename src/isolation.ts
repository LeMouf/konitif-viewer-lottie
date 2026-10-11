import { selectedPathLeaves, type LottiePathNode } from './paths.js';
import { resolveProjectedPaths } from './highlight.js';
import { lottieAncestors } from './visibility.js';
interface LayerView {elements?:LayerView[];layerElement?:SVGGraphicsElement;baseElement?:SVGElement}

/** Presentation only. Shared paint stays intact whenever one of its contributions is selected. */
export function createLottieIsolation(renderer:LayerView,nodes:readonly LottiePathNode[]){
  const modified=new Map<SVGElement,{opacity:string;priority:string;marker:string|null}>();
  const restore=()=>{for(const [element,old] of modified){if(old.opacity)element.style.setProperty('opacity',old.opacity,old.priority);else element.style.removeProperty('opacity');if(old.marker===null)element.removeAttribute('data-lottie-dim-factor');else element.setAttribute('data-lottie-dim-factor',old.marker);}modified.clear();};
  const dim=(element:SVGElement)=>{
    if(modified.has(element))return;
    modified.set(element,{opacity:element.style.getPropertyValue('opacity'),priority:element.style.getPropertyPriority('opacity'),marker:element.getAttribute('data-lottie-dim-factor')});
    const opacity=Number(element.ownerDocument.defaultView!.getComputedStyle(element).opacity);
    element.style.setProperty('opacity',String((Number.isFinite(opacity)?opacity:1)*0.3));element.setAttribute('data-lottie-dim-factor','0.3');
  };
  return {restore,update(ids:readonly string[],influences:Readonly<Record<string,readonly string[]>>={}){
    restore();if(!ids.length)return;
    const selected=new Set(ids),leaves=selectedPathLeaves(nodes,ids,influences),leafIds=new Set(leaves.map(n=>n.id));
    const kept=new Set<SVGGraphicsElement>(leaves.flatMap(node=>resolveProjectedPaths(renderer,node).map(p=>p.path)));
    const dimmedRoutes:number[][]=[];
    for(const node of nodes){
      if(!['layer','precomposition'].includes(node.kind))continue;
      if(dimmedRoutes.some(route=>route.every((n,i)=>node.layerRoute[i]===n)))continue;
      if(selected.has(node.id)||lottieAncestors(nodes,node.id).some(id=>selected.has(id)))continue;
      const relevant=nodes.some(other=>(selected.has(other.id)||leafIds.has(other.id))&&lottieAncestors(nodes,other.id).includes(node.id));
      if(!relevant){let layer:LayerView|undefined=renderer;for(const index of node.layerRoute)layer=layer?.elements?.[index];const element=layer?.baseElement??layer?.layerElement;if(element){dim(element);dimmedRoutes.push(node.layerRoute);}continue;}
      for(const child of nodes.filter(child=>child.layerRoute.join('/')===node.layerRoute.join('/'))){
        for(const projected of resolveProjectedPaths(renderer,child))if(!kept.has(projected.path))dim(projected.path);
      }
    }
  }};
}
