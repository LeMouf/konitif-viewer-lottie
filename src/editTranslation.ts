import type {LottiePathNode} from './paths.js';
/** Version-pinned observation adapter. Convert screen deltas into the position
 * property's parent space, including authored parenting, precomps and camera. */
export function lottieTranslationDelta(renderer:any,node:LottiePathNode,dx:number,dy:number):{dx:number;dy:number}|null {
 let layer=renderer;for(const index of node.layerRoute)layer=layer?.elements?.[index];
 let container:SVGGraphicsElement|undefined=layer?.layerElement,own=layer?.finalTransform?.mProp?.v?.props,items=layer?.itemsData;
 for(const index of node.shapeRoute){const shape=items?.[index];if(!shape)return null;container=shape.gr;items=shape.it;own=items?.at(-1)?.transform?.mProps?.v?.props;}
 if(!['layer','precomposition','group'].includes(node.kind)||!container||!own)return null;
 const matrix=container.getScreenCTM();if(!matrix)return null;
 const det=matrix.a*matrix.d-matrix.b*matrix.c;if(!Number.isFinite(det)||Math.abs(det)<1e-12)return null;
 const x=(matrix.d*dx-matrix.c*dy)/det,y=(-matrix.b*dx+matrix.a*dy)/det;
 const result={dx:own[0]*x+own[4]*y,dy:own[1]*x+own[5]*y};return Object.values(result).every(Number.isFinite)?result:null;
}
