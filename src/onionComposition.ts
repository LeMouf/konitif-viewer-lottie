import {selectedPathLeaves,type LottiePathNode} from './paths.js';
import {resolveProjectedPaths,readProjectedTypeData,isProjectedPathVisible} from './highlight.js';
import {isLottieNodeHidden} from './visibility.js';
/** Only full-duration bottom paint with stable geometry and alpha is an underlay. No names or colour heuristics. */
export function onionUnderlayIndices(data:Record<string,unknown>):number[]{
 const layers=data.layers as Record<string,unknown>[],result:number[]=[];
 const animated=(value:unknown):boolean=>{if(!value||typeof value!=='object')return false;if(Array.isArray(value))return value.some(animated);const object=value as Record<string,unknown>;if(object.a===1||Array.isArray(object.k)&&object.k.some(k=>k&&typeof k==='object'&&'t' in k))return true;return Object.entries(object).some(([key,child])=>!(['fl','st'].includes(object.ty as string)&&key==='c')&&animated(child));};
 for(let i=layers.length-1;i>=0;i--){const layer=layers[i];if(layer.ty===3)continue;
  if(![1,4].includes(layer.ty as number)||layer.parent!==undefined||layer.tm!==undefined||Number(layer.ip)>Number(data.ip)||Number(layer.op)<Number(data.op)||animated(layer))break;
  result.push(i);
 }
 return result;
}
/** Copy the SVG with a source-to-copy map so spatially unchanged underlays can be omitted only in ghosts. */
export function cloneOnionPaint(original:Element,ghost:Element,omit:readonly Element[],selected?:ReadonlyMap<Element,string|undefined>){
 const copies=new Map<Element,Element>();
 const index=(source:Element,copy:Element)=>{copies.set(source,copy);Array.from(source.children).forEach((child,i)=>index(child,copy.children[i]));};
 for(const child of Array.from(original.children))if(!['title','desc'].includes(child.localName)){const copy=child.cloneNode(true) as Element;index(child,copy);ghost.append(copy);}
 for(const element of omit)copies.get(element)?.remove();
 if(selected){
  const paints=new Set(['path','rect','circle','ellipse','polygon','polyline','line','image','text','use','foreignObject']);
  for(const [element,copy]of copies){
   if(!paints.has(element.localName))continue;
   let definition=false;for(let p=element.parentElement;p&&p!==original;p=p.parentElement)if(['defs','clipPath','mask','filter','pattern','marker'].includes(p.localName)){definition=true;break;}
   if(definition)continue;
   if(!selected.has(element)){copy.remove();continue;}
   const d=selected.get(element);if(element.localName==='path'&&d!==undefined)copy.setAttribute('d',d);
  }
 }
}
export type OnionLayerProjection = Parameters<typeof resolveProjectedPaths>[0] & {baseElement?:SVGElement;elements?:OnionLayerProjection[];};
/** Underlays stay at their authored position; onion paint sits above them and below current foreground. */
export function mountOnionPaint(camera:Element,next:Element,indices:readonly number[],renderer?:OnionLayerProjection){
 const underlay=indices.length?renderer?.elements?.[indices[indices.length-1]]:undefined;
 const element=underlay?.baseElement??underlay?.layerElement,parent=element?.parentElement;
 if(parent&&camera.contains(element)){const siblings=Array.from(parent.children);parent.insertBefore(next,siblings[siblings.indexOf(element!)+1]??null);return;}
 camera.insertBefore(next,camera.firstChild);
}

/** Selection only filters copied paint; native wrappers, masks and definitions stay intact. */
export function onionSelectedPaint(renderer:Parameters<typeof resolveProjectedPaths>[0],nodes:readonly LottiePathNode[],ids:readonly string[],hidden:readonly string[]){
 const result=new Map<Element,string|undefined>(),influences=readProjectedTypeData(renderer,nodes).influences;
 for(const node of selectedPathLeaves(nodes,ids,influences)){
  if(isLottieNodeHidden(nodes,node.id,hidden))continue;
  for(const projected of resolveProjectedPaths(renderer,node)){
   if(!isProjectedPathVisible(projected.path))continue;
   const d=node.solid||node.kind==='mask'?undefined:projected.d;
   if(!result.has(projected.path))result.set(projected.path,d);
   else if(d!==undefined&&result.get(projected.path)!==undefined)result.set(projected.path,result.get(projected.path)+' '+d);
  }
 }
 return result;
}
