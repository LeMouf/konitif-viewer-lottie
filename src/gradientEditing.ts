import {numericPropertyState,insertNumericKey,writeNumericProperty} from './index.js';
type R=Record<string,any>;const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const vector=(v:any):v is number[]=>Array.isArray(v)&&v.length>0&&v.length<=1024&&v.every(n=>Number.isFinite(n));
const component=(v:any,index:number)=>Array.isArray(v)?v[index]??v[0]:v;
function channels(property:R){
 const value=property?.a===1?property.k?.find((key:R)=>vector(key.s))?.s:property?.k;if(!vector(value))throw Error('Couleurs du dégradé non numériques.');
 return value.map((_,index)=>({...clone(property),k:property.a===1?property.k.map((key:R)=>({...clone(key),...(vector(key.s)?{s:[key.s[index]]}:{}),...(vector(key.e)?{e:[key.e[index]]}:{}),...(key.o?{o:{...key.o,x:[component(key.o.x,index)],y:[component(key.o.y,index)]}}:{}),...(key.i?{i:{...key.i,x:[component(key.i.x,index)],y:[component(key.i.y,index)]}}:{})})):value[index]}));
}
function join(properties:R[]){const first=properties[0],result=clone(first);if(first.a!==1){result.k=properties.map(p=>p.k);return result;}
 result.k=first.k.map((key:R,index:number)=>{const merged=clone(key);for(const token of ['s','e'])if(Array.isArray(key[token]))merged[token]=properties.map(p=>p.k[index][token][0]);for(const token of ['o','i'])if(key[token])merged[token]={...key[token],x:properties.map(p=>component(p.k[index][token].x,0)),y:properties.map(p=>component(p.k[index][token].y,0))};return merged;});return result;
}
const readingChannels=new WeakMap<R,R[]>();
export function gradientColorState(property:R,frame:number){try{let prepared=readingChannels.get(property);if(!prepared){prepared=channels(property);readingChannels.set(property,prepared);}const states=prepared.map(p=>numericPropertyState(p,frame)),first=states[0];return {...first,value:states.every(s=>s.value)?states.map(s=>s.value![0]):null};}catch{return {value:null,staticValue:false,index:-1,editable:false,canCreate:false,reason:'Dégradé non pris en charge.'};}}
export function createGradientColorKey(property:R,frame:number,range:{start:number;end:number}){return join(channels(property).map(p=>insertNumericKey(p,frame,range)));}
export function writeGradientColor(property:R,frame:number,value:readonly number[],range:{start:number;end:number}){
 const props=channels(property);if(props.length!==value.length||value.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('Couleurs de dégradé invalides.');
 return join(props.map((p,index)=>{const state=numericPropertyState(p,frame);return writeNumericProperty(!state.staticValue&&state.index<0?insertNumericKey(p,frame,range):p,frame,[value[index]]);}));
}

/** Reuse the common key operation for every scalar channel of a gradient. */
export function mapGradientChannels(property:R,operation:(channel:R)=>R){return join(channels(property).map(operation));}
