import type {LottieViewerHost,LottiePenVertex} from './contracts.js';
/** Draft projection only. The host admits the single creation transaction. */
export function mountLottiePen(stage:HTMLElement,host:LottieViewerHost){
 const doc=stage.ownerDocument,ns='http://www.w3.org/2000/svg',overlay=doc.createElementNS(ns,'svg');overlay.setAttribute('data-lottie-pen-draft','');overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';stage.append(overlay);
 let active:{id:number;point:[number,number]}|null=null,scope='';
 const matrix=()=>stage.querySelector<SVGGraphicsElement>('[data-lottie-view-transform]')?.getScreenCTM();
 const local=(e:PointerEvent):[number,number]|null=>{const m=matrix();if(!m)return null;try{const inv=m.inverse(),x=inv.a*e.clientX+inv.c*e.clientY+inv.e,y=inv.b*e.clientX+inv.d*e.clientY+inv.f;return Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null;}catch{return null;}};
 const release=()=>{const id=active?.id;active=null;if(id!==undefined&&stage.hasPointerCapture(id))stage.releasePointerCapture(id);};
 const refresh=()=>{
  const reading=host.read(),editing=host.editing?.read(),key=JSON.stringify([reading.source?.id,reading.source?.revision,reading.timeSeconds]);
  if(key!==scope){scope=key;release();if(editing?.pen?.vertices.length){host.editing?.dispatch({type:'pen-cancel'});return;}}
  if(editing?.mode!=='pen'||reading.playing)release();stage.style.cursor=editing?.mode==='pen'?'crosshair':'';overlay.replaceChildren();
  const m=matrix(),vertices=editing?.pen?.vertices;if(!m||!vertices?.length||editing?.mode!=='pen')return;
  const r=stage.getBoundingClientRect(),project=(point:readonly number[])=>({x:m.a*point[0]+m.c*point[1]+m.e-r.left,y:m.b*point[0]+m.d*point[1]+m.f-r.top});
  const absolute=(v:LottiePenVertex,t:'in'|'out')=>project([v.point[0]+v[t][0],v.point[1]+v[t][1]]);
  let d='';vertices.forEach((v,i)=>{const p=project(v.point);if(!i)d='M'+p.x+','+p.y;else{const a=absolute(vertices[i-1],'out'),b=absolute(v,'in');d+='C'+a.x+','+a.y+' '+b.x+','+b.y+' '+p.x+','+p.y;}});
  const path=doc.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',editing.pen!.style.color);path.setAttribute('stroke-width',String(editing.pen!.style.width*Math.hypot(m.a,m.b)));path.setAttribute('opacity',String(editing.pen!.style.opacity/100));overlay.append(path);
  vertices.forEach(v=>{const p=project(v.point),a=absolute(v,'in'),b=absolute(v,'out'),line=doc.createElementNS(ns,'path');line.setAttribute('d','M'+a.x+','+a.y+'L'+b.x+','+b.y);line.setAttribute('stroke','#dce6ef');line.setAttribute('stroke-width','1');overlay.append(line);for(const [q,rad]of [[p,3],[a,2],[b,2]]as const){const dot=doc.createElementNS(ns,'circle');dot.setAttribute('cx',String(q.x));dot.setAttribute('cy',String(q.y));dot.setAttribute('r',String(rad));dot.setAttribute('fill','#17212b');dot.setAttribute('stroke','#dce6ef');overlay.append(dot);}});
 };
 const consume=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
 const down=(e:PointerEvent)=>{const reading=host.read();if(host.editing?.read().mode!=='pen'||e.button!==0||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||(e.target as Element).closest('[data-lottie-navigation]'))return;consume(e);if(active||e.isPrimary===false||!reading.source||reading.loading||reading.playing)return;const point=local(e);if(!point)return;stage.focus({preventScroll:true});const count=host.editing.read().pen?.vertices.length??0;active={id:e.pointerId,point};stage.setPointerCapture(e.pointerId);host.editing.dispatch({type:'pen-add',point});if(host.editing.read().pen?.vertices.length!==count+1)release();};
 const move=(e:PointerEvent)=>{if(!active||active.id!==e.pointerId)return;consume(e);const point=local(e);if(point)host.editing?.dispatch({type:'pen-tangent',out:[point[0]-active.point[0],point[1]-active.point[1]]});};
 const up=(e:PointerEvent)=>{if(active?.id!==e.pointerId)return;consume(e);release();};
 const cancel=(e:PointerEvent)=>{if(active?.id!==e.pointerId)return;consume(e);release();host.editing?.dispatch({type:'pen-cancel'});};
 const key=(e:KeyboardEvent)=>{if(host.editing?.read().mode!=='pen'||!['Enter','Escape'].includes(e.key)||(e.target as Element).closest('input,textarea,select,button,[contenteditable]'))return;consume(e);release();host.editing?.dispatch({type:e.key==='Enter'?'pen-finish':'pen-cancel'});};
 stage.tabIndex=0;stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,true);stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',cancel,true);stage.addEventListener('lostpointercapture',cancel,true);stage.addEventListener('keydown',key,true);
 const off=host.subscribe(refresh);refresh();return {refresh,dispose(){release();off();stage.removeEventListener('pointerdown',down,true);stage.removeEventListener('pointermove',move,true);stage.removeEventListener('pointerup',up,true);stage.removeEventListener('pointercancel',cancel,true);stage.removeEventListener('lostpointercapture',cancel,true);stage.removeEventListener('keydown',key,true);overlay.remove();}};
}
