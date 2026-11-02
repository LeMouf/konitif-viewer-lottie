import {editVectorTangent} from './vectorTangent.js';
import {readLottieSourceProfile as profileForSource} from './sourceProfile.js';
import {gradientColorState,createGradientColorKey,writeGradientColor,mapGradientChannels} from './gradientEditing.js';
import {resolveLottieStyle,editLottieStyle,lottieStyleColorScale,lottieStyleGradientAxis,appendLottieStyleStroke} from './styleEditing.js';

import { appendLottieBezier, defaultLottiePenStyle, validateLottiePenStyle, indexLottiePaths, moveNumericKeys, moveNumericKey, numericPropertyState, writeNumericProperty, insertNumericKey, setNumericKeyLinear, removeNumericKeys, setNumericKeyInterpolation, type LottieSource, type LottieReading, type LottieEditingPort, type LottiePenState } from './index.js';
import {projectLottieSourceProperties as projectLottieTimeline} from './sourceProperties.js';
import type {LottieEditingHistory} from './editingHistory.js';
type R=Record<string,any>;
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
export function readLottiePointer(data:R,pointer:string):any {return pointer.split('/').slice(1).reduce((v,key)=>v?.[key.replaceAll('~1','/').replaceAll('~0','~')],data);}
/** User edits of animated values upsert a key, still inside one host transaction. */
function writeAtFrame(property:R,frame:number,value:readonly number[],range?:{start:number;end:number},animateStatic=false){
 const state=numericPropertyState(property,frame);
 return writeNumericProperty((animateStatic&&state.staticValue)||(!state.staticValue&&state.index<0)?insertNumericKey(property,frame,range):property,frame,value);
}
function animateRelatedTransform(property:{pointer:string;ownerId:string},tracks:ReturnType<typeof lottieNumericTracks>){
 const transform=(pointer:string)=>['p','a','s','r','rz'].includes(pointer.split('/').at(-1)!);
 return transform(property.pointer)&&tracks.some(track=>track.ownerId===property.ownerId&&!track.staticValue&&transform(track.pointer));
}
function replacePointer(data:R,pointer:string,value:unknown){const next=clone(data),parts=pointer.split('/').slice(1).map(k=>k.replaceAll('~1','/').replaceAll('~0','~')),last=parts.pop()!;let parent=next;for(const p of parts)parent=parent[p];parent[last]=value;return next;}
const projections=new WeakMap<LottieSource,ReturnType<typeof projectLottieTimeline>>();
type NumericKeyTarget={pointer:string;frame:number;trackSuffix:string;keyIndex?:number};
const numericCache=new WeakMap<LottieSource,{time:number;tracks:Map<string,ReturnType<typeof computeNumericTracks>>}>();
const keyTrackCache=new WeakMap<LottieSource,{time:number;tracks:ReturnType<typeof computeNumericTracks>}>();

export function lottieNumericTracks(reading:LottieReading,target?:NumericKeyTarget){
 if(!reading.source)return [];
 const targetKey=target?JSON.stringify(target):'';
 let cached=numericCache.get(reading.source);if(cached?.time!==reading.timeSeconds){cached={time:reading.timeSeconds,tracks:new Map()};numericCache.set(reading.source,cached);}const prior=cached.tracks.get(targetKey);if(prior)return prior;
 let projection=projections.get(reading.source);if(!projection){projection=projectLottieTimeline(reading.source,{includeStatic:true});projections.set(reading.source,projection);}
 const result=computeNumericTracks(projection,reading,target);if(cached.tracks.size>=4)cached.tracks.delete(cached.tracks.keys().next().value!);cached.tracks.set(targetKey,result);return result;
}
export function lottieKeyTracks(reading:LottieReading){
 if(!reading.source)return [];const cached=keyTrackCache.get(reading.source);if(cached?.time===reading.timeSeconds)return cached.tracks;let projection=projections.get(reading.source);if(!projection){projection=projectLottieTimeline(reading.source,{includeStatic:true});projections.set(reading.source,projection);}const tracks=[...lottieNumericTracks(reading),...computeNumericTracks(projection,reading,undefined,true)];keyTrackCache.set(reading.source,{time:reading.timeSeconds,tracks});return tracks;
}
function keyOperation(property:R,pointer:string,operation:(property:R)=>R){return pointer.endsWith('/g/k')?mapGradientChannels(property,operation):operation(property);}
const preparedSources=new WeakMap<LottieSource,ReturnType<typeof prepareNumericTracks>>();
function prepareNumericTracks(projection:ReturnType<typeof projectLottieTimeline>,source:LottieSource){
 const prefix=JSON.stringify([source.id,source.revision]),version=String(source.data.v??'').split('.').map(Number),legacyColors=version[0]<4||(version[0]===4&&(version[1]<1||(version[1]===1&&version[2]<9)));
 return projection.tracks.flatMap(track=>{
  const map=track.metadata?.timeMapping as {scale:number;offset:number;rootInFrame:number;fps:number}|null;if(!map?.scale)return [];
  const pointer=track.source!.pointer,property=readLottiePointer(source.data,pointer),active=track.metadata?.visibleRootFrames as {start:number;end:number},ends=[(active.start-map.offset)/map.scale,(active.end-map.offset)/map.scale];
  const token=pointer.split('/').at(-1),unit=track.label.includes('Opacité')||track.label.includes('Échelle')?'%':track.label.includes('Rotation')?'°':track.label==='Couleur'?(legacyColors?'0–255':'0–1'):['Position','Ancrage','Dimensions','Largeur','Arrondi'].includes(track.label)?'px':'';
  const min=track.label==='Couleur'||track.label.includes('Opacité')||['Dimensions','Largeur','Arrondi'].includes(track.label)?0:undefined,max=track.label==='Couleur'?(legacyColors?255:1):track.label.includes('Opacité')?100:undefined;
  return [{track,map,pointer,property,token,unit,min,max,suffix:track.id.slice(prefix.length),gradient:pointer.endsWith('/g/k'),range:{start:Math.min(...ends),end:Math.max(...ends)},staticState:property?.a!==1?numericPropertyState(property,0):undefined}];
 });
}
function computeNumericTracks(projection:ReturnType<typeof projectLottieTimeline>,reading:LottieReading,target?:NumericKeyTarget,includeGradient=false){
 const source=reading.source!,profile=profileForSource(source);let prepared=preparedSources.get(source);if(!prepared){prepared=prepareNumericTracks(projection,source);preparedSources.set(source,prepared);}
 return prepared.flatMap(item=>{
  const {track,map,pointer,property,range,token,unit,min,max}=item;if(includeGradient&&!item.gradient)return [];
  const targeted=target?.pointer===pointer&&target.trackSuffix===item.suffix;
  const rootFrame=map.rootInFrame+Math.min(profile.frameCount-1,Math.max(0,reading.timeSeconds*map.fps)),targetFrame=target?.keyIndex===undefined?target?.frame:property?.k?.[target.keyIndex]?.t,frame=targeted?(Number.isFinite(targetFrame)?Number(targetFrame):target!.frame):(rootFrame-map.offset)/map.scale;
  const state=includeGradient?gradientColorState(property,frame):item.staticState?{...item.staticState}:numericPropertyState(property,frame);
  if(!state.value)return [];
  if(targeted){state.canCreate=false;state.reason=state.index>=0?`Clé source · image locale ${frame}${frame>=range.end||frame<range.start?' · hors lecture active':''}`:'Fin de segment sans valeur autonome · modifier la clé précédente.';}
  else if(frame<range.start||frame>=range.end){state.editable=false;state.canCreate=false;state.reason='Hors de la plage active de cet élément.';}
  if(!state.staticValue&&state.canCreate){state.editable=true;state.reason='Une clé sera créée à cet instant lors de la validation.';}
  const axes=state.value.length===1?['Valeur']:token==='c'?['R','V','B','A'].slice(0,state.value.length):['X','Y','Z','W'].slice(0,state.value.length);
  return [{range,unit,min,max,id:track.id,pointer,ownerId:track.source!.ownerId,label:track.label,frame,axes,...state}];
 });
}
/** Document authority remains in the host. Both surfaces borrow this command port. */
export function createLottieEditing(input:{history:LottieEditingHistory;read():LottieReading;replace(source:LottieSource):void;notify():void;persist?(source:LottieSource):void;select?(id:string):void}){
 let mode:'inspect'|'move'|'rotate'|'scale'|'pivot'|'pen'='inspect',message='',sequence=0,disposed=false;
 let pen:LottiePenState={vertices:[],style:{...defaultLottiePenStyle}};
 let target:NumericKeyTarget|undefined;
 let preview:{source:LottieSource;pointer:string;frame:number;time:number;min?:number;max?:number;range:{start:number;end:number};animateStatic:boolean}|null=null;
 const history=input.history;
 function publish(source:LottieSource){input.replace(source);try{input.persist?.(source);}catch(e){message='Composition modifiée mais sauvegarde locale impossible : '+String(e);}input.notify();}
 function commit(data:R){const source=input.read().source!;if(JSON.stringify(data)===JSON.stringify(source.data))return;const next={...source,revision:source.revision+':edit:'+(++sequence),data};profileForSource(next);history.beginTransaction('core',source);history.commitTransaction('core',next);message='';publish(next);}
 function cancelPreview(){if(!preview)return;const original=history.cancelTransaction('core')??preview.source;preview=null;input.replace(original);input.notify();}
 function validate(value:readonly number[],min?:number,max?:number){if(value.some(v=>!Number.isFinite(v)||v<(min??-Infinity)||v>(max??Infinity)))throw new Error('Valeur hors des limites de cette propriété.');}
 function gradientContext(reading:LottieReading,id:string){if(!reading.source)return null;const style=resolveLottieStyle(reading.source,id);if(!style||!['gf','gs'].includes(style.value.ty))return null;const track=lottieNumericTracks(reading).find(t=>t.ownerId===style.node.id);if(!track)return null;const state=gradientColorState(style.value.g.k,track.frame),active=track.frame>=track.range.start&&track.frame<track.range.end;return {style,track,state,active};}
 const port:LottieEditingPort={
  read(options){const reading=input.read(),status=history.getStatus().core;return {mode,message,pen:clone(pen),gradient:(()=>{const context=reading.selectedIds.length===1?gradientContext(reading,reading.selectedIds[0]):null;return context?{id:context.style.node.id,frame:context.track.frame,value:context.state.value,staticValue:context.state.staticValue,editable:context.active&&(context.state.editable||context.state.canCreate),canCreate:context.active&&context.state.canCreate,reason:context.state.reason}:undefined;})(),canUndo:!preview&&(status.canUndo||pen.vertices.length>0),canRedo:!preview&&!pen.vertices.length&&status.canRedo,properties:lottieNumericTracks(reading,options?.atCurrentTime?undefined:target)};},
  dispatch(command){if(disposed)return;try{
   if(command.type==='pen-cancel'){pen={...pen,vertices:[]};message='';input.notify();return;}
   if(command.type==='pen-style'){pen={...pen,style:validateLottiePenStyle(command.style)};input.notify();return;}
   if(command.type==='target-key'){
    cancelPreview();const reading=input.read(),property=reading.source&&readLottiePointer(reading.source.data,command.pointer);
    if(!Number.isFinite(command.frame)||!Array.isArray(property?.k)||!property.k.some((key:R)=>Math.abs(key.t-command.frame)<1e-7))throw new Error('Clé source introuvable.');
    if(!lottieKeyTracks(reading).some(track=>track.id===command.trackId&&track.pointer===command.pointer))throw new Error('Propriété numérique non admise.');
    target={pointer:command.pointer,frame:command.frame,keyIndex:property.k.findIndex((key:R)=>Math.abs(key.t-command.frame)<1e-7),trackSuffix:command.trackId.slice(JSON.stringify([reading.source!.id,reading.source!.revision]).length)};input.notify();return;
   }
   if(command.type==='cancel-value'){cancelPreview();return;}
   if(preview&&(command.type==='undo'||command.type==='redo'||command.type==='set-mode')){cancelPreview();if(command.type!=='set-mode')return;}
   const reading=input.read();if(command.type==='set-mode'){mode=command.mode;pen={...pen,vertices:[]};target=undefined;input.notify();return;}
   if(!reading.source||reading.loading)throw new Error('Aucune composition prête.');
   if(reading.playing)throw new Error('Mettre la lecture en pause avant de modifier.');
   if(command.type==='undo'&&pen.vertices.length){pen={...pen,vertices:[]};input.notify();return;}
   if(command.type==='pen-add'||command.type==='pen-tangent'||command.type==='pen-finish'){
    if(mode!=='pen')throw new Error('Activer la Plume.');
    if(command.type==='pen-add'){if(command.point.length!==2||command.point.some(n=>!Number.isFinite(n))||pen.vertices.length>=512)throw new Error('Sommet invalide.');pen={...pen,vertices:[...pen.vertices,{point:[...command.point],in:[0,0],out:[0,0]}]};input.notify();return;}
    if(command.type==='pen-tangent'){if(command.out.length!==2||command.out.some(n=>!Number.isFinite(n))||!pen.vertices.length)throw new Error('Tangente invalide.');const vertices=clone(pen.vertices),last=vertices.at(-1)!;Object.assign(last,editVectorTangent(last,'out',command.out,'symmetric'));pen={...pen,vertices};input.notify();return;}
    const created=appendLottieBezier(reading.source.data,pen.vertices,pen.style);commit(created.data);pen={...pen,vertices:[]};target=undefined;const group=indexLottiePaths(input.read().source!).find(n=>n.layerRoute.length===1&&n.layerRoute[0]===created.index&&n.kind==='group');if(group)input.select?.(group.id);input.notify();return;
   }
   if(command.type==='undo'||command.type==='redo'){const restored=history[command.type]('core',reading.source);if(restored){message='';publish(restored);}return;}
   if(command.type==='commit-value'){if(!preview)return;history.commitTransaction('core',reading.source);preview=null;message='';publish(reading.source);return;}
   if(command.type==='preview-value'){
    if(!preview||reading.source.id!==preview.source.id||reading.timeSeconds!==preview.time){cancelPreview();return;}
    validate(command.value,preview.min,preview.max);
    const data=replacePointer(preview.source.data,preview.pointer,writeAtFrame(readLottiePointer(preview.source.data,preview.pointer),preview.frame,command.value,preview.range,preview.animateStatic));
    input.replace({...preview.source,revision:preview.source.revision+':preview:'+(++sequence),data});input.notify();return;
   }
   if(command.type==='gradient-color-key'){
    if(preview)throw Error('Terminer le geste avant d’ajouter une clé de dégradé.');const context=gradientContext(reading,command.id);if(!context?.active||!context.state.canCreate)throw Error(context?.state.reason||'Clé de dégradé non admise.');
    commit(replacePointer(reading.source.data,context.style.pointer+'/g/k',createGradientColorKey(context.style.value.g.k,context.track.frame,context.track.range)));return;
   }
   if(command.type==='style-fit-gradient'){
    if(preview)throw Error('Terminer le geste avant de recadrer le dégradé.');
    const style=resolveLottieStyle(reading.source,command.id);if(!style||!['gf','gs'].includes(style.value.ty))throw Error('Dégradé source introuvable.');
    const tracks=lottieNumericTracks(reading),start=tracks.find(t=>t.ownerId===style.node.id&&t.pointer===style.pointer+'/s'),end=tracks.find(t=>t.ownerId===style.node.id&&t.pointer===style.pointer+'/e');if(!start?.editable||!end?.editable)throw Error('Extrémités non éditables à cet instant.');
    const axis=lottieStyleGradientAxis(style.siblings,start.frame);let data=replacePointer(reading.source.data,start.pointer,writeAtFrame(style.value.s,start.frame,axis.start,start.range));data=replacePointer(data,end.pointer,writeAtFrame(style.value.e,end.frame,axis.end,end.range));commit(data);return;
   }
   if(command.type==='style-add-stroke'){
    if(preview)throw Error('Terminer le geste avant d’ajouter le contour.');
    const style=resolveLottieStyle(reading.source,command.id);if(!style)throw Error('Style source introuvable.');
    const created=appendLottieStyleStroke(style.siblings),parent=style.pointer.slice(0,style.pointer.lastIndexOf('/'));
    commit(replacePointer(reading.source.data,parent,created.shapes));
    const next=indexLottiePaths(input.read().source!).find(n=>n.parentId?.slice(JSON.stringify([input.read().source!.id,input.read().source!.revision]).length)===style.node.parentId?.slice(JSON.stringify([reading.source!.id,reading.source!.revision]).length)&&n.shapeRoute.at(-1)===created.index&&n.sourceType==='st');if(next)input.select?.(next.id);input.notify();return;
   }
   if(command.type==='style-options'){
    if(preview)throw Error('Terminer le geste avant de modifier le style.');
    const style=resolveLottieStyle(reading.source,command.id);if(!style)throw Error('Style source introuvable.');
    if(command.change.field==='stop'){
     const context=gradientContext(reading,command.id),change=command.change;if(!context?.active||!context.state.value||!(context.state.editable||context.state.canCreate))throw Error('Couleurs du dégradé non éditables à cet instant.');
     const value=[...context.state.value],offset=change.index*4;if(!Number.isInteger(change.index)||change.index<0||change.index>=style.value.g.p||change.color.length!==3||!Number.isFinite(change.position)||change.position<0||change.position>1||change.index>0&&change.position<value[offset-4]||change.index+1<style.value.g.p&&change.position>value[offset+4])throw Error('Point ou ordre de dégradé invalide.');value.splice(offset,4,change.position,...change.color);
     commit(replacePointer(reading.source.data,style.pointer+'/g/k',writeGradientColor(style.value.g.k,context.track.frame,value,context.track.range)));return;
    }
    commit(replacePointer(reading.source.data,style.pointer,editLottieStyle(style.value,command.change,lottieStyleColorScale(reading.source),lottieStyleGradientAxis(style.siblings,lottieNumericTracks(reading).find(t=>t.ownerId===style.node.id)?.frame??0))));return;
   }
   if(command.type==='set-interpolation'){
    if(preview)throw new Error('Terminer le geste numérique avant de modifier la transition.');
    const track=lottieKeyTracks(reading).find(t=>t.id===command.trackId&&t.pointer===command.pointer);
    if(!track)throw new Error('Transition numérique source introuvable.');
    commit(replacePointer(reading.source.data,track.pointer,keyOperation(readLottiePointer(reading.source.data,track.pointer),track.pointer,p=>setNumericKeyInterpolation(p,command.frame,command.mode))));return;
   }
   if(command.type==='move-keys'){
    if(preview||!command.keys.length)throw Error('Terminer le geste avant le déplacement groupé.');
    const tracks=lottieKeyTracks(reading),groups=new Map<string,{moves:{frame:number;nextFrame:number}[];range:{start:number;end:number}}>();
    for(const ref of command.keys){const track=tracks.find(t=>t.id===ref.trackId&&t.pointer===ref.pointer);if(!track)throw Error('Clé numérique source introuvable.');
     const group=groups.get(ref.pointer)??{moves:[],range:{...track.range}},duplicate=group.moves.find(move=>Math.abs(move.frame-ref.frame)<1e-7);
     if(duplicate&&Math.abs(duplicate.nextFrame-ref.nextFrame)>1e-7)throw Error('Déplacements incompatibles de la même clé source.');
     if(!duplicate)group.moves.push({frame:ref.frame,nextFrame:ref.nextFrame});
     group.range.start=Math.max(group.range.start,track.range.start);group.range.end=Math.min(group.range.end,track.range.end);groups.set(ref.pointer,group);
    }
    let data=reading.source.data;for(const [pointer,group]of groups)data=replacePointer(data,pointer,keyOperation(readLottiePointer(reading.source.data,pointer),pointer,p=>moveNumericKeys(p,group.moves,group.range)));
    target=undefined;commit(data);return;
   }
   if(command.type==='move-key'){
    if(preview)throw new Error('Terminer le geste numérique avant le déplacement de clé.');
    const property=lottieKeyTracks(reading).find(t=>t.id===command.trackId&&t.pointer===command.pointer);
    if(!property)throw new Error('Clé numérique source introuvable.');
    const data=replacePointer(reading.source.data,property.pointer,keyOperation(readLottiePointer(reading.source.data,property.pointer),property.pointer,p=>moveNumericKey(p,command.frame,command.nextFrame,property.range)));target=undefined;commit(data);return;
   }
   if(command.type==='delete-keys'){
    if(preview)throw new Error('Terminer le geste numérique avant une suppression.');
    const tracks=lottieKeyTracks(reading),groups=new Map<string,{frame:number;frames:number[]}>();
    for(const ref of command.keys){
     const track=tracks.find(t=>t.id===ref.trackId&&t.pointer===ref.pointer);
     if(!track)throw new Error('Suppression réservée aux clés de propriétés numériques.');
     const group=groups.get(ref.pointer)??{frame:track.frame,frames:[]};group.frames.push(ref.frame);groups.set(ref.pointer,group);
    }
    let data=reading.source.data;
    for(const [pointer,group] of groups)data=replacePointer(data,pointer,keyOperation(readLottiePointer(data,pointer),pointer,p=>removeNumericKeys(p,group.frames,group.frame)));
    target=undefined;commit(data);return;
   }
   if(command.type==='transform'){
    if(preview)throw new Error('Terminer le geste numérique avant une transformation.');
    const tracks=lottieNumericTracks(reading),entries=Object.entries(command.values);
    if(!entries.length||entries.some(([key])=>!['p','a','s','r'].includes(key)))throw new Error('Transformation invalide.');
    let data=reading.source.data;
    for(const [key,value] of entries){const property=tracks.find(t=>t.ownerId===command.id&&t.pointer.endsWith('/'+key));
     if(!property?.editable||!value||value.length!==property.value!.length)throw new Error(property?.reason||'Transformation non éditable à cet instant.');
     validate(value,property.min,property.max);data=replacePointer(data,property.pointer,writeAtFrame(readLottiePointer(data,property.pointer),property.frame,value,property.range,animateRelatedTransform(property,tracks)));
    }
    target=undefined;commit(data);return;
   }
   const tracks=lottieNumericTracks(reading,command.type==='translate'&&command.atCurrentTime?undefined:target);
   if(command.type==='begin-value'){
    if(preview)throw new Error('Un geste numérique est déjà en cours.');
    const property=tracks.find(t=>t.pointer===command.pointer&&t.id===command.trackId);if(!property?.editable)throw new Error(property?.reason||'Propriété non éditable.');
    preview={source:reading.source,pointer:property.pointer,frame:property.frame,time:reading.timeSeconds,min:property.min,max:property.max,range:property.range,animateStatic:animateRelatedTransform(property,tracks)};history.beginTransaction('core',reading.source);message='';return;
   }
   if(preview)throw new Error('Terminer le geste numérique avant une autre modification.');
   if(command.type==='translate'){
    const property=tracks.find(t=>t.ownerId===command.id&&t.pointer.endsWith('/p'));
    if(!property||!property.editable||property.value!.length<2)throw new Error(property?.reason||'Sélectionner un calque ou groupe ayant une position éditable.');
    const value=[...property.value!];value[0]+=command.dx;value[1]+=command.dy;
    commit(replacePointer(reading.source.data,property.pointer,writeAtFrame(readLottiePointer(reading.source.data,property.pointer),property.frame,value,property.range,animateRelatedTransform(property,tracks))));return;
   }
   const track=tracks.find(t=>t.pointer===command.pointer&&t.id===command.trackId);if(!track)throw new Error('Référence de propriété périmée.');
   if(command.type==='set-value'&&!track.editable||command.type==='create-key'&&!track.canCreate)throw new Error(track.reason||'Écriture non admise à cet instant.');
   const property=readLottiePointer(reading.source.data,track.pointer);
   if(command.type==='set-value'){
    validate(command.value,track.min,track.max);
   }
   if(command.type==='linear-key'){
    if(!track.editable||!track.canLinearize)throw new Error('Sélectionner une clé ayant un segment suivant non linéaire.');
    commit(replacePointer(reading.source.data,track.pointer,setNumericKeyLinear(property,track.frame)));return;
   }
   const next=command.type==='create-key'?insertNumericKey(property,track.frame,track.range):writeAtFrame(property,track.frame,command.value,track.range,animateRelatedTransform(track,tracks));
   commit(replacePointer(reading.source.data,track.pointer,next));
  }catch(e){if(command.type==='preview-value')cancelPreview();message=e instanceof Error?e.message:String(e);input.notify();}},
  exportJSON(){const source=input.read().source;if(!source)throw new Error('Aucune composition.');return JSON.stringify(source.data,null,2);}
 };
 return {port,cancelPreview,dispose(){if(disposed)return;cancelPreview();disposed=true;history.reset();},cancelDrawing(){if(pen.vertices.length){pen={...pen,vertices:[]};input.notify();}},clearKeyTarget(){target=undefined;},reset(){target=undefined;pen={vertices:[],style:{...defaultLottiePenStyle}};cancelPreview();history.reset();message='';mode='inspect';}};
}

export type {LottieEditingHistory} from './editingHistory.js';
export {projectLottieSourceProperties} from './sourceProperties.js';
export type {LottieSourcePropertyTrack,LottieSourceInspectionKey} from './sourceProperties.js';
