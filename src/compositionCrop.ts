/** Only the pinned renderer root composition clip is optional for inspection.
 * Authored paint remains under its original clip; nested clips and masks survive.
 * The host stage remains the physical overflow boundary, even with SVG overflow visible. */
const uncroppedRoots=new WeakSet<Element>();
export const omitCompositionCrop=(element:Element,name:string)=>name==='clip-path'&&uncroppedRoots.has(element);
export function createCompositionCrop(root:SVGGraphicsElement|undefined,width:number,height:number){
 const svg=root?.ownerSVGElement,previous=svg?.style.overflow??'';
 let frame:SVGRectElement|undefined;
 return {update(crop:boolean){
  if(!root||!svg)return;
  if(crop){uncroppedRoots.delete(root);svg.style.overflow=previous;frame?.remove();frame=undefined;}
  else{
   uncroppedRoots.add(root);svg.style.overflow='visible';
   if(!frame&&Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0){
    frame=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','rect');
    for(const [name,value] of Object.entries({'data-lottie-composition-frame':'',x:'0',y:'0',width:String(width),height:String(height),fill:'none',stroke:'#aab3bf','stroke-opacity':'.55','stroke-width':'1','stroke-dasharray':'4 4','vector-effect':'non-scaling-stroke','pointer-events':'none','aria-hidden':'true'}))frame.setAttribute(name,value);
    (root.closest?.('[data-lottie-view-transform]')??svg).appendChild(frame);
   }
  }
 },dispose(){if(root)uncroppedRoots.delete(root);frame?.remove();frame=undefined;if(svg)svg.style.overflow=previous;}};
}
