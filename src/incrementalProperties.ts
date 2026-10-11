type R=Record<string,any>;
const record=(v:any):v is R=>!!v&&typeof v==='object'&&!Array.isArray(v);
const vector=(v:any)=>typeof v==='number'&&Number.isFinite(v)||Array.isArray(v)&&v.length>0&&v.length<=1024&&v.every(Number.isFinite);
const shape=(p:R)=>p.a===1?Array.isArray(p.k)&&p.k.length>1&&p.k.every((k:R,i:number)=>record(k)&&Number.isFinite(k.t)&&(!i||k.t>p.k[i-1].t)&&(!k.s||vector(k.s)&&k.s.length===p.k[0].s?.length)&&(!k.e||vector(k.e)&&k.e.length===p.k[0].s?.length)):vector(p.k);
const dimension=(p:R)=>{const v=p.a===1?p.k.find((k:R)=>k.s)?.s:p.k;return typeof v==='number'?1:v?.length;};
/** Pinned player adapter. Admission is complete before any native property changes. */
export function patchNativeNumericProperties(nativeData:R,renderer:R,before:R,after:R):boolean{
 const version=String(before.v??'5.0.0').split('.').map(Number);
 // Older sources are normalized by the player (notably 0–255 colors).
 if(version[0]<4||version[0]===4&&(version[1]<1||version[1]===1&&version[2]<9))return false;
 const changes:{path:string[];property:R}[]=[];
 function diff(a:any,b:any,path:string[]):boolean{
  if(JSON.stringify(a)===JSON.stringify(b))return true;
  if(record(a)&&record(b)&&'k'in a&&'k'in b&&!record(a.k)&&!record(b.k)){
   const {k:ak,...am}=a,{k:bk,...bm}=b;
   if(!shape(a)||!shape(b)||JSON.stringify(am)!==JSON.stringify(bm)||a.a!==b.a||dimension(a)!==dimension(b))return false;
   changes.push({path,property:b});return true;
  }
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>diff(v,b[i],[...path,String(i)]));
  if(record(a)&&record(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>key in b&&diff(a[key],b[key],[...path,key]));}return false;
 }
 if(!diff(before,after,[]))return false;
 const wanted=new Map<R,{property:R;targets:R[]}>();for(const change of changes){const data=change.path.reduce((v,key)=>v?.[key],nativeData);if(!record(data))return false;wanted.set(data,{property:change.property,targets:[]});}
 const visited=new Set<object>();let budget=50000;
 function scan(value:any){if(!value||typeof value!=='object'||visited.has(value)||value.nodeType||--budget<0)return;visited.add(value);
  const entry=wanted.get(value.data);if(entry&&typeof value.getValue==='function'&&typeof value.addEffect==='function'&&typeof value.setVValue==='function')entry.targets.push(value);
  for(const key of Object.keys(value)){if(['data','animationData','globalData','elem','comp','container','parent','document','window'].includes(key))continue;scan(value[key]);}
 }
 scan(renderer);
 if(budget<0||[...wanted.values()].some(entry=>!entry.targets.length||entry.targets.some(p=>!!p.kf!==(entry.property.a===1)||p.effectsSequence.length>(p.kf?1:p.__konitifStaticEffect?1:0))))return false;
 for(const [data,entry]of wanted){data.k=structuredClone(entry.property.k);for(const p of entry.targets){
  if(p.kf){p.keyframes=data.k;p.keyframesMetadata=[];p.frameId=-1;p._caching.lastFrame=-999999;p._caching.lastIndex=0;p._caching._lastKeyframeIndex=-1;}
  else if(!p.__konitifStaticEffect){p.addEffect(()=>p.data.k);p.__konitifStaticEffect=true;}
  p.frameId=-1;p._isFirstFrame=true;
  // SVGShapeElement freezes the static/dynamic status of paint and group
  // wrappers at construction. Refresh that layer once after a static edit,
  // otherwise its new native value is evaluated but never painted.
  if(p.elem)p.elem._isFirstFrame=true;
 }}
 renderer.renderedFrame=null;return true;
}
