export interface LottieOnionSettings {
  onionEnabled:boolean;
  onionBefore:number;
  onionAfter:number;
  onionStep:number;
  onionOpacity:number;
  onionOpacityDecay:number;
}
export const defaultLottieOnionSettings:Readonly<LottieOnionSettings>=Object.freeze({
  onionEnabled:false,onionBefore:2,onionAfter:2,onionStep:1,onionOpacity:.25,onionOpacityDecay:.6
});
export function normalizeLottieOnionSettings(value:Partial<LottieOnionSettings>,previous:Readonly<LottieOnionSettings>=defaultLottieOnionSettings):LottieOnionSettings {
  previous={...defaultLottieOnionSettings,...previous};
  const bounded=(v:unknown,min:number,max:number,fallback:number,integer=false)=>typeof v==='number'&&Number.isFinite(v)?(integer?Math.round(Math.max(min,Math.min(max,v))):Math.max(min,Math.min(max,v))):fallback;
  return {onionEnabled:typeof value.onionEnabled==='boolean'?value.onionEnabled:previous.onionEnabled,
    onionBefore:bounded(value.onionBefore,0,4,previous.onionBefore,true),onionAfter:bounded(value.onionAfter,0,4,previous.onionAfter,true),
    onionStep:bounded(value.onionStep,1,60,previous.onionStep,true),onionOpacity:bounded(value.onionOpacity,0,.6,previous.onionOpacity),onionOpacityDecay:bounded(value.onionOpacityDecay,0,1,previous.onionOpacityDecay)};
}
/** Integer source-frame samples only. Never evaluate the exclusive out-point. */
export function onionSkinSamples(frame:number,frameCount:number,loop:boolean,settings:Readonly<LottieOnionSettings>) {
  const values:{frame:number;direction:'past'|'future';distance:number;opacity:number}[]=[];
  if(!settings.onionEnabled||!Number.isFinite(frame)||!Number.isInteger(frameCount)||frameCount<1)return values;
  const current=Math.max(0,Math.min(frameCount-1,Math.floor(frame))),seen=new Set([current]);
  for(let distance=1;distance<=Math.max(settings.onionBefore,settings.onionAfter);distance++){
    for(const direction of ['past','future'] as const){
      if(distance>(direction==='past'?settings.onionBefore:settings.onionAfter))continue;
      let sample=current+(direction==='past'?-1:1)*distance*settings.onionStep;
      if(loop)sample=((sample%frameCount)+frameCount)%frameCount;
      if(sample<0||sample>=frameCount||seen.has(sample))continue;
      seen.add(sample);values.push({frame:sample,direction,distance,opacity:settings.onionOpacity*Math.pow(settings.onionOpacityDecay,distance-1)});
    }
  }
  return values.sort((a,b)=>b.distance-a.distance);
}
