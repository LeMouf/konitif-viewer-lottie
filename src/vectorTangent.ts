/** Shared host-side vector editing algebra. Renderers project; each document host owns validation and history. */
export type VectorPoint2=readonly [number,number];
export type VectorTangentMode='corner'|'smooth'|'symmetric';
export interface VectorVertex2 {point:VectorPoint2;in:VectorPoint2;out:VectorPoint2;tangentMode?:VectorTangentMode}
export function editVectorTangent<T extends VectorVertex2>(vertex:T,side:'in'|'out',vector:VectorPoint2,mode:VectorTangentMode=vertex.tangentMode??'symmetric'):T{
 if(vector.some(v=>!Number.isFinite(v)))throw Error('Tangente invalide.');const other=side==='in'?'out':'in',next={...vertex,[side]:[...vector]};if(mode!=='corner'){const size=Math.hypot(...vector),length=mode==='symmetric'?size:Math.hypot(...vertex[other]);next[other]=size?[-vector[0]/size*length,-vector[1]/size*length]:[0,0];}return next as T;
}
