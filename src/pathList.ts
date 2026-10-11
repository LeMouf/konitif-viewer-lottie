import {resolveLottieTypeLineage,type LottieLineageType} from './lineageTypes.js';
import type {LottiePathViewPort} from './pathAppearance.js';
import type {LottiePathTypeObservation} from './pathTypes.js';
import {lottieNodePresentation,type LottieNodeIcon} from './nodePresentation.js';
import type { LottieViewerHost } from './contracts.js';
import { indexLottiePaths, type LottiePathNode } from './paths.js';


export interface LottieTreePolicy {
 ancestors(id:string,parent:(id:string)=>string|null|undefined):string[];
 hiddenByFold(id:string,parent:(id:string)=>string|null|undefined,collapsed:ReadonlySet<string>):boolean;
 visibleAnchor(id:string,parent:(id:string)=>string|null|undefined,visible:ReadonlySet<string>):string|null;
}
export interface LottieTreeCardState {accent:string;accents:readonly string[];selected:boolean;hovered:boolean;ancestor:boolean;dimmed:boolean;depth:number;branch?:{last:boolean;continuations:readonly boolean[]};}
/** Native accessible outliner hosted by the Workbench widget/dock infrastructure. */
export function mountLottiePathList(target:HTMLElement,host:LottieViewerHost,options:{mountVisibility?:(button:HTMLButtonElement,value:{state:'visible'|'hidden'|'inherited'|'mixed';supported:boolean;label:string;detail?:string;onToggle:(visible:boolean)=>void})=>{destroy():void};treePolicy?:LottieTreePolicy;mountCard?:(row:HTMLElement,state:LottieTreeCardState)=>{update(state:LottieTreeCardState):void;destroy():void};pathView?:LottiePathViewPort;pathTypes?:LottiePathTypeObservation;renderIcon?:(target:HTMLElement,icon:LottieNodeIcon)=>void}={}){
 const doc=target.ownerDocument,root=doc.createElement('section');root.setAttribute('aria-label','Tracés de l’animation');
 root.style.cssText='height:100%;display:flex;flex-direction:column;min-height:0;font:12px system-ui;color:var(--color-text-primary,#ddd)';
 const intro=doc.createElement('p');intro.textContent='Calques & tracés';intro.title='Structure importée · sélection pleine, survol pointillé · visibilité par calque. Masques complexes et répétiteurs hors clic géométrique.';intro.style.cssText='margin:0;font-size:11px;font-weight:650;letter-spacing:.02em';
 const clear=doc.createElement('button');clear.type='button';clear.textContent='Effacer';clear.setAttribute('aria-label','Désélectionner');clear.style.cssText='border:0;background:transparent;font:10px system-ui;color:var(--color-text-secondary,#b9c7d4)';
 const filter=doc.createElement('input');filter.type='search';filter.placeholder='Filtrer les noms';filter.setAttribute('aria-label','Filtrer les tracés');filter.style.cssText='box-sizing:border-box;width:calc(100% - 12px);margin:0 6px 6px;padding:5px 7px;min-height:27px;border:1px solid var(--color-border-default,#394654);border-radius:5px;background:var(--color-background-canvas,#17212b);font:11px system-ui';
 const status=doc.createElement('p');status.setAttribute('role','status');status.style.cssText='margin:0;min-height:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:16px';
 const hoverStatus=doc.createElement('p');hoverStatus.setAttribute('aria-label','Survol des tracés');hoverStatus.style.cssText='margin:0;min-height:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:16px;font-style:italic';
 const tree=doc.createElement('div');tree.setAttribute('role','tree');tree.setAttribute('aria-label','Structure Lottie');tree.style.cssText='overflow:auto;flex:1;min-height:0;box-sizing:border-box;padding:0 8px 0 12px';
 const footer=doc.createElement('footer');footer.setAttribute('aria-label','Informations des tracés');footer.style.cssText='box-sizing:border-box;flex:0 0 92px;height:92px;min-height:92px;display:grid;grid-template-rows:32px 32px;gap:6px;padding:10px 8px;border-top:1px solid var(--color-border-default,#394654);background:var(--color-background-canvas,#17212b);overflow:hidden';
 const tools=doc.createElement('header');tools.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px';tools.append(intro,clear);footer.append(status,hoverStatus);root.append(tools,filter,tree,footer);target.append(root);
 let nodes:readonly LottiePathNode[]=[],sourceKey='',structureKey='',lastSelected='',focusedId='';
 let buttons=new Map<string,HTMLButtonElement>(),rows=new Map<string,HTMLElement>();
 let nodeById=new Map<string,LottiePathNode>(),ancestorCache=new Map<string,string[]>(),lastSibling=new Map<string|null,string>(),childrenByParent=new Map<string|null,LottiePathNode[]>();
 const indexStructure=()=>{nodeById=new Map(nodes.map(node=>[node.id,node]));ancestorCache.clear();lastSibling.clear();childrenByParent.clear();for(const node of nodes){lastSibling.set(node.parentId,node.id);const siblings=childrenByParent.get(node.parentId)??[];siblings.push(node);childrenByParent.set(node.parentId,siblings);}};
 const isHidden=(id:string,hidden:readonly string[])=>hidden.includes(id)||ancestors(id).some(parent=>hidden.includes(parent));
 const visibilityState=(id:string,hidden:readonly string[]):'visible'|'hidden'|'inherited'|'mixed'=>hidden.includes(id)?'hidden':isHidden(id,hidden)?'inherited':hidden.some(child=>ancestors(child).includes(id))?'mixed':'visible';
 const cards=new Map<string,ReturnType<NonNullable<typeof options.mountCard>>>();
 const setExpanded=(id:string,expanded:boolean)=>host.dispatch({type:'set-expanded',id,expanded});
 const branch=(node:LottiePathNode)=>{const last=(id:string)=>{const n=nodeById.get(id);return !!n&&lastSibling.get(n.parentId)===id;};return node.depth?{last:last(node.id),continuations:ancestors(node.id).reverse().slice(1).map(id=>!last(id))}:undefined;};
 const parent=(id:string)=>nodeById.get(id)?.parentId;
 const ancestors=(id:string)=>{let values=ancestorCache.get(id);if(!values){values=options.treePolicy?.ancestors(id,parent)??(()=>{const result:string[]=[];let current=parent(id);while(current){result.push(current);current=parent(current);}return result;})();ancestorCache.set(id,values);}return values.slice();};
 const accents=new Map<string,{icon:HTMLElement;type:HTMLElement;mask?:HTMLElement;rail:HTMLElement}>();
 let typeLineage:Readonly<Record<string,LottieLineageType>>={};
 const resolveTypes=()=>{typeLineage=resolveLottieTypeLineage(nodes,options.pathTypes?.read(),options.pathTypes?.readInfluences());};
 const presentationFor=(node:LottiePathNode)=>lottieNodePresentation(node,{colorMode:options.pathView?.read().appearance.colorMode,color:options.pathView?.read().appearance.color,evaluatedType:options.pathTypes?.read()[node.id],lineage:typeLineage[node.id]});
 const updateTypes=()=>{resolveTypes();for(const node of nodes){const parts=accents.get(node.id),button=buttons.get(node.id),row=rows.get(node.id);if(!parts||!button||!row)continue;
   const presentation=presentationFor(node);parts.icon.style.color=presentation.tone;parts.rail.style.background=presentation.colors.length>1?`linear-gradient(to bottom,${presentation.colors.join(',')})`:presentation.tone;parts.type.textContent=presentation.typeCaption;
   if(parts.mask){parts.mask.style.borderColor=presentation.tone;parts.mask.style.color='var(--color-text-secondary,#b9c7d4)';}
   const category=options.pathTypes?.read()[node.id]??'';row.dataset.lottiePathType=category;row.dataset.lottieEffectiveTypes=(typeLineage[node.id]?.types??[]).join(',');row.setAttribute('aria-description',presentation.details);
   row.dataset.lottieColorMode=options.pathView?.read().appearance.colorMode??'uniform';
   row.setAttribute('aria-label',`${presentation.label} · ${node.label}`);button.setAttribute('aria-label',`${presentation.label} · ${node.label}${presentation.maskLabel?' · '+presentation.maskLabel:''}`);
   button.title=`${lineage(node)}\n${presentation.label}. ${presentation.details}`;
 }};
 const dispatchHover=(ids:readonly string[])=>host.dispatch({type:'hover',ids,origin:'list'});
 const lineage=(node:LottiePathNode)=>[...ancestors(node.id).reverse().map(id=>nodeById.get(id)!.label),node.label].join(' / ');
 const deselect=()=>host.dispatch({type:'select',ids:[]});
 const update=()=>{
  const reading=host.read(),selected=reading.selectedIds,hovered=reading.hoveredIds??[];
  const visible=new Set(buttons.keys()),anchors=hovered.map(id=>options.treePolicy?.visibleAnchor(id,parent,visible)??[id,...ancestors(id)].find(candidate=>visible.has(candidate)));
  for(const [id,button] of buttons){
   const own=selected.includes(id),over=hovered.includes(id),below=!over&&anchors.includes(id);
   const node=nodeById.get(id)!;cards.get(id)?.update({accent:presentationFor(node).tone,accents:presentationFor(node).colors,selected:own,hovered:over||below,ancestor:below,dimmed:isHidden(id,reading.hiddenIds??[]),depth:node.depth,branch:branch(node)});
   rows.get(id)!.setAttribute('aria-selected',String(own));button.setAttribute('aria-pressed',String(own));button.dataset.hovered=String(over);button.dataset.hoverWithin=String(below);
   const tone=presentationFor(node).tone;button.style.background=options.mountCard?'transparent':own||over||below?`color-mix(in srgb,${tone} 15%,transparent)`:'transparent';button.style.borderColor=own&&!options.mountCard?tone:'transparent';button.style.outline=(over||below)&&!own&&!options.mountCard?`1px dashed ${tone}`:'none';
  }
  const selectedNode=nodes.find(node=>selected.includes(node.id)),hoveredNode=nodes.find(node=>hovered.includes(node.id));
  status.textContent=selectedNode?`Sélection : ${lineage(selectedNode)}. ${presentationFor(selectedNode).details}`:`${nodes.filter(n=>['path','shape'].includes(n.kind)).length} tracés et formes · aucune sélection`;
  hoverStatus.textContent=hoveredNode?`Survol : ${lineage(hoveredNode)}`:'Survol : aucun tracé';status.title=status.textContent??'';hoverStatus.title=hoverStatus.textContent??'';clear.disabled=!selected.length;
  const next=selected.join('|');if(next!==lastSelected){lastSelected=next;if(selectedNode)buttons.get(selectedNode.id)?.scrollIntoView({block:'nearest'});}
 };
 const visibilityControls:{destroy():void}[]=[];
 const render=()=>{
  resolveTypes();
  const restoreFocus=(doc.activeElement as HTMLElement|null)?.dataset.lottieNodeId;
  visibilityControls.splice(0).forEach(control=>control.destroy());
  cards.forEach(card=>card.destroy());cards.clear();tree.replaceChildren();buttons.clear();rows.clear();accents.clear();
  const reading=host.read(),expanded=new Set([...(reading.expandedIds??[])]),hidden=reading.hiddenIds??[],query=filter.value.trim().toLocaleLowerCase();
  const matching=query?new Set(nodes.filter(n=>lineage(n).toLocaleLowerCase().includes(query)).flatMap(n=>[n.id,...ancestors(n.id)])):new Set<string>();
  const collapsed=new Set(nodes.filter(node=>!expanded.has(node.id)).map(node=>node.id));
  const visible=nodes.filter(n=>query?matching.has(n.id):options.treePolicy?!options.treePolicy.hiddenByFold(n.id,parent,collapsed):ancestors(n.id).every(id=>expanded.has(id)));
  if(!visible.some(n=>n.id===focusedId))focusedId=visible[0]?.id??'';
  for(const node of visible){
   const presentation=presentationFor(node);
   const row=doc.createElement('div');row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(node.depth+1));row.setAttribute('aria-label',`${presentation.label} · ${node.label}`);row.dataset.nodeId=node.id;row.dataset.treeDocument=String(node.kind==='document');row.style.setProperty('--tree-row-gap',node.kind==='document'?'12px':'4px');
   if(!options.mountCard)row.style.cssText=`display:flex;align-items:center;gap:3px;padding-left:${4+node.depth*10}px;height:44px;min-height:44px;box-sizing:border-box`;
   const children=childrenByParent.has(node.id),isOpen=query?true:expanded.has(node.id);
   if(children)row.setAttribute('aria-expanded',String(isOpen));
   const fold=doc.createElement('button');fold.type='button';fold.textContent=children?(isOpen?'▾':'▸'):'·';fold.disabled=!children;fold.setAttribute('data-layer-tree-toggle','');if(!options.mountCard)fold.style.cssText='width:22px;flex-shrink:0';fold.setAttribute('aria-label',`${isOpen?'Replier':'Déplier'} ${node.label}`);
   if(children)fold.setAttribute('aria-expanded',String(isOpen));
   fold.addEventListener('click',()=>setExpanded(node.id,!isOpen));
   const button=doc.createElement('button');button.type='button';button.dataset.lottieNodeId=node.id;button.tabIndex=focusedId===node.id?0:-1;
   const concealed=isHidden(node.id,hidden);button.setAttribute('aria-disabled',String(!node.selectable||concealed));
   button.setAttribute('aria-label',`${presentation.label} · ${node.label}${presentation.maskLabel?' · '+presentation.maskLabel:''}`);button.title=`${lineage(node)}\n${presentation.details}`;
   const icon=doc.createElement('span');icon.setAttribute('aria-hidden','true');icon.style.cssText=`grid-row:1 / 3;width:16px;height:16px;align-self:center;color:${presentation.tone}`;
   if(options.renderIcon)options.renderIcon(icon,presentation.icon);else icon.textContent=({composition:'▣',vector:'◇',solid:'■',null:'⊕',text:'T',group:'▱',path:'⌁',shape:node.sourceType==='el'?'○':node.sourceType==='rc'?'□':'◇',mask:'◐',style:'◈'} as const)[presentation.icon];
   const name=doc.createElement('span');name.textContent=node.label;name.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-weight:600;font-size:11px;line-height:15px';
   const meta=doc.createElement('span');meta.style.cssText=`display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden;font-size:10px;line-height:13px;color:var(--color-text-secondary,#b9c7d4)`;
   const type=doc.createElement('span');type.textContent=presentation.typeCaption;type.style.cssText='white-space:nowrap;overflow:hidden;text-overflow:ellipsis';meta.append(type);
   let mask:HTMLElement|undefined;
   if(node.color){const swatch=doc.createElement('span');swatch.setAttribute('aria-label',`Couleur source : ${node.color}`);swatch.title=`Couleur source : ${node.color}`;swatch.style.cssText=`width:9px;height:9px;flex:0 0 9px;background:${node.color};border:1px solid #8a9ba6;border-radius:2px`;meta.prepend(swatch);}
   if(presentation.maskLabel){mask=doc.createElement('span');mask.textContent=presentation.maskLabel;mask.title=presentation.details;mask.style.cssText='flex-shrink:0;color:#d1bc91;border:1px solid #76684e;border-radius:3px;padding:0 3px;white-space:nowrap';meta.append(mask);}
   const rail=doc.createElement('span');rail.setAttribute('aria-hidden','true');rail.setAttribute('data-lottie-type-accent','');rail.style.cssText=`position:absolute;left:0;top:5px;bottom:5px;width:2px;border-radius:2px;background:${presentation.tone}`;
   button.append(rail,icon,name,meta);accents.set(node.id,{icon,type,mask,rail});
   button.style.cssText=`position:relative;flex:1;min-width:0;text-align:left;padding:2px 3px 2px 6px;border:1px solid transparent;color:inherit;font:inherit;display:grid;grid-template-columns:16px minmax(0,1fr);grid-template-rows:15px 13px;column-gap:6px;align-content:center;height:34px;overflow:hidden;opacity:${concealed?0.5:1}`;
   button.addEventListener('click',(event)=>{if(node.selectable&&!concealed){const selected=host.read().selectedIds;host.dispatch({type:'select',ids:event.ctrlKey||event.metaKey?(selected.includes(node.id)?selected.filter(id=>id!==node.id):[...selected,node.id]):selected.includes(node.id)?[]:[node.id]});}});
   const hover=()=>{if(node.selectable&&!concealed)dispatchHover([node.id]);};
   const leave=()=>{const r=host.read();if(r.hoverOrigin==='list'&&r.hoveredIds?.includes(node.id))dispatchHover([]);};
   button.addEventListener('pointerenter',hover);button.addEventListener('pointerleave',leave);button.addEventListener('focus',()=>{focusedId=node.id;for(const [id,b]of buttons)b.tabIndex=id===focusedId?0:-1;hover();});button.addEventListener('blur',leave);
   const visibility=doc.createElement('button');visibility.type='button';const state=visibilityState(node.id,hidden),supported=['layer','precomposition'].includes(node.kind);
   const value={state,supported,label:node.label,detail:supported?state+' · visibilité de travail':'Tracés et groupes peuvent partager un remplissage : masquage individuel non pris en charge.',onToggle:(visible:boolean)=>host.dispatch({type:'set-visibility',id:node.id,visible})};
   if(options.mountVisibility)visibilityControls.push(options.mountVisibility(visibility,value));
   else {visibility.disabled=!supported||state==='inherited';visibility.textContent=state==='visible'?'◉':state==='mixed'?'◐':'○';visibility.setAttribute('data-layer-tree-visibility','');visibility.setAttribute('aria-pressed',String(state==='visible'));visibility.setAttribute('aria-label',supported?`${state==='hidden'?'Afficher':'Masquer'} ${node.label}${state==='inherited'?' (masqué par un parent)':state==='mixed'?' (visibilité mixte)':''}`:`Visibilité au calque pour ${node.label}`);visibility.title=value.detail;visibility.addEventListener('click',()=>value.onToggle(state==='hidden'));}
   if(!options.mountCard)visibility.style.cssText='width:25px;flex-shrink:0';
   row.append(fold,button,visibility);tree.append(row);if(options.mountCard)cards.set(node.id,options.mountCard(row,{accent:presentation.tone,accents:presentation.colors,selected:false,hovered:false,ancestor:false,dimmed:concealed,depth:node.depth,branch:branch(node)}));buttons.set(node.id,button);rows.set(node.id,row);
  }
  if(restoreFocus)buttons.get(restoreFocus)?.focus();updateTypes();update();
 };
 const refresh=()=>{
  const reading=host.read(),source=reading.source,key=source?JSON.stringify([source.id,source.revision]):'';
  if(key!==sourceKey){sourceKey=key;nodes=source?indexLottiePaths(source):[];indexStructure();focusedId='';lastSelected='';}
  const next=JSON.stringify([key,reading.expandedIds,reading.hiddenIds,filter.value]);
  if(next!==structureKey){structureKey=next;render();}else update();
 };
 const keyboard=(event:KeyboardEvent)=>{
  const current=(doc.activeElement as HTMLElement)?.dataset.lottieNodeId;if(!current)return;
  const node=nodeById.get(current)!;const keys=[...buttons.keys()],index=keys.indexOf(current),expanded=[...(host.read().expandedIds??[])];
  if(event.key==='Escape'){event.preventDefault();deselect();return;}
  let next:string|undefined;
  if(event.key==='ArrowDown')next=keys[Math.min(keys.length-1,index+1)];if(event.key==='ArrowUp')next=keys[Math.max(0,index-1)];
  if(event.key==='Home')next=keys[0];if(event.key==='End')next=keys.at(-1);
  if(event.key==='ArrowRight'){if(!expanded.includes(current))setExpanded(current,true);else next=childrenByParent.get(current)?.[0]?.id;}
  if(event.key==='ArrowLeft'){if(expanded.includes(current))setExpanded(current,false);else next=node.parentId??undefined;}
  if(['ArrowDown','ArrowUp','Home','End','ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();if(next)buttons.get(next)?.focus();}
 };
 clear.addEventListener('click',deselect);filter.addEventListener('input',refresh);tree.addEventListener('keydown',keyboard);
 const releaseTypes=options.pathTypes?.subscribe(()=>{updateTypes();update();}),releaseView=options.pathView?.subscribe(()=>{updateTypes();update();});
 const release=host.subscribe(refresh);refresh();
 return {dispose(){visibilityControls.splice(0).forEach(control=>control.destroy());release();releaseTypes?.();releaseView?.();cards.forEach(card=>card.destroy());if(host.read().hoverOrigin==='list')dispatchHover([]);clear.removeEventListener('click',deselect);filter.removeEventListener('input',refresh);tree.removeEventListener('keydown',keyboard);root.remove();}};
}

// Shared presentation policy for other read projections of this same hierarchy.
export { lottieNodePresentation } from './nodePresentation.js';
export { resolveLottieTypeLineage } from './lineageTypes.js';
