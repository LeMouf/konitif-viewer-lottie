import {selectedPathLeaves} from './paths.js';
import {resolveProjectedPaths} from './highlight.js';
import type {LottiePathNode} from './paths.js';
type Matrix=readonly number[];
export const multiplyAffine=(a:Matrix,b:Matrix)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export const inverseAffine=(a:Matrix)=>{const det=a[0]*a[3]-a[1]*a[2];if(!Number.isFinite(det)||Math.abs(det)<1e-10)return null;return [a[3]/det,-a[1]/det,-a[2]/det,a[0]/det,(a[2]*a[5]-a[3]*a[4])/det,(a[1]*a[4]-a[0]*a[5])/det];};
const coefficients=(m:any)=>m&&[m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite)?[m.a,m.b,m.c,m.d,m.e,m.f]:null;
/** Temporary DOM projection only; never changes vendor properties or source data. */
export function createLiveLottieTransform(renderer:any,nodes:readonly LottiePathNode[]){
 let owner:string|null=null,snapshots:{element:SVGGraphicsElement;attribute:string|null;screen:number[];parentInverse:number[]}[]=[];
 const clear=()=>{for(const s of snapshots){if(s.attribute===null)s.element.removeAttribute('transform');else s.element.setAttribute('transform',s.attribute);}snapshots=[];owner=null;};
 return {clear,preview(id:string,delta:Matrix){
  if(delta.length!==6||!delta.every(Number.isFinite))return false;
  if(owner!==id){clear();const node=nodes.find(n=>n.id===id);if(!node||!['group','layer','precomposition'].includes(node.kind))return false;
   let scope=renderer,layer:any;for(const i of node.layerRoute){scope=layer?.elements??scope;layer=scope?.elements?.[i]??scope?.[i];}if(!layer)return false;
   let container=layer.layerElement,items=layer.itemsData;for(const i of node.shapeRoute){container=items?.[i]?.gr;items=items?.[i]?.it;}if(!container)return false;
   if(node.shapeRoute.length&&selectedPathLeaves(nodes,[id]).some(leaf=>resolveProjectedPaths(renderer,leaf).some(p=>!container.contains(p.path))))return false;
   const elements:SVGGraphicsElement[]=[container];
   // AE parenting is baked into sibling SVG layer matrices, so descendants
   // must follow the same screen delta even though they are not DOM children.
   if(!node.shapeRoute.length){const siblings=Array.isArray(scope)?scope:scope?.elements;const included=new Set<any>([layer]);let changed=true;while(changed){changed=false;for(const child of siblings??[]){if(child&&!included.has(child)&&[...included].some(parent=>parent.data?.ind!==undefined&&child.data?.parent===parent.data.ind)){included.add(child);changed=true;}}}for(const child of included)if(child!==layer&&child.layerElement)elements.push(child.layerElement);}
   const pending=[];for(const element of elements){const screen=coefficients(element.getScreenCTM()),parent=coefficients((element.parentElement as unknown as SVGGraphicsElement)?.getScreenCTM?.()),parentInverse=parent&&inverseAffine(parent);if(!screen||!parentInverse)return false;pending.push({element,attribute:element.getAttribute('transform'),screen,parentInverse});}
   snapshots=pending;owner=id;
  }
  const matrices=snapshots.map(s=>multiplyAffine(s.parentInverse,multiplyAffine(delta,s.screen)));if(!matrices.every(matrix=>matrix.every(Number.isFinite)))return false;
  snapshots.forEach((s,i)=>s.element.setAttribute('transform','matrix('+matrices[i].join(',')+')'));return true;
 }};
}

