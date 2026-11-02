import {mountLottieFileDrop} from './fileDrop.js';
import {mountLottieGradientTools} from './gradientSurface.js';
import {mountLottieTransformTools} from './transformSurface.js';
import {mountLottiePen} from './penSurface.js';
import {indexLottiePaths,selectedPathLeaves} from './paths.js';
export {createLottieOnionObservation} from './onionSkin.js';
export type {LottieOnionObservation,LottieOnionReading,LottieOnionPose} from './onionSkin.js';
import type {LottieOnionObservation} from './onionSkin.js';
import {mountLottieViewGuides} from './viewGuides.js';
export {lottiePathTypes,createLottiePathTypeObservation} from './pathTypes.js';
import type {LottiePathTypeObservation} from './pathTypes.js';
export type {LottiePathTypeObservation} from './pathTypes.js';
import {defaultLottiePathAppearance,normalizeLottiePathAppearance,normalizeLottiePathView,type LottiePathViewPort,type LottiePathSettingsMount} from './pathAppearance.js';
export {normalizeLottiePathView} from './pathAppearance.js';
export type {LottiePathAppearance,LottiePathSettingsMount,LottiePathView,LottiePathViewPort} from './pathAppearance.js';
import {createLottieNavigation,mountLottieNavigationProjection,type LottieNavigationPolicy} from './navigation.js';
export type {LottieNavigationPolicy} from './navigation.js';
import type { KonitifToolSurfaceImplementation } from '@konitif/tools';
import type { LottieRendererFactory, LottieViewerHost, LottieRectangleSelectionMount } from './contracts.js';
import { createLightRenderer } from './renderer.js';
import { createLottieReadingSession } from './session.js';
import { frameAtSeconds } from './profile.js';
import { createDepthPickCycle } from './picking.js';

export function mountLottieViewerSurface(target: HTMLElement, options: {
  host: LottieViewerHost;
  rendererFactory?: LottieRendererFactory;
  mountRectangleSelection?: LottieRectangleSelectionMount;
  label?: string;
  controls?: boolean;
  /** Omit duplicate chrome when the host supplies its own shell controls. */
  chrome?: 'default' | 'none';
  /** Host-shell controls can replace the viewport's editing toolbar. */
  editingToolbar?:boolean;
  mountHeaderActions?:(target:HTMLElement)=>{dispose():void};
  navigation?: LottieNavigationPolicy;
  navigationView?: {subscribe?(listener:()=>void):()=>void;read():unknown;write(value:{x:number;y:number;zoom:number}):void};
  mountPathSettings?:LottiePathSettingsMount;
  pathView?:LottiePathViewPort;
  pathTypes?:LottiePathTypeObservation;
  onion?:LottieOnionObservation;
}) {
  const doc = target.ownerDocument;
  const root = doc.createElement('section'); root.className = 'konitif-lottie';
  root.setAttribute('aria-label', options.label ?? 'Lecture Lottie');
  root.style.cssText = 'height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--color-text-primary,#dce6ef);background:var(--color-background-canvas,#17212b);font:13px system-ui';
  const header = doc.createElement('div');header.setAttribute('data-tool-chrome-clearance','inline-end');header.style.cssText = 'box-sizing:border-box;height:36px;flex:0 0 36px;--workbench-tool-chrome-clearance-base-inline-end:8px;padding:4px 8px;padding-inline-end:calc(8px + var(--workbench-tool-chrome-overlay-inline-end,0px));display:flex;gap:12px;align-items:center;overflow:hidden';
  const title = doc.createElement('strong'); title.style.cssText='min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; title.textContent = options.label ?? 'Composition';
  const select = doc.createElement('select'); select.setAttribute('aria-label', 'Animation'); select.style.cssText='max-width:55%;min-width:0';
  for (const source of options.host.sources) { const option = doc.createElement('option'); option.value = source.id; option.textContent = source.label; select.append(option); }
  header.append(title); if (options.controls !== false) header.append(select);
  const stage = doc.createElement('div'); stage.style.cssText = 'flex:1;min-height:0;min-width:0;position:relative;overflow:hidden;background:#202b36';
  stage.setAttribute('aria-label', 'Animation vectorielle');
  const initialView=normalizeLottiePathView(options.pathView?.read());
  let showPaths=initialView.showPaths,pathAppearance=initialView.appearance;
  let refreshSettings=()=>{},refreshToggle=()=>{},refreshOnion=()=>{},refreshTrajectory=()=>{};
  const navigation=options.navigation?createLottieNavigation(options.navigation):null;
  const zoomLabel=doc.createElement('output');zoomLabel.textContent='100 %';zoomLabel.setAttribute('aria-label','Zoom de la vue');
  stage.style.touchAction='none';stage.style.userSelect='none';
  const footer=doc.createElement('footer');footer.setAttribute('aria-label','Informations et commandes du lecteur');footer.style.cssText='box-sizing:border-box;position:relative;flex:0 0 36px;height:36px;min-height:36px;display:flex;align-items:center';
  const feedbackStyle='box-sizing:border-box;margin:0;padding:2px 14px;min-height:0;overflow:auto;line-height:15px;overflow-wrap:anywhere;';
  const status = doc.createElement('p'); status.setAttribute('role', 'status'); status.style.cssText = feedbackStyle;
  const warning = doc.createElement('p'); warning.tabIndex=0;warning.style.cssText = feedbackStyle+'color:var(--color-text-secondary,#b9c7d4);font-size:12px';
  const inspection = doc.createElement('p'); inspection.setAttribute('aria-label','Construction du tracé'); inspection.tabIndex=0;inspection.style.cssText=feedbackStyle+'font-size:12px;color:var(--color-text-secondary,#b9c7d4)';
  const error = doc.createElement('p'); error.setAttribute('role', 'alert'); error.tabIndex=0;error.style.cssText = feedbackStyle+'color:#ffb4a9';
  const bar = doc.createElement('div'); bar.style.cssText = 'box-sizing:border-box;width:100%;padding:4px 8px;display:flex;align-items:center;gap:10px;flex-wrap:nowrap;overflow:visible;min-width:0;min-height:0';
  const play = doc.createElement('button'); play.type = 'button'; play.textContent = 'Lire';
  const pause = doc.createElement('button'); pause.type = 'button'; pause.textContent = 'Pause';
  const seek = doc.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.step = '0.001'; seek.value = '0'; seek.setAttribute('aria-label', 'Position de lecture'); seek.style.cssText = 'flex:1;min-width:0;width:60px';
  const loop = doc.createElement('input'); loop.type = 'checkbox';
  const loopLabel = doc.createElement('label'); loopLabel.append(loop, doc.createTextNode(' Boucle'));
  const timing = doc.createElement('output'); timing.setAttribute('aria-label', 'Temps de lecture'); timing.style.cssText = 'font-variant-numeric:tabular-nums';
  const timeInput = doc.createElement('input'); timeInput.type = 'number'; timeInput.min = '0'; timeInput.step = '0.001';
  timeInput.setAttribute('aria-label', 'Aller au temps en secondes'); timeInput.style.cssText = 'width:65px';
  if (options.controls !== false) bar.append(play, pause, seek, timeInput, loopLabel);
  bar.append(timing);
  const details=doc.createElement('details');details.setAttribute('data-lottie-reading-details','');details.style.cssText='position:relative;flex:none';
  const summary=doc.createElement('summary');summary.textContent='Infos';summary.setAttribute('aria-label','Informations du lecteur');summary.style.cssText='cursor:pointer;white-space:nowrap';
  const feedback=doc.createElement('div');feedback.style.cssText='position:absolute;z-index:5;bottom:28px;right:0;width:min(360px,70vw);max-height:220px;overflow:auto;padding:8px;background:var(--color-background-panel,#17212b);border:1px solid var(--color-border-strong,#455564);border-radius:6px';
  feedback.append(status,warning,inspection,error);details.append(summary,feedback);bar.append(details);
  const noChrome=options.chrome==='none';
  if(noChrome){error.hidden=true;root.append(stage,error);}else{footer.append(bar);root.append(header,stage,footer);}
  target.append(root);
  const bind = (el: HTMLElement, event: string, listener: EventListener) => { el.addEventListener(event, listener); return () => el.removeEventListener(event, listener); };
  const releases = [
    bind(play, 'click', () => options.host.dispatch({ type: 'play' })),
    bind(pause, 'click', () => options.host.dispatch({ type: 'pause' })),
    bind(seek, 'input', () => options.host.dispatch({ type: 'seek', seconds: seek.valueAsNumber })),
    bind(timeInput, 'input', () => options.host.dispatch({ type: 'seek', seconds: timeInput.valueAsNumber })),
    bind(loop, 'change', () => options.host.dispatch({ type: 'set-loop', enabled: loop.checked })),
    bind(select, 'change', () => options.host.dispatch({ type: 'load-source', id: select.value }))
  ];
  if(options.mountHeaderActions&&!noChrome){const actions=doc.createElement('div');actions.style.cssText='display:flex;gap:6px;align-items:center;margin-left:auto;flex:none';header.append(actions);const mounted=options.mountHeaderActions(actions);releases.push(()=>mounted.dispose());}
  let refreshEditing=()=>{},lastEditingMessage='';
  if(options.host.editing&&options.controls!==false&&options.editingToolbar!==false){
   const commands=doc.createElement('div');commands.setAttribute('data-lottie-navigation','');commands.style.cssText='position:absolute;right:8px;top:calc(8px + var(--lottie-ruler-inset,0px));z-index:2;display:flex;flex-direction:column;gap:4px;padding:4px;background:var(--color-background-panel,#17212b);border-radius:6px';commands.setAttribute('role','toolbar');commands.setAttribute('aria-label','Édition visuelle');stage.append(commands);
   const button=(text:string,label:string,action:()=>void)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);releases.push(bind(b,'click',action));commands.append(b);return b;};
   const move=button('↔','Déplacer l’élément',()=>options.host.editing!.dispatch({type:'set-mode',mode:options.host.editing!.read().mode==='move'?'inspect':'move'}));
   const rotate=button('⟳','Rotation : glisser autour du pivot',()=>options.host.editing!.dispatch({type:'set-mode',mode:options.host.editing!.read().mode==='rotate'?'inspect':'rotate'}));
   const scale=button('⤢','Échelle proportionnelle : éloigner ou rapprocher du pivot',()=>options.host.editing!.dispatch({type:'set-mode',mode:options.host.editing!.read().mode==='scale'?'inspect':'scale'}));
   const pivot=button('⊕','Déplacer le pivot en gardant le dessin en place',()=>options.host.editing!.dispatch({type:'set-mode',mode:options.host.editing!.read().mode==='pivot'?'inspect':'pivot'}));
   const undo=button('↶','Annuler l’édition',()=>options.host.editing!.dispatch({type:'undo'}));
   const redo=button('↷','Rétablir l’édition',()=>options.host.editing!.dispatch({type:'redo'}));
   const exportButton=button('JSON','Exporter le JSON',()=>{const text=options.host.editing!.exportJSON(),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download=(options.host.read().source?.id??'composition')+'-edited.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
   refreshEditing=()=>{const state=options.host.editing!.read(),reading=options.host.read();for(const [button,mode] of [[move,'move'],[rotate,'rotate'],[scale,'scale'],[pivot,'pivot']] as const){button.setAttribute('aria-pressed',String(state.mode===mode));button.style.background=state.mode===mode?'#35566b':'';button.disabled=reading.playing||!reading.source;}undo.disabled=!state.canUndo||reading.playing;redo.disabled=!state.canRedo||reading.playing;exportButton.disabled=!reading.source;if(state.message){error.textContent=state.message;details.open=true;}else if(lastEditingMessage&&error.textContent===lastEditingMessage&&!reading.error)error.textContent='';lastEditingMessage=state.message;};
  }
  let refreshGradient=()=>{};
  let refreshTransform=()=>{};
  let refreshDrawing=()=>{},lastDrawingSourceId="";
  let hoverPoint: {x:number;y:number}|null=null, hoverCheckQueued=false, hoverCheckActive=false, viewportHoverRequested=false, surfaceClosed=false, hoverSourceKey='';
  let rectangleGesture:ReturnType<LottieRectangleSelectionMount>|undefined, rectangleScope="";
  let observationOwner:symbol|undefined,onionOwner:symbol|undefined;
  const session = createLottieReadingSession({
    host: options.host,
    async createRenderer(source) {
      navigation?.reset();if(source.id!==lastDrawingSourceId&&source.id.startsWith('composition-')&&source.revision==='created'){options.navigationView?.write({x:0,y:0,zoom:1});}else navigation?.restore(options.navigationView?.read());lastDrawingSourceId=source.id;const restored=navigation?.read();zoomLabel.textContent=Math.round((restored?.zoom??1)*100)+' %';stage.dataset.zoom=String(restored?.zoom??1);
      const canvas = doc.createElement('div'); canvas.style.cssText = 'position:absolute;inset:0;visibility:hidden;pointer-events:none';canvas.setAttribute('aria-hidden','true'); stage.append(canvas);
      try {
        const token=Symbol();
        const renderer = await (options.rendererFactory ?? ((target,source)=>createLightRenderer(target,source,value=>{if(onionOwner===token&&!surfaceClosed)options.onion?.publish(value);} )))(canvas, source);
        const owner=Symbol();
        const guides=mountLottieViewGuides(stage,canvas,()=>pathAppearance,options.navigation);guides.fit();renderer.resize();
        const project=navigation?mountLottieNavigationProjection(canvas,stage,navigation.read):()=>{};
        project();
        return { ...renderer, activate(){guides.fit();guides.update();canvas.style.removeProperty('visibility');canvas.style.removeProperty('pointer-events');canvas.removeAttribute('aria-hidden');renderer.activate?.();}, select(ids,hoveredIds){onionOwner=token;guides.fit();project();guides.update();renderer.setViewScale?.(navigation?.read().zoom??1);renderer.setShowPaths?.(showPaths);renderer.setPathAppearance?.(pathAppearance);renderer.select?.(ids,hoveredIds);observationOwner=owner;options.pathTypes?.publish(renderer.pathTypes?.()??{},renderer.pathInfluences?.()??{});}, dispose() { try { guides.dispose();renderer.dispose(); if(observationOwner===owner){observationOwner=undefined;options.pathTypes?.publish({});} } finally { canvas.remove(); } } };
      } catch (cause) { canvas.remove(); throw cause; }
    },
    present(reading, profile, ready, construction) {
      const nextRectangleScope=JSON.stringify([reading.source?.id,reading.source?.revision,reading.timeSeconds]);
      if(nextRectangleScope!==rectangleScope){rectangleScope=nextRectangleScope;rectangleGesture?.cancel();}
      refreshDrawing();refreshEditing();refreshTransform();refreshGradient();
      for(const source of options.host.sources)if(!Array.from(select.options).some(o=>o.value===source.id)){const option=doc.createElement('option');option.value=source.id;option.textContent=source.label;select.append(option);}
      inspection.textContent=construction||'Sélectionnez un tracé pour inspecter sa construction.';inspection.title=inspection.textContent;
      const hoverKey=JSON.stringify([reading.source?.id,reading.source?.revision]);
      if(hoverKey!==hoverSourceKey){hoverSourceKey=hoverKey;hoverPoint=null;}
      if(ready&&!hoverCheckActive&&(hoverPoint||reading.hoveredIds?.length))queueHoverCheck();
      root.dataset.sourceId = reading.sourceId ?? ''; root.dataset.playbackState = reading.playing ? 'playing' : 'paused';
      root.dataset.lottieReady = String(ready); root.dataset.lottieTime = String(reading.timeSeconds);
      root.dataset.lottieFrame = profile ? String(frameAtSeconds(profile, reading.timeSeconds)) : '';
      select.value = reading.source?.id ?? options.host.sources[0]?.id ?? '';
      seek.max = String(reading.durationSeconds || 1); seek.value = String(reading.timeSeconds);
      timeInput.max = String(reading.durationSeconds || 1);
      if (doc.activeElement !== timeInput) timeInput.value = reading.timeSeconds.toFixed(3);
      seek.setAttribute('aria-valuetext', `${reading.timeSeconds.toFixed(3)} secondes`);
      timeInput.disabled = seek.disabled = play.disabled = !ready || !!reading.loading || !!reading.error;
      pause.disabled = !reading.playing;play.hidden=reading.playing;pause.hidden=!reading.playing; loop.checked = reading.loop;
      timing.textContent = `${reading.timeSeconds.toFixed(3)} / ${reading.durationSeconds.toFixed(3)} s`;
      status.textContent = reading.loading ? 'Chargement de la fixture…' : !reading.source ? 'Aucune animation chargée.' : !ready ? 'Préparation du rendu…' : `${reading.source.label} · ${profile?.width} × ${profile?.height} · ${profile?.frameRate} i/s`;
      warning.textContent = profile?.warnings.join(' ') ?? '';warning.title=warning.textContent;status.title=status.textContent??'';
      // A renderer failure remains visible until the next source starts loading.
      if (reading.loading || reading.error) error.textContent = reading.error ?? '';error.title=error.textContent??'';if(error.textContent)details.open=true;summary.textContent=error.textContent?'Erreur':warning.textContent?'Infos ⚠':'Infos';if(noChrome)error.hidden=!error.textContent;
    },
    report(cause) { error.hidden=false;error.textContent = cause instanceof Error ? cause.message : 'Rendu indisponible.';error.title=error.textContent;details.open=true;summary.textContent='Erreur'; play.disabled = seek.disabled = true; root.dataset.lottieReady = 'false'; }
  });
  function publishViewportHover(ids:readonly string[]){
    const current=options.host.read();
    if(current.hoverOrigin==='viewport'&&ids.length===(current.hoveredIds?.length??0)&&ids.every((id,i)=>id===current.hoveredIds?.[i]))return;
    options.host.dispatch({type:'hover',ids,origin:'viewport'});
  }
  // Validate once after the camera has been projected. Publishing the resulting
  // hover may repaint overlays, but that repaint must not schedule another hit test.
  function queueHoverCheck(fromPointer=false){
    viewportHoverRequested ||= fromPointer;
    if(hoverCheckQueued||hoverCheckActive||surfaceClosed)return;
    hoverCheckQueued=true;
    queueMicrotask(()=>{
      hoverCheckQueued=false;if(surfaceClosed)return;
      const forceViewport=viewportHoverRequested;viewportHoverRequested=false;
      const current=options.host.read();hoverCheckActive=true;
      try{
        if(hoverPoint&&(forceViewport||current.hoverOrigin!=='list'))publishViewportHover(session.hitTest(hoverPoint.x,hoverPoint.y).slice(0,1));
        else if(current.hoveredIds?.length&&!session.isVisible(current.hoveredIds))options.host.dispatch({type:'hover',ids:[],origin:current.hoverOrigin??'list'});
      }finally{hoverCheckActive=false;}
    });
  }
  rectangleGesture=options.mountRectangleSelection?.(stage,{
    targets:session.selectionBounds,
    canStart(x,y){const reading=options.host.read();return !!reading.source&&!reading.loading&&!reading.playing&&options.host.editing?.read().mode!=='pen'&&!session.hitTest(x,y).length;},
    select(ids){
      down=null;navigation?.cancel();cycle.reset();hoverPoint=null;
      const reading=options.host.read();if(!reading.source)return;
      const nodes=indexLottiePaths(reading.source),byId=new Map(nodes.map(node=>[node.id,node]));
      const layers=ids.flatMap(id=>{let node=byId.get(id);while(node&&!['layer','precomposition'].includes(node.kind))node=node.parentId?byId.get(node.parentId):undefined;return node?[node.id]:[];});
      const selected=[...new Set([...reading.selectedIds,...layers])],chosen=new Set(selected);
      const withoutDescendants=selected.filter(id=>{let node=byId.get(id);while(node?.parentId){if(chosen.has(node.parentId))return false;node=byId.get(node.parentId);}return true;});
      options.host.dispatch({type:'hover',ids:[],origin:'viewport'});
      options.host.dispatch({type:'select',ids:withoutDescendants});
    }
  });
  if(rectangleGesture)releases.push(()=>rectangleGesture?.dispose());
  if(options.host.editing){const pen=mountLottiePen(stage,options.host);refreshDrawing=pen.refresh;releases.push(()=>pen.dispose());}
  const commitPathView=()=>{if(options.pathView)options.pathView.write({showPaths,appearance:pathAppearance});else session.refreshView();};
  if(options.pathView)releases.push(options.pathView.subscribe(()=>{const value=normalizeLottiePathView(options.pathView!.read());showPaths=value.showPaths;pathAppearance=value.appearance;refreshToggle();refreshOnion();refreshTrajectory();refreshSettings();session.refreshView();}));
  if(options.host.canImport&&options.controls!==false){const fileDrop=mountLottieFileDrop(stage,options.host);releases.push(()=>fileDrop.dispose());}
  const gradientTools=options.host.editing&&options.controls!==false?mountLottieGradientTools(stage,options.host,session):null;if(gradientTools){refreshGradient=()=>queueMicrotask(()=>gradientTools.refresh());releases.push(()=>gradientTools.dispose());}
  const transformTools=options.host.editing&&options.controls!==false?mountLottieTransformTools(stage,options.host,session):null;if(transformTools){refreshTransform=()=>queueMicrotask(()=>transformTools.refresh());releases.push(()=>transformTools.dispose());}
  const cycle = createDepthPickCycle();
  let down: {x:number;y:number;id:number}|null=null;
  const isControl=(e:Event)=>(e.target as Element).closest?.('[data-lottie-navigation]');
  const clearHover=()=>{hoverPoint=null;viewportHoverRequested=false;publishViewportHover([]);};
  let cancelEditView=()=>{};
  const updateView=(preserveHover=false,persist=true)=>{cancelEditView();rectangleGesture?.cancel();cycle.reset();if(!preserveHover)clearHover();session.refreshView();const v=navigation?.read();if(v){if(persist)options.navigationView?.write(v);stage.dataset.zoom=String(v.zoom);zoomLabel.textContent=`${Math.round(v.zoom*100)} %`;}};
  if(options.navigationView?.subscribe)releases.push(options.navigationView.subscribe(()=>{const before=navigation?.read();navigation?.restore(options.navigationView!.read());const after=navigation?.read();if(before&&after&&(before.x!==after.x||before.y!==after.y||before.zoom!==after.zoom))updateView(false,false);}));
  let editGesture:{id:number;x:number;y:number;nodeId:string;revision:string;time:number}|null=null;
  const preview=doc.createElement('div');preview.setAttribute('data-lottie-edit-preview','');preview.style.cssText='display:none;position:absolute;pointer-events:none;border:1px dashed #ffd966;z-index:1;box-sizing:border-box';stage.append(preview);
  const cancelEdit=()=>{const id=editGesture?.id;editGesture=null;preview.style.display='none';stage.style.cursor='';if(id!==undefined&&stage.hasPointerCapture(id))stage.releasePointerCapture(id);};
  cancelEditView=()=>{cancelEdit();transformTools?.cancel();};
  releases.push(options.host.subscribe(()=>{const reading=options.host.read();if(editGesture&&(reading.source?.revision!==editGesture.revision||reading.timeSeconds!==editGesture.time||reading.playing||reading.selectedIds.length!==1||reading.selectedIds[0]!==editGesture.nodeId||options.host.editing?.read().mode!=='move'))cancelEdit();}));
  const moveEdit=(e:PointerEvent)=>{if(!editGesture||editGesture.id!==e.pointerId)return false;preview.style.transform=`translate(${e.clientX-editGesture.x}px,${e.clientY-editGesture.y}px)`;return true;};
  releases.push(bind(stage,'keydown',e=>{if((e as KeyboardEvent).key==='Escape')cancelEdit();}),bind(stage,'pointercancel',cancelEdit),bind(stage,'lostpointercapture',cancelEdit));
  const pointerDown = (event: Event) => { const e=event as PointerEvent;if(isControl(e))return;stage.tabIndex=0;stage.focus({preventScroll:true});
   const reading=options.host.read(),editing=options.host.editing;
   if(editing?.read().mode==='move'&&e.button===0&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&reading.selectedIds.length===1&&reading.source){
    const id=reading.selectedIds[0],nodes=indexLottiePaths(reading.source),leaves=new Set(selectedPathLeaves(nodes,[id]).map(n=>n.id));
    if(session.hitTest(e.clientX,e.clientY).some(hit=>leaves.has(hit)||hit===id)){
     const property=editing.read().properties.find(p=>p.ownerId===id&&p.pointer.endsWith('/p'));
     if(reading.playing||!property?.editable||!session.translationDelta(id,0,0)){editing.dispatch({type:'translate',id,dx:0,dy:0});return;}
     e.preventDefault();down=null;navigation?.cancel();editGesture={id:e.pointerId,x:e.clientX,y:e.clientY,nodeId:id,revision:reading.source.revision,time:reading.timeSeconds};
     const bounds=session.selectionBounds().filter(b=>leaves.has(b.id)||b.id===id).map(b=>b.bounds),r=stage.getBoundingClientRect();
     if(bounds.length){const left=Math.min(...bounds.map(b=>b.left)),top=Math.min(...bounds.map(b=>b.top)),right=Math.max(...bounds.map(b=>b.right)),bottom=Math.max(...bounds.map(b=>b.bottom));Object.assign(preview.style,{display:'block',left:left-r.left+'px',top:top-r.top+'px',width:right-left+'px',height:bottom-top+'px',transform:''});}
     stage.setPointerCapture(e.pointerId);stage.style.cursor='move';return;
    }
   }
   if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};
   if(navigation?.down(e)){e.preventDefault();stage.setPointerCapture(e.pointerId);}
  };
  const pointerUp = (event: Event) => {
    const e=event as PointerEvent;if(isControl(e))return;
    if(editGesture?.id===e.pointerId){const gesture=editGesture,reading=options.host.read(),dx=e.clientX-gesture.x,dy=e.clientY-gesture.y,delta=session.translationDelta(gesture.nodeId,dx,dy);cancelEdit();
     if(Math.hypot(dx,dy)>5&&delta&&reading.source?.revision===gesture.revision&&reading.timeSeconds===gesture.time)options.host.editing?.dispatch({type:'translate',id:gesture.nodeId,...delta});return;}
    const start=down;down=null;
    const didPan=navigation?.up(e.pointerId);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);stage.style.cursor='';
    if(didPan){cycle.reset();return;}
    if(!start||start.id!==e.pointerId||e.button!==0||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5){cycle.reset();return;}
    const reading=options.host.read();
    const key=JSON.stringify([reading.source?.id,reading.source?.revision,reading.timeSeconds]);
    const id=cycle.pick(e.clientX,e.clientY,key,session.hitTest(e.clientX,e.clientY),reading.selectedIds);
    options.host.dispatch({type:'select',ids:id?[id]:[]});if(id&&options.controls!==false&&options.host.editing?.read().mode==='inspect')options.host.editing.dispatch({type:'set-mode',mode:'move'});
  };
  const pointerMove = (event:Event)=>{const e=event as PointerEvent;if(isControl(e))return;if(moveEdit(e))return;if(navigation?.move(e)){stage.style.cursor='grabbing';updateView();return;}if(e.buttons)return;if(hoverPoint?.x===e.clientX&&hoverPoint?.y===e.clientY&&options.host.read().hoverOrigin==='viewport')return;hoverPoint={x:e.clientX,y:e.clientY};queueHoverCheck(true);};
  const pointerLeave = ()=>{hoverPoint=null;if(options.host.read().hoverOrigin==='viewport')options.host.dispatch({type:'hover',ids:[],origin:'viewport'});};
  releases.push(bind(stage,'pointermove',pointerMove),bind(stage,'pointerleave',pointerLeave));
  releases.push(bind(stage,'pointerdown',pointerDown),bind(stage,'pointerup',pointerUp),bind(stage,'pointercancel',()=>{down=null;navigation?.cancel();stage.style.cursor='';cycle.reset();}),bind(stage,'lostpointercapture',()=>{down=null;navigation?.cancel();stage.style.cursor='';}));
  if(navigation){
   const toolbar=doc.createElement('div');toolbar.setAttribute('data-lottie-navigation','');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Navigation de la vue');
   toolbar.title='Molette : zoom autour du pointeur · Glisser : déplacer · Clic : sélectionner';
   toolbar.style.cssText='position:absolute;z-index:2;left:calc(8px + var(--lottie-ruler-inset,0px));top:calc(8px + var(--lottie-ruler-inset,0px));display:flex;gap:6px;align-items:center;padding:4px;border-radius:6px;background:var(--color-background-panel,#17212b)';
   const button=(label:string,text:string,action:()=>void)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.title=label;releases.push(bind(b,'click',action));return b;};
   const zoom=(direction:1|-1)=>{navigation.zoom({x:stage.clientWidth/2,y:stage.clientHeight/2},direction);updateView();};
   const outlines=button('Afficher tous les tracés','Tracés',()=>{showPaths=!showPaths;refreshToggle();commitPathView();});refreshToggle=()=>{outlines.setAttribute('aria-pressed',String(showPaths));outlines.style.background=showPaths?'#35566b':'';};refreshToggle();
   toolbar.append(button('Zoom arrière','−',()=>zoom(-1)),zoomLabel,button('Zoom avant','+',()=>zoom(1)),button('Cadrer toute l’animation','Cadrer',()=>{navigation.reset();updateView();}));
   const onions=button('Peau d’oignon','Oignon',()=>{pathAppearance=normalizeLottiePathAppearance({onionEnabled:!pathAppearance.onionEnabled},pathAppearance);refreshOnion();commitPathView();});
   refreshOnion=()=>{onions.setAttribute('aria-pressed',String(pathAppearance.onionEnabled));onions.style.background=pathAppearance.onionEnabled?'#35566b':'';};refreshOnion();
   const mountedSettings:{refresh?():void;dispose():void}[]=[];
   const commandGroup=(label:string,toggle:HTMLButtonElement,section:'paths'|'onion'|'trajectory')=>{
    const group=doc.createElement('span');group.setAttribute('role','group');group.setAttribute('aria-label',label);group.setAttribute('data-lottie-command-group',section);group.style.cssText='display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--color-border-strong,#455564);border-radius:6px';group.append(toggle);
    if(options.mountPathSettings&&section!=='trajectory'){const settings=doc.createElement('span');group.append(settings);const mounted=options.mountPathSettings(settings,{section,read:()=>({...pathAppearance}),update(patch){pathAppearance=normalizeLottiePathAppearance(patch,pathAppearance);commitPathView();}});mountedSettings.push(mounted);releases.push(()=>mounted.dispose());}
    toolbar.append(group);
   };
   const trajectory=button('Trajectoire du pivot sélectionné','Path',()=>{pathAppearance=normalizeLottiePathAppearance({trajectoryEnabled:!pathAppearance.trajectoryEnabled},pathAppearance);refreshTrajectory();commitPathView();});
   refreshTrajectory=()=>{trajectory.setAttribute('aria-pressed',String(pathAppearance.trajectoryEnabled));trajectory.style.background=pathAppearance.trajectoryEnabled?'#35566b':'';};refreshTrajectory();
   commandGroup('Tracés',outlines,'paths');commandGroup('Peau d’oignon',onions,'onion');commandGroup('Trajectoire',trajectory,'trajectory');refreshSettings=()=>mountedSettings.forEach(mounted=>mounted.refresh?.());
   stage.append(toolbar);
   const wheel=(e:WheelEvent)=>{if(isControl(e)||!e.deltaY)return;e.preventDefault();const r=stage.getBoundingClientRect();if(!navigation.zoom({x:e.clientX-r.left,y:e.clientY-r.top},e.deltaY<0?1:-1))return;hoverPoint={x:e.clientX,y:e.clientY};queueHoverCheck(true);updateView(true);};
   stage.addEventListener('wheel',wheel,{passive:false});releases.push(()=>stage.removeEventListener('wheel',wheel));
  }
  const Resize = doc.defaultView?.ResizeObserver;
  const resize = Resize ? new Resize(() => session.resize()) : null; resize?.observe(stage);
  let disposed = false;
  return { settled: session.settled, dispose() {
    if (disposed) return; disposed = true; surfaceClosed=true; hoverPoint=null;
    cancelEdit();resize?.disconnect(); releases.forEach(release => release()); session.dispose();options.onion?.publish(null); root.remove();
  } };
}

export const lottieViewerSurface: KonitifToolSurfaceImplementation<HTMLElement, Record<string, never>, { host: LottieViewerHost; mountHeaderActions?:(target:HTMLElement)=>{dispose():void}; navigation?: LottieNavigationPolicy; navigationView?:{subscribe?(listener:()=>void):()=>void;read():unknown;write(value:{x:number;y:number;zoom:number}):void}; mountPathSettings?:LottiePathSettingsMount;pathView?:LottiePathViewPort;pathTypes?:LottiePathTypeObservation;onion?:LottieOnionObservation;mountRectangleSelection?:LottieRectangleSelectionMount }> = {
  requiredServices: ['host'],
  mount({ target, services }) { return mountLottieViewerSurface(target, { host: services.host,mountHeaderActions:services.mountHeaderActions, navigation:services.navigation,navigationView:services.navigationView,mountPathSettings:services.mountPathSettings,pathView:services.pathView,pathTypes:services.pathTypes,onion:services.onion,mountRectangleSelection:services.mountRectangleSelection }); }
};

export {mountLottiePen} from './penSurface.js';




/** Clean render projection for admitted output consumers; no transport or playback ownership. */
export {createLightRenderer};
