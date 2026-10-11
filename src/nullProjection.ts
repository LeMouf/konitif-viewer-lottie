import type {LottiePathNode} from './paths.js';
import type {LottiePathAppearance} from './pathAppearance.js';
import {lottieNeutralColor} from './pathTypes.js';
import {isLottieNodeHidden} from './visibility.js';
import {isProjectedPathVisible,mountInteractionInFront} from './highlight.js';
interface Affine {a:number;b:number;c:number;d:number;e:number;f:number;}
interface NullLayer {
 elements?:NullLayer[];layerElement?:SVGGraphicsElement;renderedFrame?:number;isInRange?:boolean;
 data?:{ty?:number;ip?:number;op?:number;hd?:boolean};
 finalTransform?:{mProp?:{v?:{props:ArrayLike<number>}}};hierarchy?:NullLayer[];
}
const apply=(m:Affine,p:{x:number;y:number})=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});
function affine(props:ArrayLike<number>|undefined):Affine|null{
 if(!props||props.length!==16)return null;const values=[props[0],props[1],props[4],props[5],props[12],props[13]];if(!values.every(Number.isFinite))return null;
 return {a:values[0],b:values[1],c:values[2],d:values[3],e:values[4],f:values[5]};
}
/** Pinned lottie-web NullElement.renderFrame is empty: finalTransform.mat is NOT updated.
 * mProp.v is evaluated by prepareFrame. Apply it then each authored transform parent,
 * once, within the composition. Its actual SVG container provides precomp and view CTMs. */
export function resolveLottieNullOrigin(renderer:NullLayer,node:LottiePathNode){
 if(node.sourceType!=='3'||!node.selectable)return null;let comp:NullLayer=renderer,layer:NullLayer|undefined;
 for(let i=0;i<node.layerRoute.length;i++){layer=comp.elements?.[node.layerRoute[i]];if(!layer)return null;if(i<node.layerRoute.length-1)comp=layer;}
 if(!layer||layer.data?.hd||comp.isInRange===false||!comp.layerElement||!isProjectedPathVisible(comp.layerElement))return null;
 const frame=comp.renderedFrame;if(typeof frame!=='number'||(typeof layer.data?.ip==='number'&&frame<layer.data.ip)||(typeof layer.data?.op==='number'&&frame>=layer.data.op))return null;
 let origin={x:0,y:0};const seen=new Set<NullLayer>();
 for(const member of [layer,...(layer.hierarchy??[])]){if(seen.has(member))return null;seen.add(member);const m=affine(member.finalTransform?.mProp?.v?.props);if(!m)return null;origin=apply(m,origin);}
 const matrix=comp.layerElement.getScreenCTM();if(!matrix||![matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f,origin.x,origin.y].every(Number.isFinite)||Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)<1e-12)return null;
 return {origin,screen:apply(matrix,origin),matrix,container:comp.layerElement};
}
/** Non-interactive feedback only. No synthetic rectangle, no new canvas hit target. */
export function createLottieNullOverlay(renderer:NullLayer,nodes:readonly LottiePathNode[]){
 let layers:SVGGElement[]=[],summary='';
 const clear=()=>{layers.forEach(layer=>layer.remove());layers=[];summary='';};
 return {clear,summary:()=>summary,visible:(id:string,hidden:readonly string[])=>{const node=nodes.find(n=>n.id===id);return !!node&&!isLottieNodeHidden(nodes,id,hidden)&&!!resolveLottieNullOrigin(renderer,node);},
 update(selected:readonly string[],hovered:readonly string[],showPaths:boolean,appearance:Readonly<LottiePathAppearance>,viewScale:number,hidden:readonly string[]){
  clear();for(const node of nodes){if(node.sourceType!=='3'||isLottieNodeHidden(nodes,node.id,hidden))continue;
   const strong=selected.includes(node.id),over=hovered.includes(node.id);if(!strong&&!over&&!showPaths)continue;
   const projected=resolveLottieNullOrigin(renderer,node);if(!projected)continue;
   const {origin,matrix,container}=projected,half=5*viewScale,det=matrix.a*matrix.d-matrix.b*matrix.c;
   const local=(x:number,y:number)=>({x:origin.x+(matrix.d*x-matrix.c*y)/det,y:origin.y+(-matrix.b*x+matrix.a*y)/det});
   const a=local(-half,0),b=local(half,0),c=local(0,-half),d=local(0,half),path=container.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d',`M${a.x},${a.y}L${b.x},${b.y}M${c.x},${c.y}L${d.x},${d.y}`);path.setAttribute('data-lottie-null-origin',node.id);path.setAttribute('data-origin-x',String(origin.x));path.setAttribute('data-origin-y',String(origin.y));path.setAttribute('data-null-state',strong?'selected':over?'hover':'context');
   path.setAttribute('fill','none');path.setAttribute('stroke',lottieNeutralColor);path.setAttribute('stroke-width',strong?'2':over?'1.5':'1');path.setAttribute('opacity',String(strong||over?1:Math.min(.6,appearance.opacity)));if(over&&!strong)path.setAttribute('stroke-dasharray','2 2');
   path.setAttribute('vector-effect','non-scaling-stroke');path.setAttribute('pointer-events','none');path.setAttribute('aria-hidden','true');
   const layer=mountInteractionInFront(container,path,strong,undefined,!strong&&!over);if(layer){layer.setAttribute('data-lottie-null-layer','');layers.push(layer);}
   if(strong)summary=`Calque nul · ${node.label} · origine locale (0,0) projetée à (${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}) dans sa composition · croix sans édition ni prise au clic.`;
  }
 }};
}
