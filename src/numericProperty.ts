/** Lottie numeric dialect. Pure source evaluation and immutable writes; no renderer or clock. */
type R = Record<string, any>;
const vector = (v: unknown): number[] | null => typeof v === 'number' && Number.isFinite(v) ? [v] : Array.isArray(v) && v.length > 0 && v.length <= 4 && v.every(n => typeof n === 'number' && Number.isFinite(n)) ? [...v] : null;
const clone = <T>(v:T):T => JSON.parse(JSON.stringify(v));
const axis = (v:any, i:number, fallback:number) => typeof v === 'number' ? v : Array.isArray(v) ? v[i] ?? v[0] ?? fallback : fallback;
const mix = (a:number,b:number,t:number) => a+(b-a)*t;
const cubic = (a:number,b:number,c:number,d:number,t:number) => mix(mix(mix(a,b,t),mix(b,c,t),t),mix(mix(b,c,t),mix(c,d,t),t),t);
function parameter(x:number,x1:number,x2:number) { let lo=0,hi=1; for(let i=0;i<48;i++){const m=(lo+hi)/2;if(cubic(0,x1,x2,1,m)<x)lo=m;else hi=m;}return (lo+hi)/2; }
function ease(key:R,i:number,ratio:number){const x1=axis(key.o?.x,i,0),x2=axis(key.i?.x,i,1),y1=axis(key.o?.y,i,0),y2=axis(key.i?.y,i,1);return cubic(0,y1,y2,1,parameter(ratio,x1,x2));}
export function numericPropertyValue(property:R,frame:number):number[]|null {
 if(!property||!Number.isFinite(frame)||property.x||property.s===true)return null;
 if(property.a!==1 && vector(property.k))return vector(property.k);
 const keys=property.k;if(!Array.isArray(keys)||!keys.length||!keys.every(k=>k&&Number.isFinite(k.t)))return null;
 if(frame<=keys[0].t)return vector(keys[0].s);
 let index=keys.findIndex((k:R)=>k.t>frame)-1;if(index===-2)index=keys.length-1;
 const key=keys[index],next=keys[index+1],start=vector(key.s)??vector(keys[index-1]?.e);if(!start)return null;
 if(frame===key.t||!next||key.h===1)return start;
 const end=vector(next.s)??vector(key.e);if(!end||end.length!==start.length)return null;
 const ratio=(frame-key.t)/(next.t-key.t);
 if(key.to && key.ti){
  // Match the pinned SVG player's 150-point spatial length table. Never use this
  // sampled representation to rewrite spatial tangents or subdivide their keys.
  const samples=Array.from({length:150},(_,j)=>start.map((s,i)=>cubic(s,s+key.to[i],end[i]+key.ti[i],end[i],j/149)));
  const lengths=samples.map((p,j)=>j?Math.hypot(...p.map((n,i)=>n-samples[j-1][i])):0),total=lengths.reduce((a,b)=>a+b,0),distance=ease(key,0,ratio)*total;
  let accumulated=0;for(let j=1;j<samples.length;j++){if(distance<=accumulated+lengths[j])return samples[j].map((v,i)=>mix(samples[j-1][i],v,lengths[j]?(distance-accumulated)/lengths[j]:0));accumulated+=lengths[j];}return end;
 }
 return start.map((n,i)=>mix(n,end[i],ease(key,i,ratio)));
}
export function numericPropertyState(property:R,frame:number){
 const value=numericPropertyValue(property,frame),keys=property?.a===1?property.k:[],index=Array.isArray(keys)?keys.findIndex((k:R)=>Math.abs(k.t-frame)<1e-7&&vector(k.s)): -1;
 const staticValue=property?.a!==1&&!!vector(property?.k);
 let reason=staticValue?'Créer une animation à cet instant.':index>=0?'Une clé existe déjà à cet instant.':'';let canCreate=staticValue;
 if(!value)reason='Propriété numérique ou temps non pris en charge.';
 else if(!staticValue&&index<0){
  const before=keys.filter((k:R)=>k.t<frame).at(-1),after=keys.find((k:R)=>k.t>frame);
  if(keys.some((key:R)=>Math.abs(key.t-frame)<1e-7))reason='Fin de segment sans valeur autonome · modifier la clé précédente.';
  else if(before?.to||before?.ti)reason='Insertion sur trajectoire spatiale différée ; les tangentes source restent intactes.';
  else if((!before&&vector(after?.s))||(!after&&vector(before?.s))){canCreate=true;reason='Créer une clé ici pour étendre cette animation.';}
  else if(!before||!after)reason='Insertion hors des segments source non prise en charge.';
  else {canCreate=true;reason='Créer une clé ici pour modifier cette valeur.';}
 }
 const key=index>=0?keys[index]:null,next=index>=0?keys[index+1]:null;
 const end=vector(next?.s)??vector(key?.e);
 const interpolation:'hold'|'linear'|'curve'|undefined=value&&key&&next?(key.h===1?'hold':value!.every((_,d)=>axis(key.o?.x,d,0)===axis(key.o?.y,d,0)&&axis(key.i?.x,d,1)===axis(key.i?.y,d,1))?'linear':'curve'):undefined;
 const canLinearize=!!value&&!!key&&!!next&&next.t>key.t&&!!end&&end.length===value.length&&interpolation!=='linear';
 return {value,index,staticValue,editable:!!value&&(staticValue||index>=0),canCreate,reason,interpolation,canLinearize};
}
export function writeNumericProperty(property:R,frame:number,value:readonly number[]):R {
 const state=numericPropertyState(property,frame);if(!state.editable||!state.value)throw new Error(state.reason||'Sélectionner une clé source à cet instant.');
 if(value.length!==state.value.length||!value.every(Number.isFinite))throw new Error('Valeur ou dimensions invalides.');
 const next=clone(property);
 if(state.staticValue)next.k=typeof property.k==='number'?value[0]:[...value];
 else {next.k[state.index].s=[...value];if(state.index>0&&Array.isArray(next.k[state.index-1].e))next.k[state.index-1].e=[...value];}
 return next;
}
/** Subdivide temporal easing without linearizing the existing segment. */
export function insertNumericKey(property:R,frame:number,range?:{start:number;end:number}):R {
 const state=numericPropertyState(property,frame);if(!state.canCreate||!state.value)throw new Error(state.reason||'Une clé existe déjà à cet instant.');
 if(state.staticValue){
  if(!range||![range.start,range.end].every(Number.isFinite)||range.end<=range.start||frame<range.start||frame>=range.end)throw new Error('Intervalle de conversion statique non admis.');
  const times=[...new Set([range.start,frame,range.end])].sort((a,b)=>a-b);
  return {...clone(property),a:1,k:times.map((t,i)=>({t,s:[...state.value!],...(i<times.length-1?{e:[...state.value!],o:{x:[0],y:[0]},i:{x:[1],y:[1]}}:{})}))};
 }
 const extended=clone(property),last=extended.k.at(-1);
 if(frame<extended.k[0].t){extended.k.unshift({t:frame,s:[...state.value],e:vector(extended.k[0].s),o:{x:[0],y:[0]},i:{x:[1],y:[1]}});return extended;}
 if(frame>last.t){last.e=[...state.value];delete last.h;delete last.n;last.o={...last.o,x:[0],y:[0]};last.i={...last.i,x:[1],y:[1]};extended.k.push({t:frame,s:[...state.value]});return extended;}
 const next=clone(property),i=next.k.findIndex((k:R)=>k.t>frame)-1,left=next.k[i],right=next.k[i+1],value=state.value;
 const key:R={t:frame,s:[...value]};
 if(left.h===1){key.h=1;if(left.e)key.e=clone(left.e);}
 else {
  const end=vector(right.s)??vector(left.e);if(!end)throw new Error('Fin de segment sans valeur.');
  const ratio=(frame-left.t)/(right.t-left.t),old=clone(left),lo={x:[] as number[],y:[] as number[]},li={x:[] as number[],y:[] as number[]},ro={x:[] as number[],y:[] as number[]},ri={x:[] as number[],y:[] as number[]};
  for(let d=0;d<value.length;d++){
   const x1=axis(old.o?.x,d,0),x2=axis(old.i?.x,d,1),y1=axis(old.o?.y,d,0),y2=axis(old.i?.y,d,1),t=parameter(ratio,x1,x2);
   const ax=mix(0,x1,t),ay=mix(0,y1,t),bx=mix(x1,x2,t),by=mix(y1,y2,t),cx=mix(x2,1,t),cy=mix(y2,1,t),dx=mix(ax,bx,t),dy=mix(ay,by,t),ex=mix(bx,cx,t),ey=mix(by,cy,t),y=cubic(0,y1,y2,1,t);
   if(Math.abs(y)<1e-10||Math.abs(1-y)<1e-10)throw new Error('Subdivision dégénérée de l’easing ; aucune clé créée.');
   lo.x.push(ax/ratio);lo.y.push(ay/y);li.x.push(dx/ratio);li.y.push(dy/y);ro.x.push((ex-ratio)/(1-ratio));ro.y.push((ey-y)/(1-y));ri.x.push((cx-ratio)/(1-ratio));ri.y.push((cy-y)/(1-y));
  }
  left.o={...left.o,...lo};left.i={...left.i,...li};delete left.n;
  if(left.e)left.e=[...value];key.o=ro;key.i=ri;key.e=end;
 }
 next.k.splice(i+1,0,key);return next;
}

/** Explicitly change only the outgoing temporal segment of this source key. */
export function setNumericKeyLinear(property:R,frame:number):R {
 const state=numericPropertyState(property,frame);
 if(!state.canLinearize)throw new Error('Sélectionner une clé ayant un segment suivant non linéaire.');
 const next=clone(property),key=next.k[state.index],right=next.k[state.index+1];
 key.e=vector(right.s)??vector(key.e);
 delete key.h;delete key.n;
 key.o={...key.o,x:[0],y:[0]};key.i={...key.i,x:[1],y:[1]};
 return next;
}

/** Remove explicit source keys; a zero/one-key result becomes a static value. */
export function removeNumericKeys(property:R,frames:readonly number[],currentFrame:number):R {
 const value=numericPropertyValue(property,currentFrame);
 if(property?.a!==1||!value||!frames.length||frames.some(frame=>!Number.isFinite(frame)||!property.k.some((key:R)=>key.t===frame)))
  throw new Error('Clé numérique source introuvable.');
 const next=clone(property),removed=new Set(frames),keys=next.k.filter((key:R)=>!removed.has(key.t));
 if(keys.length<=1){const constant=vector(keys[0]?.s)??value;return {...next,a:0,k:constant.length===1?constant[0]:constant};}
 for(let i=0;i<keys.length-1;i++){const oldIndex=property.k.findIndex((key:R)=>key.t===keys[i].t);if(property.k[oldIndex+1]?.t!==keys[i+1].t){const end=vector(keys[i+1].s);if(end)keys[i].e=end;}}
 next.k=keys;return next;
}

/** The source key owns its outgoing segment, independently of the playhead. */
export function setNumericKeyInterpolation(property:R,frame:number,mode:'hold'|'linear'|'ease-in'|'ease-out'|'ease-in-out'):R {
 const state=numericPropertyState(property,frame),right=property?.k?.[state.index+1],end=vector(right?.s)??vector(property?.k?.[state.index]?.e);
 if(!state.value||state.index<0||!right||right.t<=frame||!end||end.length!==state.value.length)
  throw new Error('Sélectionner une clé numérique ayant un segment suivant.');
 if(!['hold','linear','ease-in','ease-out','ease-in-out'].includes(mode))throw new Error('Interpolation non prise en charge.');
 const next=clone(property),key=next.k[state.index];
 if(mode==='hold')key.h=1;
 else {
  const handles={linear:[0,0,1,1],'ease-in':[0.42,0,1,1],'ease-out':[0,0,0.58,1],'ease-in-out':[0.42,0,0.58,1]}[mode];
  delete key.h;delete key.n;key.e=vector(right.s)??vector(key.e);
  key.o={...key.o,x:[handles[0]],y:[handles[1]]};key.i={...key.i,x:[handles[2]],y:[handles[3]]};
 }
 return next;
}

/** Retiming preserves source order, values, temporal easing and spatial tangents. */
export function moveNumericKey(property:R,frame:number,nextFrame:number,range:{start:number;end:number}):R{
 const index=property?.a===1&&Array.isArray(property.k)?property.k.findIndex((key:R)=>Math.abs(key.t-frame)<1e-7):-1;
 if(index<0||!vector(property.k[index].s)||!Number.isFinite(nextFrame)||nextFrame<range.start||nextFrame>range.end)throw new Error('Déplacement de clé hors de la plage admise.');
 if((index>0&&nextFrame<=property.k[index-1].t+1e-7)||(index<property.k.length-1&&nextFrame>=property.k[index+1].t-1e-7))throw new Error('La clé ne peut pas croiser ou remplacer une clé voisine.');
 const next=clone(property);next.k[index].t=nextFrame;return next;
}

/** Move a source set atomically without allowing crossing against stationary neighbors. */
export function moveNumericKeys(property:R,moves:readonly {frame:number;nextFrame:number}[],range:{start:number;end:number}):R{
 if(property?.a!==1||!Array.isArray(property.k)||!moves.length)throw Error('Clés numériques source introuvables.');
 const next=clone(property),indices=new Set<number>();
 for(const move of moves){const index=property.k.findIndex((key:R)=>Math.abs(key.t-move.frame)<1e-7);
  if(index<0||indices.has(index)||!vector(property.k[index].s)||!Number.isFinite(move.nextFrame)||move.nextFrame<range.start||move.nextFrame>range.end)throw Error('Déplacement groupé hors de la plage admise.');
  indices.add(index);next.k[index].t=move.nextFrame;
 }
 if(next.k.some((key:R,index:number)=>index>0&&key.t<=next.k[index-1].t+1e-7))throw Error('Les clés ne peuvent pas croiser ou remplacer une clé voisine.');
 return next;
}
