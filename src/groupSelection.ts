import {selectedPathLeaves, type LottiePathNode} from './paths.js';
import {resolveLottieTypeLineage, type LottieStyleSubjects} from './lineageTypes.js';
import {lottiePathTypes, lottieNeutralColor, type LottiePathType} from './pathTypes.js';
import type {LottieSelectionBounds} from './contracts.js';

/** Observed geometry only. Source identities and type inheritance remain authoritative. */
export function readGroupSelection(nodes:readonly LottiePathNode[],ids:readonly string[],observed:readonly LottieSelectionBounds[],types:Readonly<Record<string,LottiePathType>>={},influences:LottieStyleSubjects={}) {
  const selected=new Set(ids),byId=new Map(nodes.map(node=>[node.id,node]));
  const roots=nodes.filter(node=>selected.has(node.id)).filter(node=>{
    let parent=node.parentId;
    while(parent){if(selected.has(parent))return false;parent=byId.get(parent)?.parentId??null;}
    return true;
  });
  if(!roots.length||!roots.some(node=>['layer','precomposition','group','document','style'].includes(node.kind))&&ids.length<2)return null;
  const leaves=new Set(selectedPathLeaves(nodes,ids,influences).map(node=>node.id));
  const boxes=observed.filter(value=>leaves.has(value.id)).map(value=>value.bounds).filter(box=>[box.left,box.top,box.right,box.bottom].every(Number.isFinite));
  if(!boxes.length)return null;
  const lineage=resolveLottieTypeLineage(nodes,types,influences);
  const typeSet=new Set(roots.flatMap(node=>lineage[node.id]?.types??[]));
  const colors=Object.entries(lottiePathTypes).filter(([type])=>typeSet.has(type as LottiePathType)).map(([,value])=>value.color);
  const left=Math.min(...boxes.map(box=>box.left)),top=Math.min(...boxes.map(box=>box.top)),right=Math.max(...boxes.map(box=>box.right)),bottom=Math.max(...boxes.map(box=>box.bottom));
  return {bounds:{left,top,right,bottom,width:right-left,height:bottom-top},colors:colors.length?colors:[lottieNeutralColor],count:boxes.length,roots:roots.map(node=>node.id)};
}

let occurrence=0;
/** Overlay outside the camera group. Screen observations are converted to the root SVG frame each time. */
export function createGroupSelectionOverlay(target:HTMLElement) {
  let layer:SVGGElement|undefined;
  const gradientId='konitif-group-selection-'+(++occurrence),ns='http://www.w3.org/2000/svg';
  return {
    update(reading:ReturnType<typeof readGroupSelection>) {
      layer?.remove(); layer=undefined;
      if(!reading)return;
      const svg=target.querySelector('svg'),matrix=svg?.getScreenCTM();
      if(!svg||!matrix||Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)<1e-12)return;
      const inverse=matrix.inverse(),{left,top,right,bottom}=reading.bounds;
      const points=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y])=>({x:inverse.a*x+inverse.c*y+inverse.e,y:inverse.b*x+inverse.d*y+inverse.f}));
      const doc=target.ownerDocument;
      layer=doc.createElementNS(ns,'g');layer.setAttribute('data-lottie-group-selection','');layer.setAttribute('data-selection-count',String(reading.count));layer.setAttribute('data-selection-colors',reading.colors.join(','));layer.setAttribute('aria-hidden','true');layer.setAttribute('pointer-events','none');
      const path=doc.createElementNS(ns,'path');
      path.setAttribute('d',points.map((point,i)=>(i?'L':'M')+point.x+' '+point.y).join('')+'Z');path.setAttribute('fill','none');path.setAttribute('stroke-width','1.5');path.setAttribute('stroke-opacity','0.8');path.setAttribute('vector-effect','non-scaling-stroke');
      if(reading.colors.length>1){
        const defs=doc.createElementNS(ns,'defs'),gradient=doc.createElementNS(ns,'linearGradient');gradient.id=gradientId;
        for(const [i,color]of reading.colors.entries())for(const offset of [i/reading.colors.length,(i+1)/reading.colors.length]){const stop=doc.createElementNS(ns,'stop');stop.setAttribute('offset',String(offset));stop.setAttribute('stop-color',color);gradient.append(stop);}
        defs.append(gradient);layer.append(defs);path.setAttribute('stroke','url(#'+gradientId+')');
      }else path.setAttribute('stroke',reading.colors[0]);
      layer.append(path);svg.append(layer);
    },
    dispose(){layer?.remove();layer=undefined;}
  };
}
