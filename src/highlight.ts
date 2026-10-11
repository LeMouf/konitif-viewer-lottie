import {omitCompositionCrop} from './compositionCrop.js';
import {classifyLottiePath,lottieTypeColor,type LottiePathType} from './pathTypes.js';
import type {LottieStyleSubjects} from './lineageTypes.js';
import {defaultLottiePathAppearance,type LottiePathAppearance} from './pathAppearance.js';
import {resolveSolidProjection} from './solid.js';
import { selectedPathLeaves, type LottiePathNode } from './paths.js';

// Version-pinned adapter for lottie-web 5.13.0 SVGShapeData. Never a canonical identity store.
interface ShapeView { it?: ShapeView[]; caches?: string[]; styles?: { pElem: SVGPathElement }[]; style?:{pElem?:SVGPathElement}; }
interface LayerView { elements?: LayerView[]; itemsData?: ShapeView[]; layerElement?:SVGGraphicsElement; }
export function resolveProjectedPaths(renderer: LayerView, node: LottiePathNode): { path: SVGGraphicsElement; d: string; qualifiedClip?:Element }[] {
  const result: {path:SVGGraphicsElement;d:string;qualifiedClip?:Element}[]=[];
  let layer: LayerView | undefined = renderer;
  for (const index of node.layerRoute) layer = layer?.elements?.[index];
  if(node.kind==='mask'){const projected=node.maskQualified?resolveSolidProjection(layer?.layerElement,{...node,solid:'single-additive'}):null;return projected?[projected]:[];}
  if(node.solid){const projected=resolveSolidProjection(layer?.layerElement,node);return projected?[projected]:[];}
  let items = layer?.itemsData, shape: ShapeView | undefined;
  for (const index of node.shapeRoute) { shape = items?.[index]; items = shape?.it; }
  // Each cache is the individual shape contribution in the corresponding paint path's coordinate system.
  // Several shapes may share pElem; highlighting its aggregate d would select the wrong geometry.
  for (let i = 0; i < (shape?.styles?.length ?? 0); i++) {
    const path = shape!.styles![i].pElem, d = shape?.caches?.[i];
    if (path?.parentNode && typeof d === 'string' && d) result.push({ path, d });
  }
  return result;
}
export function readProjectedTypeData(renderer:LayerView,nodes:readonly LottiePathNode[]):{types:Record<string,LottiePathType>;influences:Record<string,string[]>}{
 const types:Record<string,LottiePathType>={},influences:Record<string,string[]>={},paints=new Map<SVGGraphicsElement,string[]>();
 const shapeFor=(node:LottiePathNode)=>{let layer:LayerView|undefined=renderer;for(const index of node.layerRoute)layer=layer?.elements?.[index];let items=layer?.itemsData,shape:ShapeView|undefined;for(const index of node.shapeRoute){shape=items?.[index];items=shape?.it;}return shape;};
 for(const node of nodes){
  if(!['path','shape','mask'].includes(node.kind)&&!node.solid)continue;
  const projected=resolveProjectedPaths(renderer,node);if(projected[0])types[node.id]=classifyLottiePath(node,projected[0].d);
  // Vendor style associations are known even before a layer enters its time range.
  // Geometry caches may still be empty then; they must not erase this exact relation.
  for(const style of shapeFor(node)?.styles??[])if(style.pElem)paints.set(style.pElem,[...(paints.get(style.pElem)??[]),node.id]);
 }
 for(const node of nodes){if(node.kind!=='style')continue;const paint=shapeFor(node)?.style?.pElem;if(paint)influences[node.id]=[...new Set(paints.get(paint)??[])];}
 return {types,influences};
}
export function resolveProjectedPath(renderer:LayerView,node:LottiePathNode){return resolveProjectedPaths(renderer,node)[0]??null;}
export function isProjectedPathVisible(path: SVGGraphicsElement): boolean {
  for(let element:Element|null=path;element&&element.namespaceURI==='http://www.w3.org/2000/svg';element=element.parentElement){
    const style=path.ownerDocument.defaultView?.getComputedStyle(element);
    if(style&&(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0))return false;
  }
  return true;
}
const interactionBindings=new WeakMap<SVGElement,{path:SVGGraphicsElement;ancestors:Element[];ownClip?:Element;bindings:{original:Element;wrapper:SVGElement;css:boolean}[]}>();
function hasCurrentInteractionAncestry(layer:SVGElement,path:SVGGraphicsElement,ownClip?:Element){
  const projection=interactionBindings.get(layer);if(!projection||projection.path!==path||projection.ownClip!==ownClip||layer.parentElement!==path.ownerSVGElement)return false;
  let element:Element|null=path.parentElement;
  for(let i=projection.ancestors.length-1;i>=0;i--){if(element!==projection.ancestors[i])return false;element=element.parentElement;}
  return element===path.ownerSVGElement;
}
function syncInteractionProjection(layer:SVGElement){
  const projection=interactionBindings.get(layer);if(!projection)return;
  for(const {original,wrapper,css} of projection.bindings){
    const own=(name:string,value:string|null)=>name==='clip-path'&&!!value&&!!projection.ownClip&&value.match(/#([^)'"\s]+)/)?.[1]===projection.ownClip.getAttribute('id');
    for(const name of ['transform','clip-path','mask']){const value=original.getAttribute(name);const admitted=value!==null&&!own(name,value)&&!omitCompositionCrop(original,name)?value:null;if(wrapper.getAttribute(name)!==admitted){if(admitted===null)wrapper.removeAttribute(name);else wrapper.setAttribute(name,admitted);}}
    if(css)for(const name of ['transform','transform-origin','clip-path','mask']){const value=(original as SVGElement).style.getPropertyValue(name);const admitted=value&&!own(name,value)&&!omitCompositionCrop(original,name)?value:'';if(wrapper.style.getPropertyValue(name)!==admitted){if(admitted)wrapper.style.setProperty(name,admitted);else wrapper.style.removeProperty?.(name);}}
  }
}
/** Mirror only spatial/clipping ancestry in an interaction layer above authored paint.
 * Copy neither source IDs/classes nor opacity: interaction contrast must not inherit paint fading.
 * Visibility is checked before mounting. Retained wrappers follow evaluated
 * spatial attributes without copying canonical identities or paint opacity.
 */
export function mountInteractionInFront(path:SVGGraphicsElement,overlay:SVGElement,strong=false,ownMaskClip?:Element,context=false):SVGGElement|null{
  const svg=path.ownerSVGElement;if(!svg)return null;
  const doc=path.ownerDocument,ns='http://www.w3.org/2000/svg';
  const layer=doc.createElementNS(ns,'g');layer.setAttribute(context?'data-lottie-outline-layer':strong?'data-lottie-selection-layer':'data-lottie-hover-layer','');
  layer.setAttribute('pointer-events','none');layer.setAttribute('aria-hidden','true');
  const isOwnClip=(name:string,value:string|null)=>name==='clip-path'&&!!value&&!!ownMaskClip&&value.match(/#([^)'"\s]+)/)?.[1]===ownMaskClip.getAttribute('id');
  const ancestors:Element[]=[];
  for(let element:Element|null=path.parentElement;element&&element!==svg;element=element.parentElement)ancestors.unshift(element);
  let parent:SVGElement=layer;
  const bindings:{original:Element;wrapper:SVGElement;css:boolean}[]=[];
  for(const original of ancestors){
    const wrapper=doc.createElementNS(ns,'g');
    for(const name of ['transform','clip-path','mask']){const value=original.getAttribute(name);if(value!==null&&!isOwnClip(name,value)&&!omitCompositionCrop(original,name))wrapper.setAttribute(name,value);}
    // The pinned renderer writes spatial attributes; preserve explicit CSS forms as well.
    if(original.namespaceURI===ns)for(const name of ['transform','transform-origin','clip-path','mask']){
      const value=(original as SVGElement).style.getPropertyValue(name);if(value&&!isOwnClip(name,value)&&!omitCompositionCrop(original,name))wrapper.style.setProperty(name,value);
    }
    parent.appendChild(wrapper);parent=wrapper;
    bindings.push({original,wrapper,css:original.namespaceURI===ns});
  }
  for(const name of ['transform','clip-path','mask']){const value=path.getAttribute(name);if(value!==null&&!isOwnClip(name,value)&&!omitCompositionCrop(path,name))overlay.setAttribute(name,value);}
  if(!strong&&!context){
  const halo=overlay.cloneNode(false) as SVGPathElement;
  for(const name of ['data-lottie-hover','data-lottie-null-origin','data-null-state','data-origin-x','data-origin-y'])halo.removeAttribute(name);halo.setAttribute('data-lottie-hover-halo','');
  halo.setAttribute('stroke','#112b40');halo.setAttribute('stroke-width','3.5');halo.setAttribute('opacity','0.9');
  parent.appendChild(halo);
  bindings.push({original:path,wrapper:halo,css:false});
  }
  parent.appendChild(overlay);
  bindings.push({original:path,wrapper:overlay,css:false});interactionBindings.set(layer,{path,ancestors,ownClip:ownMaskClip,bindings});
  const front=context?Array.from(svg.children).find(child=>['data-lottie-hover-layer','data-lottie-selection-layer','data-lottie-construction-layer'].some(name=>child.getAttribute(name)!==null)):undefined;
  if(front)svg.insertBefore(layer,front);else svg.appendChild(layer);
  return layer;
}
export function createLottieHighlight(renderer: LayerView, nodes: readonly LottiePathNode[]) {
  const overlays=new Map<string,{path:SVGGraphicsElement;layer:SVGGElement;overlay:SVGPathElement}>();
  let lastReading='',lastOrder='';
  const clear = () => { for(const entry of overlays.values())entry.layer.remove();overlays.clear();lastReading='';lastOrder=''; };
  return {
    update(ids: readonly string[], hoveredIds: readonly string[] = [], showPaths=false,appearance:Readonly<LottiePathAppearance>=defaultLottiePathAppearance,influences:LottieStyleSubjects=readProjectedTypeData(renderer,nodes).influences,revision?:string) {
      const reading=JSON.stringify([revision,ids,hoveredIds,showPaths,appearance]);
      if(revision!==undefined&&reading===lastReading)return;lastReading=reading;
      const selected=selectedPathLeaves(nodes,ids,influences), selectedSet=new Set(selected.map(node=>node.id));
      const hovered=selectedPathLeaves(nodes,hoveredIds,influences).filter(node=>!selectedSet.has(node.id));
      const emphasized=new Set([...ids,...hoveredIds]);
      const context=showPaths?nodes.filter(node=>node.selectable&&
        (node.kind==='path'||node.kind==='shape'||node.solid==='unmasked'||(node.kind==='mask'&&node.maskQualified))&&
        !emphasized.has(node.id)&&!(node.kind==='mask'&&node.parentId&&emphasized.has(node.parentId))):[];
      // Read all evaluated geometry/styles before changing any overlay DOM.
      const visibility=new Map<Element,boolean>();
      const visible=(element:Element):boolean=>{const cached=visibility.get(element);if(cached!==undefined)return cached;const style=element.ownerDocument.defaultView?.getComputedStyle(element);const own=!style||style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0;const result=own&&(!element.parentElement||element.parentElement.namespaceURI!=='http://www.w3.org/2000/svg'||visible(element.parentElement));visibility.set(element,result);return result;};
      const plan=[...context.map(n=>[n,'context'] as const),...hovered.map(n=>[n,'hover'] as const),...selected.map(n=>[n,'selection'] as const)].flatMap(([node,mode])=>{const projected=resolveProjectedPath(renderer,node);return projected&&visible(projected.path)?[{node,mode,projected}]:[];});
      const desired=new Set(plan.map(({node,mode})=>mode+':'+node.id));
      for(const [key,entry] of overlays)if(!desired.has(key)){entry.layer.remove();overlays.delete(key);}
      const order:SVGGElement[]=[],contexts:SVGGElement[]=[],foreground:SVGGElement[]=[];let reordered=false;
      for (const {node,mode,projected} of plan) {
        const strong=mode==='selection',isContext=mode==='context';
        const key=mode+':'+node.id;let entry=overlays.get(key);
        const pathType=classifyLottiePath(node,projected.d),color=lottieTypeColor(pathType,appearance);
        if(entry&&hasCurrentInteractionAncestry(entry.layer,projected.path,projected.qualifiedClip)){
          const write=(name:string,value:string)=>{if(entry!.overlay.getAttribute(name)!==value)entry!.overlay.setAttribute(name,value);};
          write('d',projected.d);write('data-lottie-path-type',pathType);write('stroke',color);write('stroke-width',isContext?String(appearance.width):strong?'3':'1.5');
          if(isContext)write('opacity',String(appearance.opacity));
          if(!strong&&!isContext){const halo=entry.overlay.parentElement?.children[0];if(halo&&halo!==entry.overlay&&halo.getAttribute('d')!==projected.d)halo.setAttribute('d',projected.d);}
          syncInteractionProjection(entry.layer);
        }else{
        entry?.layer.remove();
        const overlay = projected.path.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
        overlay.setAttribute('d', projected.d); overlay.setAttribute('fill', 'none');
        overlay.setAttribute('data-lottie-path-type',pathType);
        overlay.setAttribute('stroke',color); overlay.setAttribute('stroke-width',isContext?String(appearance.width):strong?'3':'1.5');
        if(isContext)overlay.setAttribute('opacity',String(appearance.opacity));
        if(!strong&&!isContext){overlay.setAttribute('stroke-dasharray','5 3');overlay.setAttribute('opacity','1');}
        overlay.setAttribute('vector-effect', 'non-scaling-stroke'); overlay.setAttribute('pointer-events', 'none');
        overlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute(isContext?'data-lottie-outline':strong?'data-lottie-highlight':'data-lottie-hover',node.id);
        const layer=mountInteractionInFront(projected.path,overlay,strong,projected.qualifiedClip,isContext);if(!layer)continue;
        entry={path:projected.path,layer,overlay};overlays.set(key,entry);reordered=true;
        }
        order.push(entry.layer);(isContext?contexts:foreground).push(entry.layer);
      }
      const nextOrder=JSON.stringify([...desired]);
      if(reordered||nextOrder!==lastOrder){lastOrder=nextOrder;const svg=order[0]?.ownerSVGElement;if(svg){const front=Array.from(svg.children).find(child=>['data-lottie-hover-layer','data-lottie-selection-layer','data-lottie-construction-layer'].some(name=>child.getAttribute(name)!==null));for(const layer of contexts)if(layer!==front){if(front)svg.insertBefore(layer,front);else svg.appendChild(layer);}for(const layer of foreground)svg.appendChild(layer);}}
    }, dispose: clear
  };
}
