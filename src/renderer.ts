import {patchNativeNumericProperties} from './incrementalProperties.js';
import {createLiveLottieTransform} from './liveTransform.js';
import {lottieTransformFrame} from './transformFrame.js';
import {lottieTranslationDelta} from './editTranslation.js';
import {createLottieOnionSkin,type LottieOnionReading} from './onionSkin.js';
import {createLottieTrajectory} from './trajectory.js';
import {createSelectedOrigin} from './selectedOrigin.js';
import {readGroupSelection,createGroupSelectionOverlay} from './groupSelection.js';
import { readLottieSelectionBounds } from './rectanglePicking.js';
import { createLottieIsolation } from './isolation.js';
import {createCompositionCrop} from './compositionCrop.js';
import type {LottiePathType} from './pathTypes.js';
import {defaultLottiePathAppearance,normalizeLottiePathAppearance} from './pathAppearance.js';
import type { AnimationItem, LottiePlayer, SVGRendererConfig } from 'lottie-web';
import type { LottieRenderer, LottieSource } from './contracts.js';
import { inspectLottieProfile } from './profile.js';
import { indexLottiePaths, selectedPathLeaves } from './paths.js';
import {createLottieNullOverlay} from './nullProjection.js';
import { createLottieHighlight, resolveProjectedPath, isProjectedPathVisible,readProjectedTypeData } from './highlight.js';
import { createLottiePathPicker } from './picking.js';
import { createLottieVisibility } from './visibility.js';
import { createConstructionOverlay } from './construction.js';

export async function createRenderer(target: HTMLElement, source: LottieSource,
  load: () => Promise<LottiePlayer>,publishOnion?:(value:LottieOnionReading|null)=>void): Promise<LottieRenderer> {
  inspectLottieProfile(source.data);
  const player = await load();
  let animation: AnimationItem | undefined;
  try {
    const rendererSettings: SVGRendererConfig & { runExpressions: boolean } = {
      preserveAspectRatio: 'xMidYMid meet', runExpressions: false, title: source.label,
      description: 'Lecture expérimentale pilotée par le temps du Workbench', progressiveLoad: false };
    animation = player.loadAnimation({ container: target, renderer: 'svg', loop: false, autoplay: false,
      animationData: structuredClone(source.data),
      rendererSettings });
    const current = animation;
    await new Promise<void>((resolve, reject) => {
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Le lecteur ne peut pas charger cette animation.')); };
      const timer = setTimeout(failed, 10000);
      const cleanup = () => { clearTimeout(timer); current.removeEventListener('DOMLoaded', loaded); current.removeEventListener('data_failed', failed); };
      current.addEventListener('DOMLoaded', loaded);
      current.addEventListener('data_failed', failed);
      if (current.isLoaded) loaded();
    });
    const projectedRenderer = (current as unknown as { renderer: Parameters<typeof createLottieHighlight>[0] }).renderer;
    let nodes = indexLottiePaths(source),currentSource=source;
    let liveTransform=createLiveLottieTransform(projectedRenderer,nodes);
    const crop=createCompositionCrop(projectedRenderer.layerElement,source.data.w as number,source.data.h as number);
    let highlight = createLottieHighlight(projectedRenderer, nodes);
    const groupSelection=createGroupSelectionOverlay(target);
    let onion=createLottieOnionSkin(target,source,player,publishOnion,projectedRenderer);
    const origin=createSelectedOrigin(target);
    let trajectory=createLottieTrajectory(target,source,player,projectedRenderer);
    let onionFrame=0,onionLoop=false,onionPlaying=false;
    let isolation = createLottieIsolation(projectedRenderer,nodes);
    let isolateSelection=false;
    let visibility = createLottieVisibility(projectedRenderer,nodes);
    let construction=createConstructionOverlay(projectedRenderer,nodes);
    let nulls=createLottieNullOverlay(projectedRenderer,nodes);
    let globalConstruction=nodes.filter(node=>node.selectable&&(node.kind==='path'||(node.kind==='mask'&&node.maskQualified))).map(node=>({node,overlay:createConstructionOverlay(projectedRenderer,nodes)}));
    let appearance={...defaultLottiePathAppearance};
    let disposed = false, showPaths=false, viewScale=1;
    let hiddenIds:readonly string[]=[];
    let typeData:ReturnType<typeof readProjectedTypeData>|undefined;
    const picker=createLottiePathPicker(projectedRenderer,()=>nodes);
    const boundsGeometry=new Map<string,ReturnType<typeof import('./projectedGeometry.js').projectedPathBounds>>();
    let boundsKey='',boundsReading:ReturnType<typeof readLottieSelectionBounds>=[];
    let pickVersion=0;

    let selectionPaintKey='',isolationIdsKey='';
    const invalidatePick=()=>{pickVersion++;picker.invalidate();};
    const selectionBounds=()=>{
      const matrix=projectedRenderer.layerElement?.getScreenCTM();
      const key=[pickVersion,matrix?.a,matrix?.b,matrix?.c,matrix?.d,matrix?.e,matrix?.f].join(':');
      if(!matrix||key!==boundsKey){boundsKey=key;boundsReading=readLottieSelectionBounds(projectedRenderer,nodes,boundsGeometry);}
      return boundsReading;
    };
    const typeReading=()=>typeData??(typeData=readProjectedTypeData(projectedRenderer,nodes));
    return {
      // Preparation is hidden; its visibility-dependent bounds cannot survive activation.
      activate(){invalidatePick();selectionPaintKey='';},
      updateSource(next){
        if(disposed||next.id!==currentSource.id||!patchNativeNumericProperties((current as unknown as {animationData:Record<string,any>}).animationData,projectedRenderer,currentSource.data,next.data))return false;
        invalidatePick();liveTransform.clear();isolation.restore();onion.dispose();trajectory.dispose();highlight.dispose();construction.clear();nulls.clear();globalConstruction.forEach(({overlay})=>overlay.clear());visibility.dispose();
        currentSource=next;nodes=indexLottiePaths(next);typeData=undefined;
        liveTransform=createLiveLottieTransform(projectedRenderer,nodes);highlight=createLottieHighlight(projectedRenderer,nodes);onion=createLottieOnionSkin(target,next,player,publishOnion,projectedRenderer);trajectory=createLottieTrajectory(target,next,player,projectedRenderer);
        isolation=createLottieIsolation(projectedRenderer,nodes);visibility=createLottieVisibility(projectedRenderer,nodes);construction=createConstructionOverlay(projectedRenderer,nodes);nulls=createLottieNullOverlay(projectedRenderer,nodes);
        globalConstruction=nodes.filter(node=>node.selectable&&(node.kind==='path'||(node.kind==='mask'&&node.maskQualified))).map(node=>({node,overlay:createConstructionOverlay(projectedRenderer,nodes)}));
        return true;
      },
      setOnionTime(frame,loop,playing){onionFrame=frame;onionLoop=loop;onionPlaying=playing;},
      renderFrame(frame) { if (!disposed) {invalidatePick();liveTransform.clear();isolation.restore();current.goToAndStop(frame, true);typeData=undefined;} },
      setVisibility(ids) { if(!disposed&&!(ids.length===hiddenIds.length&&ids.every((id,i)=>id===hiddenIds[i]))){invalidatePick();hiddenIds=ids;visibility.update(ids);} },
      previewTransform(id,matrix){invalidatePick();return !disposed&&liveTransform.preview(id,matrix);},
      clearTransformPreview(){invalidatePick();liveTransform.clear();},
      gradientSpace(id){const node=nodes.find(n=>n.id===id&&n.kind==='style'&&['gf','gs'].includes(String(n.sourceType)));if(!node||disposed)return null;let layer:any=projectedRenderer;for(const i of node.layerRoute)layer=layer?.elements?.[i];let container=layer?.layerElement,items=layer?.itemsData;for(const i of node.shapeRoute.slice(0,-1)){const group=items?.[i];container=group?.gr;items=group?.it;}const m=container?.getScreenCTM();return m&&[m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite)?[m.a,m.b,m.c,m.d,m.e,m.f]:null;},
      transformFrame(id){const node=nodes.find(n=>n.id===id);return !disposed&&node?lottieTransformFrame(projectedRenderer,node):null;},
      translationDelta(id,dx,dy){const node=nodes.find(n=>n.id===id);return !disposed&&node?lottieTranslationDelta(projectedRenderer,node,dx,dy):null;},
      selectionBounds(){return disposed?[]:selectionBounds();},
      setSelectionIsolation(enabled){if(isolateSelection!==enabled)invalidatePick();isolateSelection=enabled;},
      hitTest(x,y) { return disposed?[]:picker.hitTest(x,y); },
      select(ids, hoveredIds) { if (!disposed) {
        const nextIsolation=JSON.stringify(isolateSelection?ids:[]);if(nextIsolation!==isolationIdsKey){isolationIdsKey=nextIsolation;invalidatePick();}
        const camera=projectedRenderer.layerElement?.getScreenCTM();
        const nextPaint=JSON.stringify([pickVersion,ids,hiddenIds,onionFrame,onionLoop,onionPlaying,showPaths,appearance,viewScale,isolateSelection,camera&&[camera.a,camera.b,camera.c,camera.d,camera.e,camera.f]]);
        const selectionChanged=nextPaint!==selectionPaintKey;selectionPaintKey=nextPaint;
        if(selectionChanged){for(const {node,overlay} of globalConstruction){
        if(showPaths&&appearance.handles&&!ids.includes(node.id)&&!(node.kind==='mask'&&node.parentId&&ids.includes(node.parentId)))overlay.update([node.id],appearance,viewScale);else overlay.clear();
      }
      trajectory.update(ids,hiddenIds,appearance,typeReading().types);
      onion.update(onionFrame,onionLoop,onionPlaying,appearance,hiddenIds,ids);
      const visibleSelected=selectedPathLeaves(nodes,ids,typeReading().influences).some(node=>{const p=resolveProjectedPath(projectedRenderer,node);return !!p&&isProjectedPathVisible(p.path);});
      origin.update(projectedRenderer,nodes,ids,hiddenIds,visibleSelected,typeReading().types);
      isolation.update(isolateSelection?ids:[],typeReading().influences);
      construction.update(ids,undefined,viewScale,appearance);groupSelection.update(ids.length?readGroupSelection(nodes,ids,selectionBounds(),typeReading().types,typeReading().influences):null);
      }
      highlight.update(ids, hoveredIds, showPaths,appearance,typeReading().influences,nextPaint);nulls.update(ids,hoveredIds??[],showPaths,appearance,viewScale,hiddenIds); } },
      inspectionSummary() {return nulls.summary()||origin.summary()||construction.summary();},
      pathTypes(){return disposed?{}:typeReading().types;},
      pathInfluences(){return disposed?{}:typeReading().influences;},
      isVisible(ids) { return ids.some(id=>nulls.visible(id,hiddenIds))||selectedPathLeaves(nodes,ids,typeReading().influences).some(node=>{const projected=resolveProjectedPath(projectedRenderer,node);return !!projected && isProjectedPathVisible(projected.path);}); },
      setViewScale(scale){if(Number.isFinite(scale)&&scale>0)viewScale=scale;},
      setPathAppearance(value){appearance=normalizeLottiePathAppearance(value,appearance);crop.update(appearance.cropViewport);},
      setShowPaths(enabled){showPaths=enabled;},
      resize() { if (!disposed) current.resize(); },
      dispose() { if (disposed) return; disposed = true;liveTransform.clear(); onion.dispose();trajectory.dispose();origin.dispose();groupSelection.dispose(); highlight.dispose(); construction.clear();nulls.clear();globalConstruction.forEach(({overlay})=>overlay.clear()); visibility.dispose(); isolation.restore(); crop.dispose(); current.destroy(); }
    };
  } catch (error) { animation?.destroy(); throw error; }
}

export const createLightRenderer = (target: HTMLElement, source: LottieSource,publishOnion?:(value:LottieOnionReading|null)=>void) =>
  createRenderer(target, source, async () => (await import('lottie-web/build/player/lottie_light.js')).default as unknown as LottiePlayer,publishOnion);
