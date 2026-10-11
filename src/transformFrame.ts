import type {LottieTransformFrame} from './contracts.js';
import type {LottiePathNode} from './paths.js';
export const inverseLinear=(m:readonly number[]):number[]|null=>{const det=m[0]*m[3]-m[1]*m[2];if(!Number.isFinite(det)||Math.abs(det)<1e-10)return null;return [m[3]/det,-m[1]/det,-m[2]/det,m[0]/det];};
const multiply=(a:readonly number[],b:readonly number[])=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3]];
/** Pinned native observation; document writes stay with the host. */
export function lottieTransformFrame(renderer:any,node:LottiePathNode):LottieTransformFrame|null{
 if(!node.selectable||!['layer','precomposition','group'].includes(node.kind))return null;
 let layer=renderer;for(const i of node.layerRoute){layer=layer?.elements?.[i];if(layer?.data?.ddd)return null;}
 let container=layer?.layerElement,prop=layer?.finalTransform?.mProp,items=layer?.itemsData;
 for(const i of node.shapeRoute){const shape=items?.[i];container=shape?.gr;items=shape?.it;prop=items?.find((x:any)=>x?.transform)?.transform?.mProps;}
 const m=container?.getScreenCTM(),v=prop?.v?.props,anchor=prop?.a?.v;if(!m||!v||!anchor||v[2]||v[6]||v[8]||v[9]||v[3]||v[7]||v[11])return null;
 const screen=[m.a,m.b,m.c,m.d],own=[v[0],v[1],v[4],v[5]],localInverse=inverseLinear(screen),ownInverse=inverseLinear(own);
 if(!localInverse||!ownInverse)return null;const parentInverse=inverseLinear(multiply(screen,ownInverse));if(!parentInverse)return null;
 const pivot={x:m.a*anchor[0]+m.c*anchor[1]+m.e,y:m.b*anchor[0]+m.d*anchor[1]+m.f};
 return [...screen,...own,pivot.x,pivot.y].every(Number.isFinite)?{pivot,parentInverse,localInverse,own}:null;
}
export function transformGestureValues(mode:'move'|'rotate'|'scale'|'pivot',frame:LottieTransformFrame,start:{x:number;y:number},end:{x:number;y:number},values:Partial<Record<'p'|'a'|'s'|'r',readonly number[]>>){
 const apply=(m:readonly number[],x:number,y:number)=>[m[0]*x+m[2]*y,m[1]*x+m[3]*y];
 const dx=end.x-start.x,dy=end.y-start.y,delta=apply(frame.parentInverse,dx,dy),next=(key:'p'|'a'|'s'|'r')=>values[key]?[...values[key]!]:null;
 if(mode==='move'){const p=next('p');if(!p)return null;p[0]+=delta[0];p[1]+=delta[1];return {p};}
 if(mode==='pivot'){const a=next('a'),p=next('p');if(!a||!p)return null;const local=apply(frame.localInverse,dx,dy),compensation=apply(frame.own,...local as [number,number]);a[0]+=local[0];a[1]+=local[1];p[0]+=compensation[0];p[1]+=compensation[1];return {a,p};}
 const u=apply(frame.parentInverse,start.x-frame.pivot.x,start.y-frame.pivot.y),v=apply(frame.parentInverse,end.x-frame.pivot.x,end.y-frame.pivot.y),length=Math.hypot(...u);if(length<1e-6)return null;
 if(mode==='rotate'){const r=next('r');if(!r)return null;const angle=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);r[0]+=angle*180/Math.PI;return {r};}
 const s=next('s'),factor=Math.hypot(...v)/length;if(!s||factor<1e-6)return null;s[0]*=factor;s[1]*=factor;return {s};
}
