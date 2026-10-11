import type {LottiePathAppearance} from './pathAppearance.js';
import type {LottieNavigationPolicy} from './navigation.js';
/** Composition fit leaves safety on all sides; rulers and toolbar have their own clearance. */
export function lottieFitInsets(width:number,height:number,rulers:boolean){
 const padding=Math.max(16,Math.min(48,Math.min(width,height)*.06)),rail=rulers?22:0;
 return {left:padding+rail,right:padding,top:padding+rail+40,bottom:padding};
}
/** Fit changes the visible world rectangle, never the physical SVG viewport. */
export function lottieFitViewBox(width:number,height:number,sourceWidth:number,sourceHeight:number,rulers:boolean){
 if(![width,height,sourceWidth,sourceHeight].every(n=>Number.isFinite(n)&&n>0))return null;
 const insets=lottieFitInsets(width,height,rulers);
 const scale=Math.min(Math.max(1,width-insets.left-insets.right)/sourceWidth,Math.max(1,height-insets.top-insets.bottom)/sourceHeight);
 const left=insets.left+(width-insets.left-insets.right-sourceWidth*scale)/2;
 const top=insets.top+(height-insets.top-insets.bottom-sourceHeight*scale)/2;
 return{x:-left/scale,y:-top/scale,width:width/scale,height:height/scale,scale};
}
export function rulerTicks(origin:number,scale:number,length:number,start=22){
 if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(origin))return [];
 const raw=70/scale,power=10**Math.floor(Math.log10(raw)),step=([1,2,5,10].find(n=>n*power>=raw)??10)*power;
 const first=Math.ceil((start-origin)/(scale*step)),last=Math.floor((length-origin)/(scale*step));
 return Array.from({length:Math.max(0,Math.min(500,last-first+1))},(_,i)=>{const value=(first+i)*step;return{value:Object.is(value,-0)?0:value,position:origin+value*scale};});
}
/** Screen-space projections read the same evaluated SVG camera as paint and picking. */
export function mountLottieViewGuides(stage:HTMLElement,canvas:HTMLElement,read:()=>Readonly<LottiePathAppearance>,policy?:LottieNavigationPolicy){
 const doc=stage.ownerDocument,ns='http://www.w3.org/2000/svg';
 const grid=doc.createElement('div');grid.setAttribute('data-lottie-grid','');grid.setAttribute('aria-hidden','true');grid.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:0';stage.insertBefore(grid,canvas);
 const composition=doc.createElement('div');composition.setAttribute('data-lottie-composition-background','');composition.setAttribute('aria-hidden','true');composition.style.cssText='position:absolute;background:#000;opacity:0.2;pointer-events:none;z-index:0';stage.insertBefore(composition,canvas);
 const axes=doc.createElement('div');axes.setAttribute('data-lottie-axes','');axes.setAttribute('aria-hidden','true');axes.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1';stage.append(axes);
 const rulers=doc.createElementNS(ns,'svg');rulers.setAttribute('data-lottie-rulers','');rulers.setAttribute('aria-hidden','true');rulers.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';stage.append(rulers);
 let last='',lastFit='',sourceBox:{width:number;height:number}|undefined,originalViewBox:string|null=null;
 const fit=()=>{
  const v=read(),svg=canvas.querySelector('svg');
  canvas.style.inset='0px';
  stage.style.setProperty('--lottie-stage-height',stage.clientHeight+'px');stage.style.setProperty('--lottie-ruler-inset',v.rulers?'22px':'0px');
  if(!svg)return;
  if(!sourceBox){const box=svg.viewBox.baseVal;sourceBox={width:box.width,height:box.height};originalViewBox=svg.getAttribute('viewBox');}
  const box=lottieFitViewBox(stage.clientWidth,stage.clientHeight,sourceBox.width,sourceBox.height,v.rulers);if(!box)return;
  const value=[box.x,box.y,box.width,box.height].join(' ');if(value!==lastFit){lastFit=value;svg.setAttribute('viewBox',value);}
 };
 return{fit,update(){
  const svg=canvas.querySelector('svg'),camera=svg?.querySelector<SVGGraphicsElement>('[data-lottie-view-transform]')??svg,m=camera?.getScreenCTM(),r=stage.getBoundingClientRect(),v=read();
  if(!m||m.a<=0||m.d<=0)return;const x=m.e-r.left,y=m.f-r.top,s=m.a,width=stage.clientWidth,height=stage.clientHeight;
  const key=JSON.stringify([x,y,s,width,height,v.rulers,v.grid,v.axes]);if(key===last)return;last=key;
  const compositionBox=sourceBox??svg?.viewBox.baseVal;if(compositionBox){composition.style.left=x+'px';composition.style.top=y+'px';composition.style.width=compositionBox.width*s+'px';composition.style.height=compositionBox.height*m.d+'px';}
  const projection=policy?.gridProjection?.({x,y,zoom:s,width,height});
  grid.style.display=v.grid&&projection?'':'none';
  if(projection){const p=projection;grid.style.backgroundImage='linear-gradient(to right,#aab3bf18 1px,transparent 1px),linear-gradient(to bottom,#aab3bf18 1px,transparent 1px),linear-gradient(to right,#aab3bf28 1px,transparent 1px),linear-gradient(to bottom,#aab3bf28 1px,transparent 1px)';grid.style.backgroundSize=`${p.gridMinorScreenSize}px 100%,100% ${p.gridMinorScreenSize}px,${p.gridMajorScreenSize}px 100%,100% ${p.gridMajorScreenSize}px`;grid.style.backgroundPosition=`${p.gridMinorOffsetX}px 0,0 ${p.gridMinorOffsetY}px,${p.gridMajorOffsetX}px 0,0 ${p.gridMajorOffsetY}px`;grid.style.backgroundRepeat='repeat-x,repeat-y,repeat-x,repeat-y';grid.dataset.originX=String(x);grid.dataset.originY=String(y);grid.dataset.scale=String(s);}
  axes.replaceChildren();axes.style.display=v.axes?'':'none';
  if(v.axes&&svg){const box=sourceBox??svg.viewBox.baseVal;for(const [direction,position] of [['vertical',x],['vertical',x+box.width*s],['horizontal',y],['horizontal',y+box.height*m.d]] as const){const line=doc.createElement('div');line.dataset.axis=direction;line.dataset.position=String(position);line.style.cssText=direction==='vertical'?`position:absolute;left:${position}px;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,transparent,rgba(126,177,255,.6) 30%,rgba(126,177,255,.6) 70%,transparent)`:`position:absolute;top:${position}px;left:0;right:0;height:1px;background:linear-gradient(to right,transparent,rgba(125,224,176,.6) 30%,rgba(125,224,176,.6) 70%,transparent)`;axes.append(line);}}
  rulers.replaceChildren();rulers.style.display=v.rulers?'':'none';
  if(v.rulers){const add=(tag:string,attrs:Record<string,string>,text?:string)=>{const e=doc.createElementNS(ns,tag);for(const [k,value]of Object.entries(attrs))e.setAttribute(k,value);if(text!==undefined)e.textContent=text;rulers.append(e);};
   add('path',{d:`M0 0H${width}V22H22V${height}H0Z`,fill:'#17212b',stroke:'#526171','stroke-width':'.5'});
   for(const [axis,origin,scale,length]of [['x',x,s,width],['y',y,m.d,height]]as const)for(const tick of rulerTicks(origin,scale,length)){const p=tick.position;add('path',{d:axis==='x'?`M${p} 16V22`:`M16 ${p}H22`,stroke:'#aab3bf','data-ruler-axis':axis,'data-ruler-value':String(tick.value),'data-ruler-position':String(p)});add('text',{x:String(axis==='x'?p+3:14),y:String(axis==='x'?12:p-3),fill:'#c4cbd2','font-size':'9','font-family':'system-ui',...(axis==='y'?{transform:`rotate(-90 14 ${p-3})`}:{})},String(Number(tick.value.toPrecision(8))));}
  }
 },dispose(){const svg=canvas.querySelector('svg');if(svg&&originalViewBox!==null)svg.setAttribute('viewBox',originalViewBox);grid.remove();composition.remove();axes.remove();rulers.remove();stage.style.removeProperty('--lottie-ruler-inset');stage.style.removeProperty('--lottie-stage-height');}};
}
