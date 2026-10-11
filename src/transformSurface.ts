import {pivotSnapTargets,snapLottiePivot} from './pivotSnap.js';
import {multiplyAffine} from './liveTransform.js';
import type {LottieViewerHost,LottieTransformFrame} from './contracts.js';
import {indexLottiePaths,selectedPathLeaves} from './paths.js';
import {transformGestureValues,inverseLinear} from './transformFrame.js';
type Mode='move'|'rotate'|'scale'|'pivot';
const rotationCursor='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M24 15a10 10 0 1 0-3 9M24 7v8h-8" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 15a10 10 0 1 0-3 9M24 7v8h-8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')+'") 16 16, crosshair';
type Values=Partial<Record<'p'|'a'|'s'|'r',readonly number[]>>;
/** Live SVG projection only; a release admits one atomic document command. */
export function mountLottieTransformTools(stage:HTMLElement,host:LottieViewerHost,observation:{isReady?():boolean;previewTransform?(id:string,matrix:readonly number[]):boolean;clearTransformPreview?():void;transformFrame(id:string):LottieTransformFrame|null;hitTest(x:number,y:number):readonly string[];selectionBounds():readonly {id:string;bounds:{left:number;top:number;right:number;bottom:number}}[]}){
 const doc=stage.ownerDocument,ns='http://www.w3.org/2000/svg',overlay=doc.createElementNS(ns,'svg');overlay.setAttribute('data-lottie-transform-preview','');overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';stage.append(overlay);
 const style=doc.createElement('style');style.textContent='[data-lottie-transform-handle]:hover,[data-lottie-transform-handle][data-hovered="true"]{fill:var(--color-action-primary,#56b5ff);stroke:#fff;stroke-width:3;filter:drop-shadow(0 0 3px var(--color-action-primary,#56b5ff));}';stage.append(style);
 let closed=false,temporary:'rotate'|'scale'|null=null;
 let keyboard:{owner:string;selection:string;revision:string;sourceId:string;time:number;dx:number;dy:number;parent:readonly number[];held:Set<string>}|null=null;
 let keyboardTimer:ReturnType<typeof setTimeout>|undefined;
 let retained:{sourceId:string;selection:string;time:number}|null=null;
 const suffix=(id:string,source:{id:string;revision:string})=>id.slice(JSON.stringify([source.id,source.revision]).length);
 const keyboardScope=()=>{const r=host.read();return !!keyboard&&r.source?.id===keyboard.sourceId&&r.source.revision===keyboard.revision&&r.timeSeconds===keyboard.time&&!r.playing&&r.selectedIds.length===1&&suffix(r.selectedIds[0],r.source)===keyboard.selection&&host.editing?.read().mode==='move';};
 const finishKeyboard=(commit=true)=>{clearTimeout(keyboardTimer);keyboardTimer=undefined;const k=keyboard;if(!k)return;const valid=keyboardScope();keyboard=null;
  if(commit&&valid&&(k.dx||k.dy)){retained={sourceId:k.sourceId,selection:k.selection,time:k.time};host.editing?.dispatch({type:'translate',id:k.owner,dx:k.dx,dy:k.dy,atCurrentTime:true});if(host.read().source?.revision===k.revision){retained=null;observation.clearTransformPreview?.();overlay.removeAttribute('transform');}}
  else{retained=null;observation.clearTransformPreview?.();overlay.removeAttribute('transform');}refresh();
 };
 const keyboardUp=(e:KeyboardEvent)=>{if(!keyboard||!keyboard.held.has(e.key))return;e.preventDefault();e.stopImmediatePropagation();keyboard.held.delete(e.key);if(!keyboard.held.size){clearTimeout(keyboardTimer);keyboardTimer=setTimeout(()=>finishKeyboard(),80);}};
 const keyboardEscape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&keyboard){e.preventDefault();e.stopImmediatePropagation();finishKeyboard(false);}};
 const keyboardBlur=()=>finishKeyboard();
 const navigationModifier=()=>!!hover&&(hover.meta||hover.shift||((hover.ctrl||hover.alt)&&!temporary));
 let activeBox:{left:number;right:number;top:number;bottom:number;eligible:boolean;mode:string;revision:string;time:number;selection:string;leaves:ReadonlySet<string>}|null=null;
 let hover:{x:number;y:number;alt:boolean;ctrl:boolean;meta:boolean;shift:boolean;handle:string|null;handleKey:string|null;handleCursor:string|null}|null=null;
 const inside=(x:number,y:number)=>!!activeBox&&x>=activeBox.left&&x<=activeBox.right&&y>=activeBox.top&&y<=activeBox.bottom;
 const cursor=()=>{if(!hover||gesture)return;const tool=activeBox?.eligible&&(activeBox.mode==='move'?inside(hover.x,hover.y):hover.handle===activeBox.mode||observation.hitTest(hover.x,hover.y).some(id=>id===activeBox!.selection||activeBox!.leaves.has(id)))&&!navigationModifier()?activeBox.mode:null;stage.style.cursor=tool==='move'?'move':tool==='rotate'?rotationCursor:tool==='scale'?(hover.handleCursor??((hover.x-(activeBox!.left+activeBox!.right)/2)*(hover.y-(activeBox!.top+activeBox!.bottom)/2)>=0?'nwse-resize':'nesw-resize')):tool==='pivot'?'crosshair':!hover.alt&&!hover.ctrl&&!hover.meta&&!hover.shift&&observation.hitTest(hover.x,hover.y).length?'pointer':'grab';};
 let gesture:{pointer:number;selection:string;owner:string;revision:string;time:number;mode:Mode;cursor:string;start:{x:number;y:number};frame:LottieTransformFrame;values:Values;corners:number[][];next:Values|null}|null=null;
 const consume=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
 const cancel=(keepPaint=false)=>{if(!gesture){if(keyboard)finishKeyboard(false);return;}const id=gesture.pointer;gesture=null;boxProjectionKey='';if(!keepPaint)observation.clearTransformPreview?.();overlay.replaceChildren();stage.style.cursor='';if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);refresh();};
 const scopeValid=()=>{const r=host.read();return gesture&&r.source?.revision===gesture.revision&&r.timeSeconds===gesture.time&&!r.playing&&r.selectedIds.length===1&&r.selectedIds[0]===gesture.selection&&host.editing?.read().mode===gesture.mode;};
 const draw=(end:{x:number;y:number})=>{
  if(!gesture)return;const g=gesture,r=stage.getBoundingClientRect(),apply=(m:readonly number[],x:number,y:number)=>[m[0]*x+m[2]*y,m[1]*x+m[3]*y];
  let snapped:ReturnType<typeof snapLottiePivot>=null;
  if(g.mode==='pivot'&&Math.hypot(end.x-g.start.x,end.y-g.start.y)>0){snapped=snapLottiePivot({x:g.frame.pivot.x+end.x-g.start.x,y:g.frame.pivot.y+end.y-g.start.y},g.corners);if(snapped)end={x:g.start.x+snapped.x-g.frame.pivot.x,y:g.start.y+snapped.y-g.frame.pivot.y};}
  g.next=transformGestureValues(g.mode,g.frame,g.start,end,g.values);overlay.replaceChildren();
  const pivot=g.frame.pivot,dx=end.x-g.start.x,dy=end.y-g.start.y,parent=inverseLinear(g.frame.parentInverse)!;
  const angle=g.next?.r&&g.values.r?(g.next.r[0]-g.values.r[0])*Math.PI/180:0;
  const scale=g.next?.s&&g.values.s?Math.hypot(...g.next.s.slice(0,2))/Math.hypot(...g.values.s.slice(0,2)):1;
  let delta=[1,0,0,1,0,0];
  if(g.mode==='move')delta=[1,0,0,1,dx,dy];
  else if(g.mode==='scale')delta=[scale,0,0,scale,pivot.x*(1-scale),pivot.y*(1-scale)];
  else if(g.mode==='rotate'){const linear=multiplyAffine([...parent,0,0],multiplyAffine([Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0],[...g.frame.parentInverse,0,0]));delta=[...linear.slice(0,4),pivot.x-linear[0]*pivot.x-linear[2]*pivot.y,pivot.y-linear[1]*pivot.x-linear[3]*pivot.y];}
  if(g.next)observation.previewTransform?.(g.owner,delta);stage.style.cursor=g.cursor;
  const points=g.corners.map(([x,y])=>{
   if(g.mode==='move')return [x+dx-r.left,y+dy-r.top];
   if(g.mode==='rotate'){const [u,v]=apply(g.frame.parentInverse,x-pivot.x,y-pivot.y),[sx,sy]=apply(parent,u*Math.cos(angle)-v*Math.sin(angle),u*Math.sin(angle)+v*Math.cos(angle));return [pivot.x+sx-r.left,pivot.y+sy-r.top];}
   if(g.mode==='scale')return [pivot.x+(x-pivot.x)*scale-r.left,pivot.y+(y-pivot.y)*scale-r.top];
   return [x-r.left,y-r.top];
  });
  if(g.mode==='pivot')for(const target of pivotSnapTargets(g.corners)){const dot=doc.createElementNS(ns,'circle');dot.setAttribute('cx',String(target.x-r.left));dot.setAttribute('cy',String(target.y-r.top));dot.setAttribute('r',snapped?.kind===target.kind?'8':'2.5');dot.setAttribute('fill',snapped?.kind===target.kind?'var(--color-action-primary,#56b5ff)':'#fff');dot.setAttribute('fill-opacity',snapped?.kind===target.kind?'.3':'.6');dot.setAttribute('stroke',snapped?.kind===target.kind?'var(--color-action-primary,#56b5ff)':'none');dot.setAttribute('stroke-width','2');if(snapped?.kind===target.kind)dot.setAttribute('data-lottie-pivot-snap',target.kind);overlay.append(dot);}
  const polygon=doc.createElementNS(ns,'polygon');polygon.setAttribute('points',points.map(p=>p.join(',')).join(' '));polygon.setAttribute('fill','none');polygon.setAttribute('stroke','#fff');polygon.setAttribute('stroke-dasharray','4 3');overlay.append(polygon);
  const x=pivot.x+(g.mode==='pivot'||g.mode==='move'?dx:0)-r.left,y=pivot.y+(g.mode==='pivot'||g.mode==='move'?dy:0)-r.top,cross=doc.createElementNS(ns,'path');cross.setAttribute('d',`M${x-7},${y}h14M${x},${y-7}v14`);cross.setAttribute('stroke','#fff');overlay.append(cross);
 };
 let boxProjectionKey='';
 const refresh=()=>{
  if(closed||gesture||keyboard)return;const reading=host.read(),mode=host.editing?.read().mode;
  if(retained){if(reading.source&&reading.source.id===retained.sourceId&&reading.timeSeconds===retained.time&&!reading.playing&&reading.selectedIds.length===1&&suffix(reading.selectedIds[0],reading.source)===retained.selection&&observation.isReady?.()===false)return;retained=null;}
  const camera=stage.querySelector<SVGGraphicsElement>('[data-lottie-view-transform]')??stage.querySelector<SVGGraphicsElement>('svg'),matrix=camera?.getScreenCTM?.();
  const nextProjection=JSON.stringify([reading.source?.id,reading.source?.revision,reading.timeSeconds,reading.selectedIds,reading.hiddenIds,reading.playing,mode,observation.isReady?.(),stage.clientWidth,stage.clientHeight,matrix&&[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]]);
  if(nextProjection===boxProjectionKey){cursor();return;}boxProjectionKey=nextProjection;
  activeBox=null;overlay.removeAttribute('transform');overlay.replaceChildren();cursor();
  if(reading.selectedIds.length!==1||!reading.source||reading.playing||mode==='pen')return;
  const nodes=indexLottiePaths(reading.source),selection=reading.selectedIds[0];let owner=nodes.find(n=>n.id===selection);while(owner&&!['layer','precomposition','group'].includes(owner.kind))owner=nodes.find(n=>n.id===owner!.parentId);
  const frame=owner&&observation.transformFrame(owner.id);if(!frame||!owner)return;
  const leaves=new Set(selectedPathLeaves(nodes,[owner.id]).map(n=>n.id)),bounds=observation.selectionBounds().filter(b=>b.id===owner!.id||leaves.has(b.id)).map(b=>b.bounds);if(!bounds.length)return;
  const rect=stage.getBoundingClientRect(),left=Math.min(...bounds.map(b=>b.left))-rect.left,right=Math.max(...bounds.map(b=>b.right))-rect.left,top=Math.min(...bounds.map(b=>b.top))-rect.top,bottom=Math.max(...bounds.map(b=>b.bottom))-rect.top,x=frame.pivot.x-rect.left,y=frame.pivot.y-rect.top;
  const box=doc.createElementNS(ns,'rect');box.setAttribute('data-lottie-transform-box','');box.setAttribute('x',String(left));box.setAttribute('y',String(top));box.setAttribute('width',String(right-left));box.setAttribute('height',String(bottom-top));box.setAttribute('fill','none');box.setAttribute('stroke','#fff');box.setAttribute('stroke-opacity','.75');overlay.append(box);
  const cross=doc.createElementNS(ns,'path');cross.setAttribute('data-lottie-transform-pivot','');cross.setAttribute('d',`M${x-7},${y}h14M${x},${y-7}v14`);cross.setAttribute('stroke','#fff');cross.setAttribute('stroke-width','1.5');overlay.append(cross);
  activeBox={left:left+rect.left,right:right+rect.left,top:top+rect.top,bottom:bottom+rect.top,eligible:false,mode:mode??'inspect',revision:reading.source.revision,time:reading.timeSeconds,selection,leaves:new Set(selectedPathLeaves(nodes,[selection]).map(n=>n.id))};
  if(!mode||!['move','rotate','scale','pivot'].includes(mode)){cursor();return;}
  const required=mode==='move'?['p']:mode==='rotate'?['r']:mode==='scale'?['s']:['a','p'],properties=host.editing!.read().properties;
  if(!required.every(key=>properties.some(p=>p.ownerId===owner!.id&&p.pointer.endsWith('/'+key)&&p.editable))){cursor();return;}
  activeBox.eligible=true;cursor();
  const handle=(px:number,py:number,circle:boolean,key:string)=>{const h=doc.createElementNS(ns,circle?'circle':'rect');h.setAttribute('data-lottie-transform-handle',mode);h.style.pointerEvents='all';h.setAttribute('data-lottie-handle-key',key);h.setAttribute('data-lottie-handle-cursor',mode==='pivot'?'crosshair':mode==='move'?'move':mode==='rotate'?rotationCursor:key==='ne'||key==='sw'?'nesw-resize':'nwse-resize');h.style.cursor='inherit';h.setAttribute('data-hovered',String(hover?.handle===mode&&hover.handleKey===key&&!navigationModifier()));
   if(circle){h.setAttribute('cx',String(px));h.setAttribute('cy',String(py));h.setAttribute('r',mode==='pivot'?'10':'6');}else{h.setAttribute('x',String(px-5));h.setAttribute('y',String(py-5));h.setAttribute('width','10');h.setAttribute('height','10');}
   h.setAttribute('fill',mode==='pivot'?'transparent':'#17212b');h.setAttribute('stroke','#fff');const title=doc.createElementNS(ns,'title');title.textContent=mode==='pivot'?'Déplacer le centre de rotation':mode==='rotate'?'Faire tourner autour de la croix':mode==='scale'?'Modifier l’échelle proportionnelle':'Déplacer la sélection';h.append(title);overlay.append(h);
  };
  if(mode==='pivot'){for(const target of pivotSnapTargets([[left,top],[right,top],[right,bottom],[left,bottom]])){const dot=doc.createElementNS(ns,'circle');dot.setAttribute('cx',String(target.x));dot.setAttribute('cy',String(target.y));dot.setAttribute('r','2.5');dot.setAttribute('fill','#fff');dot.setAttribute('fill-opacity','.6');overlay.append(dot);}handle(x,y,true,'pivot');}else if(mode==='move'){handle((left+right)/2,top,false,'n');handle(right,(top+bottom)/2,false,'e');handle((left+right)/2,bottom,false,'s');handle(left,(top+bottom)/2,false,'w');}else for(const [px,py,key]of [[left,top,'nw'],[right,top,'ne'],[right,bottom,'se'],[left,bottom,'sw']] as const)handle(px,py,mode==='rotate',key);
 };
 const down=(e:PointerEvent)=>{if(keyboard)finishKeyboard();if(e.target instanceof Element&&e.target.closest('[data-lottie-gradient-handle]'))return;
  if(gesture){consume(e);return;}
  const mode=host.editing?.read().mode,reading=host.read();if(!mode||!['move','rotate','scale','pivot'].includes(mode)||e.isPrimary===false||e.button!==0||((e.altKey||e.ctrlKey)&&!temporary)||e.metaKey||e.shiftKey||(e.target as Element).closest('[data-lottie-navigation]')||reading.playing||reading.loading||!reading.source||reading.selectedIds.length!==1)return;
  const nodes=indexLottiePaths(reading.source),selection=reading.selectedIds[0],leaves=new Set(selectedPathLeaves(nodes,[selection]).map(n=>n.id));
  const handle=(e.target as Element).closest('[data-lottie-transform-handle]');
  const boxHit=mode==='move'&&activeBox?.eligible&&activeBox.revision===reading.source.revision&&activeBox.time===reading.timeSeconds&&activeBox.selection===selection&&inside(e.clientX,e.clientY);
  if(!boxHit&&!(handle&&overlay.contains(handle))&&!observation.hitTest(e.clientX,e.clientY).some(id=>id===selection||leaves.has(id)))return;
  let owner=nodes.find(n=>n.id===selection);while(owner&&!['layer','precomposition','group'].includes(owner.kind))owner=nodes.find(n=>n.id===owner!.parentId);
  const frame=owner&&observation.transformFrame(owner.id);if(!owner||!frame)return;
  consume(e);host.editing!.dispatch({type:'set-mode',mode});
  const keys=mode==='move'?['p']:mode==='rotate'?['r']:mode==='scale'?['s']:['a','p'],properties=host.editing!.read().properties,values:Values={};
  for(const key of keys){const property=properties.find(p=>p.ownerId===owner!.id&&p.pointer.endsWith('/'+key));if(!property?.editable||!property.value){host.editing!.dispatch({type:'transform',id:owner.id,values:{[key]:property?.value??[]}});return;}values[key as keyof Values]=[...property.value];}
  const ownerLeaves=new Set(selectedPathLeaves(nodes,[owner.id]).map(n=>n.id));
  const bounds=observation.selectionBounds().filter(b=>ownerLeaves.has(b.id)||b.id===owner!.id).map(b=>b.bounds);if(!bounds.length)return;
  const left=Math.min(...bounds.map(b=>b.left)),right=Math.max(...bounds.map(b=>b.right)),top=Math.min(...bounds.map(b=>b.top)),bottom=Math.max(...bounds.map(b=>b.bottom));
  gesture={pointer:e.pointerId,selection,owner:owner.id,revision:reading.source.revision,time:reading.timeSeconds,mode:mode as Mode,cursor:mode==='move'?'move':mode==='pivot'?'crosshair':mode==='rotate'?rotationCursor:(handle?.getAttribute('data-lottie-handle-cursor')??stage.style.cursor)||'nwse-resize',start:{x:e.clientX,y:e.clientY},frame,values,corners:[[left,top],[right,top],[right,bottom],[left,bottom]],next:null};
  stage.focus({preventScroll:true});stage.setPointerCapture(e.pointerId);stage.style.cursor=gesture.cursor;draw(gesture.start);
 };
 const move=(e:PointerEvent)=>{if(!gesture){if(e.buttons){hover=null;return;}if(!(e.target as Element).closest('[data-lottie-navigation]')){hover={x:e.clientX,y:e.clientY,alt:e.altKey,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey,handle:(e.target as Element).closest('[data-lottie-transform-handle]')?.getAttribute('data-lottie-transform-handle')??null,handleKey:(e.target as Element).closest('[data-lottie-transform-handle]')?.getAttribute('data-lottie-handle-key')??null,handleCursor:(e.target as Element).closest('[data-lottie-transform-handle]')?.getAttribute('data-lottie-handle-cursor')??null};cursor();for(const h of Array.from(overlay.querySelectorAll('[data-lottie-transform-handle]')))h.setAttribute('data-hovered',String(h.getAttribute('data-lottie-handle-key')===hover.handleKey&&!navigationModifier()));}return;}if(gesture.pointer!==e.pointerId)return;consume(e);if(!scopeValid()){cancel();return;}draw({x:e.clientX,y:e.clientY});};
 const wheelHover=(e:WheelEvent)=>{hover={x:e.clientX,y:e.clientY,alt:e.altKey,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey,handle:null,handleKey:null,handleCursor:null};};
 const up=(e:PointerEvent)=>{if(gesture?.pointer!==e.pointerId)return;consume(e);const valid=scopeValid();draw({x:e.clientX,y:e.clientY});const g=gesture!;if(valid&&g.next&&Math.hypot(e.clientX-g.start.x,e.clientY-g.start.y)>0){cancel(true);host.editing?.dispatch({type:'transform',id:g.owner,values:g.next});if(host.read().source?.revision===g.revision)observation.clearTransformPreview?.();}else cancel();};
 const abort=(e:PointerEvent)=>{if(gesture?.pointer===e.pointerId){consume(e);cancel();}};
 const key=(e:KeyboardEvent)=>{if(gesture&&e.key==='Escape'){consume(e);cancel();}if(hover){hover={...hover,alt:e.altKey,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey};cursor();}};
 const nudge=(e:KeyboardEvent)=>{
  if(closed||gesture||e.defaultPrevented||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||e.altKey||e.metaKey)return;
  const target=e.target instanceof Element?e.target:null;
  if(target?.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="separator"],[data-timeline-reading]')||(!hover&&!stage.contains(doc.activeElement)&&!stage.contains(target)))return;
  const reading=host.read(),editing=host.editing,mode=editing?.read().mode;
  if(!editing||!reading.source||reading.loading||reading.playing||reading.selectedIds.length!==1||(mode!=='move'&&!(temporary==='rotate'&&mode==='rotate'&&e.ctrlKey)))return;
  if(keyboard&&!keyboardScope())finishKeyboard(false);
  if(!keyboard){
   const nodes=indexLottiePaths(reading.source);let owner=nodes.find(n=>n.id===reading.selectedIds[0]);while(owner&&!['layer','precomposition','group'].includes(owner.kind))owner=nodes.find(n=>n.id===owner!.parentId);if(!owner?.selectable)return;
   const frame=observation.transformFrame(owner.id),parent=frame&&inverseLinear(frame.parentInverse);if(!parent)return;
   // Read Position at the current time, not an old key targeted by an inspector.
   if(temporary){temporary=null;editing.dispatch({type:'set-mode',mode:'move'});}
   const property=editing.read({atCurrentTime:true}).properties.find(p=>p.ownerId===owner!.id&&p.pointer.endsWith('/p'));if(!property?.editable||!property.value||property.value.length<2)return;
   keyboard={owner:owner.id,selection:suffix(reading.selectedIds[0],reading.source),revision:reading.source.revision,sourceId:reading.source.id,time:reading.timeSeconds,dx:0,dy:0,parent,held:new Set()};
  }
  e.preventDefault();e.stopImmediatePropagation();clearTimeout(keyboardTimer);keyboardTimer=undefined;
  const step=e.ctrlKey?10:1,k=keyboard;k.held.add(e.key);k.dx+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;k.dy+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
  const x=k.parent[0]*k.dx+k.parent[2]*k.dy,y=k.parent[1]*k.dx+k.parent[3]*k.dy;
  const painted=observation.previewTransform?.(k.owner,[1,0,0,1,x,y]);
  if(painted!==false){overlay.setAttribute('transform','translate('+x+' '+y+')');stage.style.cursor='move';}
 };
 const temporaryKey=(e:KeyboardEvent)=>{
  if(keyboard||!['Control','Alt'].includes(e.key)||e.repeat)return;
  const reading=host.read(),mode=host.editing?.read().mode;
  if(temporary&&mode!==temporary)temporary=null;
  if(temporary&&(!reading.source||reading.playing||reading.selectedIds.length!==1)){releaseTemporary();return;}
  if((mode!=='move'&&!temporary)||!reading.source||reading.playing||reading.selectedIds.length!==1)return;
  if(!temporary&&(!hover&&!stage.contains(doc.activeElement)||(e.target as Element).closest?.('input,textarea,select,[contenteditable]')))return;
  const next=e.ctrlKey?'rotate':e.altKey?'scale':null;
  if(next===temporary)return;e.preventDefault();const previous=temporary;temporary=next;
  if(next)host.editing!.dispatch({type:'set-mode',mode:next});else if(previous&&mode===previous)host.editing!.dispatch({type:'set-mode',mode:'move'});
 };
 const releaseTemporary=()=>{const previous=temporary;temporary=null;if(previous&&host.editing?.read().mode===previous)host.editing.dispatch({type:'set-mode',mode:'move'});};
 const leave=()=>{hover=null;for(const h of Array.from(overlay.querySelectorAll('[data-lottie-transform-handle]')))h.setAttribute('data-hovered','false');if(!gesture)stage.style.cursor='';};
 const off=host.subscribe(()=>{if(keyboard&&!keyboardScope())finishKeyboard(false);if(temporary&&host.editing?.read().mode!==temporary)temporary=null;else if(temporary&&(host.read().playing||host.read().selectedIds.length!==1))releaseTemporary();if(gesture&&!scopeValid())cancel();refresh();});
 doc.addEventListener('keydown',keyboardEscape,true);doc.addEventListener('keyup',keyboardUp,true);doc.defaultView?.addEventListener('blur',keyboardBlur);doc.addEventListener('keydown',nudge,true);doc.addEventListener('keydown',temporaryKey,true);doc.addEventListener('keyup',temporaryKey,true);doc.defaultView?.addEventListener('blur',releaseTemporary);
 stage.addEventListener('pointerleave',leave);stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,true);stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',abort,true);stage.addEventListener('lostpointercapture',abort,true);stage.addEventListener('keydown',key,true);stage.addEventListener('keyup',key,true);
 stage.addEventListener('wheel',wheelHover,{capture:true,passive:true});
 refresh();return {cancel,refresh,dispose(){closed=true;finishKeyboard(false);cancel();off();doc.removeEventListener('keydown',keyboardEscape,true);doc.removeEventListener('keyup',keyboardUp,true);doc.defaultView?.removeEventListener('blur',keyboardBlur);doc.removeEventListener('keydown',nudge,true);doc.removeEventListener('keydown',temporaryKey,true);doc.removeEventListener('keyup',temporaryKey,true);doc.defaultView?.removeEventListener('blur',releaseTemporary);releaseTemporary();stage.removeEventListener('wheel',wheelHover,true);stage.removeEventListener('pointerleave',leave);stage.removeEventListener('pointerdown',down,true);stage.removeEventListener('pointermove',move,true);stage.removeEventListener('pointerup',up,true);stage.removeEventListener('pointercancel',abort,true);stage.removeEventListener('lostpointercapture',abort,true);stage.removeEventListener('keydown',key,true);stage.removeEventListener('keyup',key,true);overlay.remove();style.remove();}};
}

