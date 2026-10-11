import {onionSelectedPaint,onionUnderlayIndices,cloneOnionPaint,mountOnionPaint,type OnionLayerProjection} from './onionComposition.js';
import type {AnimationItem,LottiePlayer,SVGRendererConfig} from 'lottie-web';
import type {LottieSource} from './contracts.js';
import {inspectLottieProfile} from './profile.js';
import {indexLottiePaths} from './paths.js';
import {createLottieVisibility} from './visibility.js';
import {onionSkinSamples,type LottieOnionSettings} from './onionSkinPolicy.js';
export const onionColors={past:'#56b4e9',future:'#e69f00'} as const;
export interface LottieOnionPose {frame:number;timeSeconds:number;direction:'past'|'future';distance:number;opacity:number;color:string;}
export interface LottieOnionReading {sourceId:string;revision:string;poses:readonly LottieOnionPose[];}
export interface LottieOnionObservation {read():LottieOnionReading|null;publish(value:LottieOnionReading|null):void;subscribe(listener:()=>void):()=>void;}
export function createLottieOnionObservation():LottieOnionObservation {
 let value:LottieOnionReading|null=null,key='null';const listeners=new Set<()=>void>();
 return {read:()=>value,publish(next){const k=JSON.stringify(next);if(k===key)return;key=k;value=next?Object.freeze({...next,poses:Object.freeze(next.poses.map(p=>Object.freeze({...p})))}):null;listeners.forEach(fn=>fn());},subscribe(fn){listeners.add(fn);return()=>{listeners.delete(fn);};}};
}
let nextInstance=0;
/** Independent evaluation; never receives or dispatches a host seek. Eight inert poses maximum. */
export function createLottieOnionSkin(target:HTMLElement,source:LottieSource,player:LottiePlayer,publish:(value:LottieOnionReading|null)=>void=()=>{},mainRenderer?:OnionLayerProjection) {
 const doc=target.ownerDocument,ns='http://www.w3.org/2000/svg',profile=inspectLottieProfile(source.data),nodes=indexLottiePaths(source),prefix='konitif-onion-'+(++nextInstance)+'-',underlays=onionUnderlayIndices(source.data);
 let worker:AnimationItem|undefined,container:HTMLDivElement|undefined,layer:SVGGElement|undefined,visibility:ReturnType<typeof createLottieVisibility>|undefined;
 let failedState=false,failureMessage:HTMLParagraphElement|undefined;
 let closed=false,ready=false,generation=0,lastKey='',lastSelection='',lastPaint=0,cleanupLoad=()=>{};
 let latest:{frame:number;loop:boolean;playing:boolean;settings:LottieOnionSettings;hidden:readonly string[];selected:readonly string[]}|undefined;
 const clear=()=>{layer?.remove();layer=undefined;lastKey='';publish(null);};
 const stop=()=>{++generation;cleanupLoad();cleanupLoad=()=>{};visibility?.dispose();visibility=undefined;worker?.destroy();worker=undefined;container?.remove();container=undefined;ready=false;clear();};
 function paint(){
  const value=latest;if(closed||!ready||!worker||!value?.settings.onionEnabled)return;
  const poses=onionSkinSamples(value.frame,profile.frameCount,value.loop,value.settings).filter(p=>p.opacity>0);
  const selectionKey=JSON.stringify(value.selected),key=JSON.stringify([poses,value.hidden,value.selected]);if(key===lastKey)return;
  const now=performance.now();if(value.playing&&lastKey&&selectionKey===lastSelection&&now-lastPaint<50)return;
  const svg=target.querySelector('svg'),camera=svg?.querySelector('[data-lottie-view-transform]')??svg;
  const original=container?.querySelector('svg');if(!svg||!camera||!original)return;
  const next=doc.createElementNS(ns,'g');next.setAttribute('data-lottie-onion-skin','');next.setAttribute('pointer-events','none');next.setAttribute('aria-hidden','true');next.style.pointerEvents='none';
  const rendered:LottieOnionPose[]=[];
  for(const pose of poses){
   worker.goToAndStop(pose.frame,true);visibility?.update(value.hidden);
   const ghost=doc.createElementNS(ns,'g'),idPrefix=prefix+pose.frame+'-';
   const projected=(worker as unknown as {renderer:OnionLayerProjection}).renderer;
   cloneOnionPaint(original,ghost,mainRenderer&&!value.selected.length?underlays.flatMap(i=>{const e=projected.elements?.[i];const paint=e?.baseElement??e?.layerElement;return paint?[paint]:[];}):[],value.selected.length?onionSelectedPaint(projected,nodes,value.selected,value.hidden):undefined);
   const ids=new Map<string,string>();for(const e of Array.from(ghost.querySelectorAll('[id]'))){const old=e.id;ids.set(old,idPrefix+old);e.id=idPrefix+old;}
   for(const e of [ghost,...Array.from(ghost.querySelectorAll('*'))])for(const a of Array.from(e.attributes)){
    let text=a.value.replace(/url\((['"]?)#([^)'"\s]+)\1\)/g,(all,quote,id)=>ids.has(id)?'url(#'+ids.get(id)+')':all);
    if((a.localName==='href')&&text.startsWith('#')&&ids.has(text.slice(1)))text='#'+ids.get(text.slice(1));
    if(text!==a.value)e.setAttributeNS(a.namespaceURI,a.name,text);
   }
   const filter=doc.createElementNS(ns,'filter'),matrix=doc.createElementNS(ns,'feColorMatrix'),color=onionColors[pose.direction],rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
   filter.id=idPrefix+'tint';filter.setAttribute('x','-100%');filter.setAttribute('y','-100%');filter.setAttribute('width','300%');filter.setAttribute('height','300%');filter.setAttribute('color-interpolation-filters','sRGB');
   matrix.setAttribute('type','matrix');matrix.setAttribute('values',`0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} 0 0 0 1 0`);filter.append(matrix);
   const defs=doc.createElementNS(ns,'defs');defs.append(filter);next.append(defs);
   ghost.setAttribute('filter','url(#'+filter.id+')');ghost.setAttribute('opacity',String(pose.opacity));ghost.setAttribute('data-onion-frame',String(pose.frame));ghost.setAttribute('data-onion-direction',pose.direction);ghost.style.pointerEvents='none';next.append(ghost);
   rendered.push({...pose,timeSeconds:pose.frame/profile.frameRate,color});
  }
  layer?.remove();mountOnionPaint(camera,next,underlays,mainRenderer);layer=next;lastKey=key;lastSelection=selectionKey;lastPaint=now;
  publish({sourceId:source.id,revision:source.revision,poses:rendered});
 }
 function fail(){stop();failedState=true;target.setAttribute('data-lottie-onion-error','Rendu auxiliaire indisponible');failureMessage=doc.createElement('p');failureMessage.setAttribute('role','status');failureMessage.textContent='Peau d’oignon indisponible. Désactivez puis réactivez Oignon pour réessayer.';failureMessage.style.cssText='position:absolute;bottom:0;left:1rem;color:#ffb4a9;pointer-events:none';target.append(failureMessage);}
 function start(){
  const ticket=++generation;container=doc.createElement('div');container.setAttribute('data-lottie-onion-worker','');container.setAttribute('aria-hidden','true');container.style.cssText='position:absolute;inset:0;opacity:0;pointer-events:none';target.append(container);
  worker=player.loadAnimation({container,renderer:'svg',loop:false,autoplay:false,animationData:structuredClone(source.data),rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:false,runExpressions:false} as SVGRendererConfig});
  const current=worker;
  const loaded=()=>{if(closed||ticket!==generation)return;cleanupLoad();cleanupLoad=()=>{};ready=true;visibility=createLottieVisibility((current as unknown as {renderer:Parameters<typeof createLottieVisibility>[0]}).renderer,nodes);paint();};
  const failed=()=>{if(ticket===generation)fail();};
  const timer=setTimeout(failed,10000);cleanupLoad=()=>{clearTimeout(timer);current.removeEventListener('DOMLoaded',loaded);current.removeEventListener('data_failed',failed);};
  current.addEventListener('DOMLoaded',loaded);current.addEventListener('data_failed',failed);if(current.isLoaded)loaded();
 }
 return {update(frame:number,loop:boolean,playing:boolean,settings:LottieOnionSettings,hidden:readonly string[],selected:readonly string[]=[]){
  latest={frame,loop,playing,settings,hidden:[...hidden],selected:[...selected]};if(closed)return;
  if(!settings.onionEnabled){if(worker||layer)stop();failedState=false;failureMessage?.remove();failureMessage=undefined;target.removeAttribute('data-lottie-onion-error');return;}if(failedState)return;try{if(!worker)start();else paint();}catch{fail();}
 },dispose(){if(closed)return;closed=true;stop();failureMessage?.remove();target.removeAttribute('data-lottie-onion-error');}};
}
