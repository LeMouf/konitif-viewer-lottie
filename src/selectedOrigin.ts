import type {LottiePathNode} from './paths.js';
import {resolveLottieTypeLineage} from './lineageTypes.js';
import {lottiePathTypes,type LottiePathType} from './pathTypes.js';
import {isProjectedPathVisible} from './highlight.js';
import {isLottieNodeHidden} from './visibility.js';
interface Anchor {v:ArrayLike<number>;}
interface Shape {gr?:SVGGraphicsElement;it?:Shape[];transform?:{mProps?:{a?:Anchor}};}
interface Layer {elements?:Layer[];itemsData?:Shape[];layerElement?:SVGGraphicsElement;finalTransform?:{mProp?:{a?:Anchor}};}
/** Evaluated anchor projected through the complete native layer/group and ancestor matrix. */
export function selectedLottieOrigin(renderer:Layer,node:LottiePathNode,hidden:readonly string[]){
 if(!node.selectable||node.sourceType==='3'||isLottieNodeHidden([node],node.id,hidden))return null;
 let layer:Layer|undefined=renderer;for(const i of node.layerRoute)layer=layer?.elements?.[i];
 let container=layer?.layerElement,items=layer?.itemsData,anchor=layer?.finalTransform?.mProp?.a?.v;
 for(const i of node.shapeRoute){const shape:Shape|undefined=items?.[i];if(!shape)return null;if(shape.gr){container=shape.gr;const transform=shape.it?.find(item=>item.transform)?.transform;anchor=transform?transform.mProps?.a?.v:[0,0];}items=shape.it;}
 if(!container||!anchor||![anchor[0],anchor[1]].every(Number.isFinite)||!isProjectedPathVisible(container))return null;
 const matrix=container.getScreenCTM();if(!matrix||![matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].every(Number.isFinite)||Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)<1e-12)return null;
 return {x:matrix.a*anchor[0]+matrix.c*anchor[1]+matrix.e,y:matrix.b*anchor[0]+matrix.d*anchor[1]+matrix.f,space:node.shapeRoute.length?'espace du groupe de formes':'espace du calque'};
}
export function createSelectedOrigin(target:HTMLElement){
 let overlay:SVGGElement|undefined,summary='';
 const clear=()=>{overlay?.remove();overlay=undefined;summary='';};
 return {summary:()=>summary,dispose:clear,update(renderer:Layer,nodes:readonly LottiePathNode[],ids:readonly string[],hidden:readonly string[],visible:boolean,types:Readonly<Record<string,LottiePathType>>){
  clear();if(ids.length!==1||!visible)return;const node=nodes.find(n=>n.id===ids[0]);if(!node)return;
  if(isLottieNodeHidden(nodes,node.id,hidden))return;
  const point=selectedLottieOrigin(renderer,node,hidden),svg=target.querySelector('svg'),matrix=svg?.getScreenCTM();if(!point||!svg||!matrix)return;
  const inverse=matrix.inverse(),ns='http://www.w3.org/2000/svg',doc=target.ownerDocument;
  const transform=(x:number,y:number)=>({x:inverse.a*x+inverse.c*y+inverse.e,y:inverse.b*x+inverse.d*y+inverse.f});
  const a=transform(point.x-5,point.y),b=transform(point.x+5,point.y),c=transform(point.x,point.y-5),d=transform(point.x,point.y+5);
  overlay=doc.createElementNS(ns,'g');overlay.setAttribute('data-lottie-selected-origin',node.id);overlay.setAttribute('data-origin-space',point.space);overlay.setAttribute('pointer-events','none');overlay.setAttribute('aria-hidden','true');
  const type=resolveLottieTypeLineage(nodes,types)[node.id]?.types[0];const color=type?lottiePathTypes[type].color:'#ffffff';
  for(const [stroke,width]of [['#17212b','4'],[color,'1.5']]){const path=doc.createElementNS(ns,'path');path.setAttribute('d',`M${a.x},${a.y}L${b.x},${b.y}M${c.x},${c.y}L${d.x},${d.y}`);path.setAttribute('fill','none');path.setAttribute('stroke',stroke);path.setAttribute('stroke-width',width);path.setAttribute('vector-effect','non-scaling-stroke');overlay.append(path);}
  svg.append(overlay);summary=`${node.label} · pivot/ancrage transformé dans l’${point.space} · distinct du centre géométrique · repère sans prise au clic.`;
 }};
}
