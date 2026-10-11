import type {LottieStyleSubjects} from './lineageTypes.js';
import type {LottiePathAppearance} from './pathAppearance.js';
import type {LottiePathNode} from './paths.js';
import {inspectProjectedConstruction} from './projectedGeometry.js';
export const lottiePathTypes={
 'line-open':{label:'Ligne ouverte',color:'#56b4e9'},'line-closed':{label:'Lignes fermées',color:'#0072b2'},
 'bezier-open':{label:'Bézier ouvert',color:'#e69f00'},'bezier-closed':{label:'Bézier fermé',color:'#cc79a7'},
 ellipse:{label:'Ellipse',color:'#009e73'},rectangle:{label:'Rectangle',color:'#f0e442'},star:{label:'Étoile / polygone',color:'#d55e00'},
 'masked-solid':{label:'Solide avec masque',color:'#aa8dff'},solid:{label:'Solide',color:'#aab3bf'},path:{label:'Tracé non classé',color:'#ffffff'}
} as const;
export type LottiePathType=keyof typeof lottiePathTypes;
export const lottieNeutralColor='#aab3bf';
export function lottieTypeColor(type:LottiePathType,appearance:Pick<LottiePathAppearance,'colorMode'|'color'>):string{return appearance.colorMode==='type'?lottiePathTypes[type].color:appearance.color;}

/** Mask/solid identity takes precedence, then parametric source type, then evaluated segments. */
export function classifyLottiePath(node:Pick<LottiePathNode,'kind'|'sourceType'|'solid'|'sourcePathType'|'sourceClosed'>,d?:string):LottiePathType{
 if(node.kind==='mask'||node.solid==='single-additive')return 'masked-solid';
 if(node.solid)return 'solid';
 if(node.sourceType==='el')return 'ellipse';if(node.sourceType==='rc')return 'rectangle';if(node.sourceType==='sr')return 'star';
 if(d)try{
  const {segments}=inspectProjectedConstruction(d);if(!segments.length)return 'path';
  // A projected contribution may contain several subpaths. Every subpath must close.
  const parts=d.split(/(?=M)/).filter(s=>s.trim());
  const closed=node.sourceClosed??parts.every(part=>{const {segments:s}=inspectProjectedConstruction(part);return s.length>0&&Math.hypot(s[0].from.x-s[s.length-1].to.x,s[0].from.y-s[s.length-1].to.y)<1e-6;});
  return `${segments.every(s=>s.straight)?'line':'bezier'}-${closed?'closed':'open'}` as LottiePathType;
 }catch{return 'path';}
 return node.sourcePathType??'path';
}
/** Static source paths can share precise textual labels with the evaluated palette.
 * Animated paths stay explicitly labelled animated in the tree; their color follows the evaluated frame. */
export function classifyStaticSourcePath(shape:unknown):LottiePathType|undefined{
 const s=shape as {v?:number[][];i?:number[][];o?:number[][];c?:boolean}|null;
 if(!s||!Array.isArray(s.v)||!s.v.length||!Array.isArray(s.i)||!Array.isArray(s.o))return undefined;
 if(![s.v,s.i,s.o].every(a=>a.length===s.v!.length&&a.every(p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite))))return undefined;
 const v=s.v,i=s.i,o=s.o;let d=`M${v[0][0]},${v[0][1]}`;
 for(let n=0;n<v.length-(s.c?0:1);n++){const next=(n+1)%v.length;d+=`C${v[n][0]+o[n][0]},${v[n][1]+o[n][1]} ${v[next][0]+i[next][0]},${v[next][1]+i[next][1]} ${v[next][0]},${v[next][1]}`;}
 if(s.c)d+='Z';return classifyLottiePath({kind:'path',sourceClosed:!!s.c},d);
}

export function sourcePathClosure(property:unknown):boolean|undefined{
 const k=(property as {k?:unknown}|undefined)?.k;
 const shapes=Array.isArray(k)?k.flatMap(frame=>[...(Array.isArray(frame?.s)?frame.s:[]),...(Array.isArray(frame?.e)?frame.e:[])]):[k];
 const values=shapes.filter(s=>s&&typeof s==='object'&&'c' in s).map(s=>s.c);
 return values.length&&values.every(c=>c===true)?true:values.length&&values.every(c=>c===false)?false:undefined;
}

/** Ephemeral renderer observation, keyed by source occurrence IDs. Never persisted. */
export interface LottiePathTypeObservation {
 read():Readonly<Record<string,LottiePathType>>;
 readInfluences():LottieStyleSubjects;
 publish(types:Readonly<Record<string,LottiePathType>>,influences?:LottieStyleSubjects):void;
 subscribe(listener:()=>void):()=>void;
}
export function createLottiePathTypeObservation():LottiePathTypeObservation {
 let current:Readonly<Record<string,LottiePathType>>=Object.freeze({}),subjects:LottieStyleSubjects=Object.freeze({}),key='[{},{}]';
 const listeners=new Set<()=>void>();
 return {read:()=>current,readInfluences:()=>subjects,publish(types,influences={}){const next=JSON.stringify([types,influences]);if(next===key)return;key=next;current=Object.freeze({...types});subjects=Object.freeze(Object.fromEntries(Object.entries(influences).map(([id,ids])=>[id,Object.freeze([...ids])])));for(const listener of listeners)listener();},subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};}};
}
