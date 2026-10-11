import type { LottiePathNode } from './paths.js';
export function lottieAncestors(nodes:readonly LottiePathNode[],id:string):string[]{
 const byId=new Map(nodes.map(node=>[node.id,node])),result:string[]=[];let parent=byId.get(id)?.parentId;
 while(parent){result.push(parent);parent=byId.get(parent)?.parentId;}return result;
}
export function isLottieNodeHidden(nodes:readonly LottiePathNode[],id:string,hiddenIds:readonly string[]):boolean {
 const hidden=new Set(hiddenIds);return hidden.has(id)||lottieAncestors(nodes,id).some(parent=>hidden.has(parent));
}
export function lottieVisibilityState(nodes:readonly LottiePathNode[],id:string,hiddenIds:readonly string[]):'visible'|'hidden'|'inherited'|'mixed'{
 if(hiddenIds.includes(id))return 'hidden';if(isLottieNodeHidden(nodes,id,hiddenIds))return 'inherited';
 return hiddenIds.some(hidden=>lottieAncestors(nodes,hidden).includes(id))?'mixed':'visible';
}
interface LayerView {elements?:LayerView[];layerElement?:SVGElement;baseElement?:SVGElement;}
/** Visibility is limited to whole occurrences; shared paint is never split. */
export function createLottieVisibility(renderer:LayerView,nodes:readonly LottiePathNode[]){
 const modified=new Map<SVGElement,string|null>();
 const restore=()=>{for(const [element,value] of modified){if(value===null)element.removeAttribute('visibility');else element.setAttribute('visibility',value);}modified.clear();};
 return {update(ids:readonly string[]){restore();
  for(const node of nodes){if(!ids.includes(node.id)||!['layer','precomposition'].includes(node.kind))continue;
   let layer:LayerView|undefined=renderer;for(const index of node.layerRoute)layer=layer?.elements?.[index];
   const element=layer?.baseElement??layer?.layerElement;if(!element)continue;
   if(!modified.has(element))modified.set(element,element.getAttribute('visibility'));element.setAttribute('visibility','hidden');
  }
 },dispose:restore};
}
