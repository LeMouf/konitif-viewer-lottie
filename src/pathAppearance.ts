import {normalizeLottieOnionSettings,defaultLottieOnionSettings,type LottieOnionSettings} from './onionSkinPolicy.js';
export interface LottiePathAppearance extends LottieOnionSettings {trajectoryEnabled:boolean;color:string;opacity:number;width:number;handles:boolean;colorMode:'uniform'|'type';cropViewport:boolean;rulers:boolean;grid:boolean;axes:boolean;}
export const defaultLottiePathAppearance:Readonly<LottiePathAppearance>=Object.freeze({...defaultLottieOnionSettings,trajectoryEnabled:false,color:'#95afbd',opacity:.65,width:.85,handles:false,cropViewport:true,rulers:false,grid:false,axes:false,colorMode:'uniform'});
export function normalizeLottiePathAppearance(value:Partial<LottiePathAppearance>,previous:Readonly<LottiePathAppearance>=defaultLottiePathAppearance):LottiePathAppearance{
 const bound=(v:unknown,min:number,max:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
 return {...normalizeLottieOnionSettings(value,previous),trajectoryEnabled:typeof value.trajectoryEnabled==='boolean'?value.trajectoryEnabled:previous.trajectoryEnabled??false,rulers:typeof value.rulers==='boolean'?value.rulers:previous.rulers,grid:typeof value.grid==='boolean'?value.grid:previous.grid,axes:typeof value.axes==='boolean'?value.axes:previous.axes,cropViewport:typeof value.cropViewport==='boolean'?value.cropViewport:previous.cropViewport,colorMode:value.colorMode==='type'||value.colorMode==='uniform'?value.colorMode:previous.colorMode,color:typeof value.color==='string'&&/^#[0-9a-f]{6}$/i.test(value.color)?value.color.toLowerCase():previous.color,
 opacity:bound(value.opacity,0,1,previous.opacity),width:bound(value.width,.25,2.5,previous.width),handles:typeof value.handles==='boolean'?value.handles:previous.handles};
}
export type LottiePathSettingsMount=(target:HTMLElement,port:{section?:'paths'|'onion';read():Readonly<LottiePathAppearance>;update(patch:Partial<LottiePathAppearance>):void})=>{dispose():void;refresh?():void};

export interface LottiePathView {showPaths:boolean;appearance:LottiePathAppearance;}
export interface LottiePathViewPort {read():LottiePathView;write(value:LottiePathView):void;subscribe(listener:()=>void):()=>void;}
export function normalizeLottiePathView(value:unknown):LottiePathView{
 const input=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const appearance=input.appearance&&typeof input.appearance==='object'&&!Array.isArray(input.appearance)?input.appearance:{};
 return{showPaths:input.showPaths===true,appearance:normalizeLottiePathAppearance(appearance)};
}
