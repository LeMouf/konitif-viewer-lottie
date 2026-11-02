import {indexLottiePaths,numericPropertyState,type LottieSource} from './index.js';
type R=Record<string,any>;
export function resolveLottieStyle(source:LottieSource,id:string){
 const node=indexLottiePaths(source).find(n=>n.id===id&&n.kind==='style'&&n.selectable);if(!node)return null;
 let layers=(source.data as R).layers,pointer='/layers',layer:R|undefined;
 for(let i=0;i<node.layerRoute.length;i++){const index=node.layerRoute[i];layer=layers?.[index];pointer+='/'+index;if(!layer)return null;
  if(i<node.layerRoute.length-1){const assets=(source.data as R).assets??[],assetIndex=assets.findIndex((a:R)=>a.id===layer!.refId);if(assetIndex<0)return null;layers=assets[assetIndex].layers;pointer='/assets/'+assetIndex+'/layers';}}
 let shapes=layer?.shapes,value:R|undefined;pointer+='/shapes';
 for(let i=0;i<node.shapeRoute.length;i++){const index=node.shapeRoute[i];value=shapes?.[index];pointer+='/'+index;if(!value)return null;if(i<node.shapeRoute.length-1){shapes=value.it;pointer+='/it';}}
 return value&&['fl','st','gf','gs'].includes(value.ty)?{node,pointer,value,siblings:shapes as R[]}:null;
}
export function lottieStyleColorScale(source:LottieSource){const v=String(source.data.v??'').split('.').map(Number);return v[0]<4||(v[0]===4&&(v[1]<1||(v[1]===1&&v[2]<9)))?255:1;}
export type StyleChange={field:'lc'|'lj'|'r'|'t';value:number}|{field:'paint';value:'solid'|'gradient'}|{field:'stop';index:number;position:number;color:readonly number[]};
export function editLottieStyle(style:R,change:StyleChange,colorScale=1,axis:{start:number[];end:number[]}={start:[0,0],end:[100,0]}):R{
 const next=JSON.parse(JSON.stringify(style));
 if(change.field==='paint'){
  const gradient=style.ty==='gf'||style.ty==='gs',stroke=style.ty==='st'||style.ty==='gs';if(gradient===(change.value==='gradient'))return next;
  if(gradient?style.g?.k?.a!==0:style.c?.a!==0)throw Error('Le changement de type nécessite une couleur statique ; les animations existantes sont conservées.');
  next.ty=change.value==='gradient'?(stroke?'gs':'gf'):(stroke?'st':'fl');
  if(change.value==='gradient'){const color=style.c.k.slice(0,3).map((n:number)=>n/colorScale);next.g={p:2,k:{a:0,k:[0,...color,1,...color]}};next.s={a:0,k:axis.start};next.e={a:0,k:axis.end};next.t=1;delete next.c;}
  else{next.c={a:0,k:[...style.g.k.k.slice(1,4).map((n:number)=>n*colorScale),1]};delete next.g;delete next.s;delete next.e;delete next.t;delete next.h;delete next.a;}
 }else if(change.field==='stop'){
  if(!['gf','gs'].includes(style.ty)||style.g?.k?.a!==0)throw Error('Les couleurs de ce dégradé animé restent pilotées par leurs clés.');
  if(!Number.isInteger(change.index)||change.index<0||change.index>=style.g.p||!Number.isFinite(change.position)||change.position<0||change.position>1||change.color.length!==3||change.color.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('Point de dégradé invalide.');
  const offset=change.index*4,values=next.g.k.k;if(!Array.isArray(values)||values.length<style.g.p*4)throw Error('Dégradé invalide.');
  if(change.index>0&&change.position<values[offset-4]||change.index+1<style.g.p&&change.position>values[offset+4])throw Error('Conserver l’ordre des points du dégradé.');
  values.splice(offset,4,change.position,...change.color);
 }else{
  const admitted=change.field==='lc'||change.field==='lj'?['st','gs'].includes(style.ty)&&[1,2,3].includes(change.value):change.field==='r'?['fl','gf'].includes(style.ty)&&[1,2].includes(change.value):['gf','gs'].includes(style.ty)&&[1,2].includes(change.value);
  if(!admitted)throw Error('Option de style non admise.');next[change.field]=change.value;
 }
 return next;
}

/** Initialize in the style's local coordinate system, before the group's transform. */
export function lottieStyleGradientAxis(shapes:readonly R[],frame=0){
 const points:number[][]=[];
 for(const shape of shapes){
  if(shape.hd)continue;
  if(shape.ty==='el'||shape.ty==='rc'){const position=numericPropertyState(shape.p,frame).value,size=numericPropertyState(shape.s,frame).value;if(position&&size){points.push([position[0]-Math.abs(size[0])/2,position[1]-Math.abs(size[1])/2],[position[0]+Math.abs(size[0])/2,position[1]+Math.abs(size[1])/2]);}}
  if(shape.ty==='sh'){const path=shape.ks?.a===1?shape.ks.k.findLast((key:R)=>key.t<=frame)?.s?.[0]??shape.ks.k[0]?.s?.[0]:shape.ks?.k;if(path?.v)for(let i=0;i<path.v.length;i++){const v=path.v[i];points.push(v);for(const tangent of [path.i?.[i],path.o?.[i]])if(tangent)points.push([v[0]+tangent[0],v[1]+tangent[1]]);}}
 }
 const finite=points.filter(p=>p.length>=2&&p.every(Number.isFinite));if(!finite.length)return {start:[0,0],end:[100,0]};
 const left=Math.min(...finite.map(p=>p[0])),right=Math.max(...finite.map(p=>p[0])),y=(Math.min(...finite.map(p=>p[1]))+Math.max(...finite.map(p=>p[1])))/2;
 return {start:[left,y],end:[right>left?right:left+1,y]};
}
export function appendLottieStyleStroke(shapes:readonly R[]){
 if(shapes.some(s=>s.ty==='st'||s.ty==='gs'))throw Error('Un contour existe déjà dans ce groupe.');
 const next=JSON.parse(JSON.stringify(shapes)),transform=next.findIndex((s:R)=>s.ty==='tr'),index=transform<0?next.length:transform;
 next.splice(index,0,{ty:'st',nm:'Contour',c:{a:0,k:[0,0,0]},o:{a:0,k:100},w:{a:0,k:2},lc:2,lj:2,ml:4});return {shapes:next,index};
}
