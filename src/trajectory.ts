import type {AnimationItem,LottiePlayer,SVGRendererConfig} from 'lottie-web';
import type {LottieSource} from './contracts.js';
import type {LottiePathAppearance} from './pathAppearance.js';
import {inspectLottieProfile} from './profile.js';
import {indexLottiePaths} from './paths.js';
import {selectedLottieOrigin} from './selectedOrigin.js';
import {isLottieNodeHidden} from './visibility.js';
import {resolveLottieTypeLineage} from './lineageTypes.js';
import {lottiePathTypes,type LottiePathType} from './pathTypes.js';

export interface TrajectoryPoint {x:number;y:number;}
export interface TrajectorySample {frame:number;point:TrajectoryPoint|null;}
/** Seed every interval, then refine curvature. A bounded approximation, never a closed contour. */
export async function sampleTrajectory(start:number,end:number,evaluate:(frame:number)=>TrajectoryPoint|null,cancelled:()=>boolean=()=>false,budget=512):Promise<TrajectorySample[]> {
 const samples=new Map<number,TrajectoryPoint|null>();let count=0;
 async function read(frame:number){if(cancelled())throw new Error('cancelled');if(!samples.has(frame)){samples.set(frame,evaluate(frame));if(++count%16===0)await new Promise<void>(resolve=>setTimeout(resolve,0));}return samples.get(frame)!;}
 const intervals=Math.min(128,Math.max(1,Math.ceil(end-start)));
 for(let i=0;i<=intervals;i++)await read(start+(end-start)*i/intervals);
 async function refine(a:number,b:number,depth:number):Promise<void>{if(samples.size>=budget||depth>=6)return;const p=samples.get(a)!,q=samples.get(b)!,m=(a+b)/2,r=await read(m);
  const bends=p&&q&&r?Math.hypot(r.x-(p.x+q.x)/2,r.y-(p.y+q.y)/2)>.35:!!p!==!!r||!!q!==!!r;
  if(bends){await refine(a,m,depth+1);await refine(m,b,depth+1);}}
 const seeds=[...samples.keys()];for(let i=1;i<seeds.length;i++)await refine(seeds[i-1],seeds[i],0);
 return [...samples].sort((a,b)=>a[0]-b[0]).map(([frame,point])=>({frame,point}));
}
export function trajectoryPath(samples:readonly TrajectorySample[]){let active=false;return samples.map(({point})=>{if(!point){active=false;return '';}const command=active?'L':'M';active=true;return `${command}${point.x},${point.y}`;}).join('');}
/** Read-only auxiliary evaluation. Boundary inclusion changes only auxiliary visibility,
 * by one microframe, so the source key at op is evaluated exactly without changing transport. */
export function trajectoryEvaluationData(data:Record<string,unknown>){const clone=structuredClone(data);function visit(value:unknown){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}const item=value as Record<string,unknown>;if(typeof item.ty==='number'&&'ks'in item&&typeof item.op==='number')item.op+=1e-6;Object.values(item).forEach(visit);}visit(clone);return clone;}
/** Strict static admission: no animated/expressed properties and no layer whose
 * visibility or precomposition clock can change across this whole interval. */
export function admitsStaticTrajectory(data:Record<string,unknown>,start:number,end:number):boolean{
 function visit(value:unknown):boolean{
  if(!value||typeof value!=='object')return true;
  if(Array.isArray(value))return value.every(visit);
  const item=value as Record<string,unknown>;
  if('k'in item&&(item.a===1||typeof item.x==='string'||Array.isArray(item.k)&&item.k.some(key=>key&&typeof key==='object'&&'t'in key)))return false;
  if(typeof item.ty==='number'&&'ks'in item){
   if(typeof item.ip!=='number'||item.ip>start||typeof item.op!=='number'||item.op<end||(item.st??0)!==0||(item.sr??1)!==1||item.tm)return false;
  }
  return Object.values(item).every(visit);
 }
 return visit(data);
}
let trajectoryInstance=0;
export function createLottieTrajectory(target:HTMLElement,source:LottieSource,player:LottiePlayer,native?:Parameters<typeof selectedLottieOrigin>[0]){
 const clipId='konitif-trajectory-clip-'+(++trajectoryInstance);
 const doc=target.ownerDocument,ns='http://www.w3.org/2000/svg',profile=inspectLottieProfile(source.data),nodes=indexLottiePaths(source);
 const staticDocument=!!native&&admitsStaticTrajectory(source.data,profile.inFrame,profile.outFrame);
 let worker:AnimationItem|undefined,container:HTMLDivElement|undefined,overlay:SVGGElement|undefined,message:HTMLParagraphElement|undefined;
 let paintKey='';
 let closed=false,ready=false,failed=false,generation=0,loadCleanup=()=>{},lastKey='',samples:TrajectorySample[]|undefined;
 let latest:{ids:readonly string[];hidden:readonly string[];appearance:LottiePathAppearance;types:Readonly<Record<string,LottiePathType>>}|undefined;
 function feedback(text:string){if(!text){message?.remove();message=undefined;return;}if(!message){message=doc.createElement('p');message.setAttribute('role','status');message.setAttribute('data-lottie-trajectory-status','');message.style.cssText='position:absolute;bottom:0;left:1rem;right:1rem;margin:4px 0;padding:3px 6px;background:#17212bdd;color:#dce6ef;font-size:11px;pointer-events:none';target.append(message);}message.textContent=text;}
 function clear(){overlay?.remove();overlay=undefined;paintKey='';}
 function stop(){++generation;loadCleanup();loadCleanup=()=>{};worker?.destroy();worker=undefined;container?.remove();container=undefined;ready=false;lastKey='';samples=undefined;clear();}
 function paint(){if(!samples||!latest)return;const svg=target.querySelector('svg'),camera=svg?.querySelector('[data-lottie-view-transform]')??svg;if(!camera)return;
  const node=nodes.find(n=>n.id===latest!.ids[0])!,type=resolveLottieTypeLineage(nodes,latest.types)[node.id]?.types[0],color=type?lottiePathTypes[type].color:'#b9dfef';
  const nextPaintKey=JSON.stringify([color,latest.appearance.cropViewport]);if(overlay?.parentElement===camera&&paintKey===nextPaintKey)return;clear();paintKey=nextPaintKey;
  overlay=doc.createElementNS(ns,'g');overlay.setAttribute('data-lottie-trajectory',node.id);overlay.setAttribute('data-trajectory-samples',String(samples.length));overlay.setAttribute('data-trajectory-start',JSON.stringify(samples[0]));overlay.setAttribute('data-trajectory-end',JSON.stringify(samples.at(-1)));overlay.setAttribute('pointer-events','none');overlay.setAttribute('aria-hidden','true');
  if(latest.appearance.cropViewport){const defs=doc.createElementNS(ns,'defs'),clip=doc.createElementNS(ns,'clipPath'),rect=doc.createElementNS(ns,'rect');clip.id=clipId;rect.setAttribute('width',String(profile.width));rect.setAttribute('height',String(profile.height));clip.append(rect);defs.append(clip);overlay.append(defs);overlay.setAttribute('clip-path','url(#'+clipId+')');}
  for(const [stroke,width]of [['#17212b','4'],[color,'1.5']]){const path=doc.createElementNS(ns,'path');path.setAttribute('d',trajectoryPath(samples));path.setAttribute('fill','none');path.setAttribute('stroke',stroke);path.setAttribute('stroke-width',width);path.setAttribute('vector-effect','non-scaling-stroke');overlay.append(path);}
  for(const [index,sample]of [samples.find(s=>s.point),[...samples].reverse().find(s=>s.point)].entries()){if(!sample?.point)continue;const dot=doc.createElementNS(ns,'circle');dot.setAttribute('cx',String(sample.point.x));dot.setAttribute('cy',String(sample.point.y));dot.setAttribute('r',String(2.5));dot.setAttribute('fill',index?color:'none');dot.setAttribute('stroke',color);dot.setAttribute('stroke-width','1.5');dot.setAttribute('vector-effect','non-scaling-stroke');dot.setAttribute('data-trajectory-boundary',index?'end':'start');overlay.append(dot);}
  camera.append(overlay);feedback(samples.some(s=>s.point)?`Path · ${node.label} · pivot/ancrage transformé · approximation, ${samples.length} échantillons (512 maximum) · début / fin, sans fermeture imposée.`:'Path · aucun pivot projetable sur cet intervalle.');
 }
 async function calculate(ticket:number){if(!worker||!container||!latest)return;const current=worker,node=nodes.find(n=>n.id===latest!.ids[0])!,svg=container.querySelector('svg');if(!svg)return;
  try{const result=await sampleTrajectory(profile.inFrame,profile.outFrame,frame=>{current.goToAndStop(frame-profile.inFrame,true);const point=selectedLottieOrigin((current as unknown as {renderer:Parameters<typeof selectedLottieOrigin>[0]}).renderer,node,[]),matrix=svg.getScreenCTM();if(!point||!matrix)return null;const inv=matrix.inverse();return{x:inv.a*point.x+inv.c*point.y+inv.e,y:inv.b*point.x+inv.d*point.y+inv.f};},()=>closed||ticket!==generation);
   if(closed||ticket!==generation)return;samples=result;paint();
  }catch{if(ticket===generation&&!closed){failed=true;clear();feedback('Path indisponible : pivot non résolu. Désactivez puis réactivez Path pour réessayer.');}}
 }
 function start(){const ticket=generation;container=doc.createElement('div');container.setAttribute('data-lottie-trajectory-worker','');container.setAttribute('aria-hidden','true');container.style.cssText='position:absolute;inset:0;opacity:0;pointer-events:none';target.append(container);
  worker=player.loadAnimation({container,renderer:'svg',loop:false,autoplay:false,animationData:trajectoryEvaluationData(source.data),rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:false,runExpressions:false}as SVGRendererConfig});const current=worker;
  const loaded=()=>{loadCleanup();loadCleanup=()=>{};if(closed||ticket!==generation)return;ready=true;void calculate(ticket);};const failure=()=>{if(ticket!==generation||closed)return;const failedKey=lastKey;stop();lastKey=failedKey;failed=true;feedback('Path indisponible : lecteur auxiliaire non chargé.');};const timer=setTimeout(failure,10000);loadCleanup=()=>{clearTimeout(timer);current.removeEventListener('DOMLoaded',loaded);current.removeEventListener('data_failed',failure);};current.addEventListener('DOMLoaded',loaded);current.addEventListener('data_failed',failure);if(current.isLoaded)loaded();
 }
 return{update(ids:readonly string[],hidden:readonly string[],appearance:LottiePathAppearance,types:Readonly<Record<string,LottiePathType>>){latest={ids:[...ids],hidden:[...hidden],appearance,types};if(closed)return;
  if(!appearance.trajectoryEnabled){stop();failed=false;feedback('');return;}
  const node=ids.length===1?nodes.find(n=>n.id===ids[0]):undefined;
  if(!node||!node.selectable||node.sourceType==='3'||node.kind==='style'||isLottieNodeHidden(nodes,node.id,hidden)){stop();feedback(ids.length>1?'Path · sélectionnez un seul élément pour inspecter son pivot.':node?.sourceType==='3'?'Path · pivot des calques nuls non qualifié pour cette trajectoire.':'Path · sélectionnez un élément visible dont le pivot est projetable.');return;}
  const key=JSON.stringify([source.id,source.revision,ids,hidden]);if(key!==lastKey){stop();lastKey=key;failed=false;
   if(staticDocument&&native){
    const point=selectedLottieOrigin(native,node,hidden),matrix=native.layerElement?.getScreenCTM();
    if(matrix){const local=point?new DOMPoint(point.x,point.y).matrixTransform(matrix.inverse()):null;const value=local?{x:local.x,y:local.y}:null;samples=[{frame:profile.inFrame,point:value},{frame:profile.outFrame,point:value}];ready=true;paint();return;}
   }
   feedback('Path · calcul de la trajectoire…');try{start();}catch{const failedKey=lastKey;stop();lastKey=failedKey;failed=true;feedback('Path indisponible : lecteur auxiliaire non chargé.');}return;}if(ready&&!failed&&samples)paint();
 },dispose(){closed=true;stop();feedback('');}};
}
