import {classifyLottiePath,lottieTypeColor} from './pathTypes.js';
import {defaultLottiePathAppearance,type LottiePathAppearance} from './pathAppearance.js';
import type {LottiePathNode} from './paths.js';
import {resolveProjectedPath,isProjectedPathVisible,mountInteractionInFront} from './highlight.js';
import {inspectProjectedConstruction,type Point} from './projectedGeometry.js';
export {inspectProjectedConstruction,isStraightCubic} from './projectedGeometry.js';
export type {Point,Segment} from './projectedGeometry.js';
const same=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-6;
/** Screen-aligned marker at the requested pixel size, mapped back into SVG paint coordinates. */
export function screenSquare(point:Point,m:{a:number;b:number;c:number;d:number;e:number;f:number},half=3):Point[]{
 const determinant=m.a*m.d-m.b*m.c;if(Math.abs(determinant)<1e-12)return [];
 const sx=m.a*point.x+m.c*point.y+m.e,sy=m.b*point.x+m.d*point.y+m.f;
 return [[-half,-half],[half,-half],[half,half],[-half,half]].map(([x,y])=>({x:(m.d*(sx+x-m.e)-m.c*(sy+y-m.f))/determinant,y:(-m.b*(sx+x-m.e)+m.a*(sy+y-m.f))/determinant}));
}
export function createConstructionOverlay(renderer:Parameters<typeof resolveProjectedPath>[0],nodes:readonly LottiePathNode[]){
 let group:SVGGElement|null=null,layer:SVGGElement|null=null,summary='';
 const clear=()=>{layer?.remove();group?.remove();layer=null;group=null;summary='';};
 return {clear,summary:()=>summary,update(ids:readonly string[],context?:Readonly<LottiePathAppearance>,viewScale=1,selectionAppearance:Readonly<LottiePathAppearance>=defaultLottiePathAppearance){
  clear();if(!ids.length)return;
  const selectedNode=ids.length===1?nodes.find(n=>n.id===ids[0]):undefined;
  const node=selectedNode?.solid==='single-additive'?nodes.find(n=>n.kind==='mask'&&n.parentId===selectedNode.id&&n.maskQualified):selectedNode;
  if(selectedNode?.solid&&selectedNode.solid!=='single-additive'){summary='Solide couleur : aucun masque vectoriel qualifié pour les repères.';return;}
  if(!node||!['path','mask'].includes(node.kind)){summary='Repères : sélectionner un seul tracé Bézier ; groupes et formes paramétriques sans conversion.';return;}
  const projected=resolveProjectedPath(renderer,node);if(!projected||!isProjectedPathVisible(projected.path)){summary='Repères : tracé non visible à cet instant.';return;}
  try{
   const geometry=inspectProjectedConstruction(projected.d),matrix=projected.path.getScreenCTM();if(!matrix)return;
   const pathType=classifyLottiePath(node,projected.d),appearance=context??selectionAppearance,contextColor=lottieTypeColor(pathType,appearance);
   const doc=projected.path.ownerDocument,ns='http://www.w3.org/2000/svg';group=doc.createElementNS(ns,'g');group.setAttribute(context?'data-lottie-global-construction':'data-lottie-construction',node.id);group.setAttribute('data-lottie-path-type',pathType);if(context){group.setAttribute('opacity',String(context.opacity));}group.setAttribute('pointer-events','none');group.setAttribute('aria-hidden','true');
   const draw=(d:string,stroke:string,width:string,dash?:string,fill='none')=>{const path=doc.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('fill',fill);path.setAttribute('stroke',contextColor??stroke);path.setAttribute('stroke-width',context?String(Math.min(context.width,1.5)):width);path.setAttribute('vector-effect','non-scaling-stroke');if(dash)path.setAttribute('stroke-dasharray',dash);group!.append(path);};
   const marker=(p:Point,control:boolean)=>{const corners=screenSquare(p,matrix,(control?2.5:3)*viewScale);if(corners.length)draw(`M${corners.map(v=>`${v.x},${v.y}`).join('L')}Z`,control?'#19668f':'#17212b','1',undefined,control?'none':'#ffffff');};
   for(const segment of geometry.segments){
    if(!context)draw(`M${segment.from.x},${segment.from.y}${segment.c1&&segment.c2?`C${segment.c1.x},${segment.c1.y} ${segment.c2.x},${segment.c2.y} ${segment.to.x},${segment.to.y}`:`L${segment.to.x},${segment.to.y}`}`,'#ffdd75','1.3',segment.straight?'4 3':undefined);
    for(const [vertex,control] of [[segment.from,segment.c1],[segment.to,segment.c2]] as const){if(control&&!same(vertex,control)){draw(`M${vertex.x},${vertex.y}L${control.x},${control.y}`,'#19668f','1','2 2');marker(control,true);}}
   }
   geometry.vertices.forEach(p=>marker(p,false));layer=mountInteractionInFront(projected.path,group,true,projected.qualifiedClip,!!context);
   layer?.removeAttribute('data-lottie-selection-layer');layer?.setAttribute(context?'data-lottie-global-construction-layer':'data-lottie-construction-layer','');
   const straight=geometry.segments.filter(s=>s.straight).length;
   summary=`${node.kind==='mask'?'Masque vectoriel source · '+node.label+' · construction évaluée':'Construction projetée'} · ${geometry.vertices.length} sommets carrés · ${straight} segments droits pointillés · ${geometry.segments.length-straight} courbes continues · contrôles creux et guides pointillés · lecture seule.`;
  }catch(cause){summary=cause instanceof Error?cause.message:'Repères indisponibles.';clear();summary=cause instanceof Error?cause.message:'Repères indisponibles.';}
 }};
}
