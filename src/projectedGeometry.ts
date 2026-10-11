export interface Point {x:number;y:number;}
export interface Segment {from:Point;to:Point;c1?:Point;c2?:Point;straight:boolean;}
const same=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-6;
export function isStraightCubic(a:Point,b:Point,c:Point,d:Point):boolean{
 const dx=d.x-a.x,dy=d.y-a.y,length=dx*dx+dy*dy;
 if(length<1e-12)return same(a,b)&&same(a,c);
 const projection=(p:Point)=>((p.x-a.x)*dx+(p.y-a.y)*dy)/length;
 const onLine=(p:Point)=>Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)<1e-6*Math.sqrt(length);
 return onLine(b)&&onLine(c)&&projection(b)>=0&&projection(c)<=1&&projection(b)<=projection(c);
}
/** Only the absolute M/L/C/Z vocabulary emitted by the pinned SVG path cache is admitted. */
export function inspectProjectedConstruction(d:string):{vertices:Point[];segments:Segment[]}{
 const pattern=/[MLCZz]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi;
 if(d.replace(pattern,'').replace(/[\s,]/g,''))throw Error('Géométrie projetée non prise en charge.');
 const tokens=d.match(pattern)??[];let index=0,command='',current:Point={x:0,y:0},start=current;
 const vertices:Point[]=[],segments:Segment[]=[];
 const number=()=>{const v=Number(tokens[index++]);if(!Number.isFinite(v))throw Error('Coordonnée invalide.');return v;};
 const point=()=>({x:number(),y:number()});
 const vertex=(p:Point)=>{if(!vertices.some(v=>same(v,p)))vertices.push(p);};
 while(index<tokens.length){
  if(/^[a-z]$/i.test(tokens[index]))command=tokens[index++];
  if(command==='M'){current=point();start=current;vertex(current);command='L';}
  else if(command==='L'){const to=point();segments.push({from:current,to,straight:true});current=to;vertex(to);}
  else if(command==='C'){const c1=point(),c2=point(),to=point();segments.push({from:current,to,c1,c2,straight:isStraightCubic(current,c1,c2,to)});current=to;vertex(to);}
  else if(command==='Z'||command==='z'){if(!same(current,start))segments.push({from:current,to:start,straight:true});current=start;command='';}
  else throw Error('Commande de tracé non prise en charge.');
  if(vertices.length>256||segments.length>512)throw Error('Repères limités à 256 sommets par tracé.');
 }
 return {vertices,segments};
}
/** Exact bounds of the evaluated M/L/C/Z path, including interior cubic extrema.
 * Firefox can return an empty getBBox for a path inside clipPath; DOM layout is
 * therefore not an admission authority. Bounds only qualify containment, never hits.
 */
export function projectedPathBounds(d:string):{x:number;y:number;width:number;height:number}|null{
 try{
  const {vertices,segments}=inspectProjectedConstruction(d);if(!vertices.length)return null;
  const xs=vertices.map(p=>p.x),ys=vertices.map(p=>p.y);
  const extremum=(p0:number,p1:number,p2:number,p3:number,values:number[])=>{
   const a=-p0+3*p1-3*p2+p3,b=2*(p0-2*p1+p2),c=p1-p0;
   const roots:number[]=[];
   if(Math.abs(a)<1e-12){if(Math.abs(b)>1e-12)roots.push(-c/b);}
   else {const disc=b*b-4*a*c;if(disc>=0){const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(disc));if(q===0)roots.push(-b/(2*a));else roots.push(q/a,c/q);}}
   for(const t of roots)if(t>0&&t<1){const u=1-t;values.push(u*u*u*p0+3*u*u*t*p1+3*u*t*t*p2+t*t*t*p3);}
  };
  for(const s of segments)if(s.c1&&s.c2){extremum(s.from.x,s.c1.x,s.c2.x,s.to.x,xs);extremum(s.from.y,s.c1.y,s.c2.y,s.to.y,ys);}
  const x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
  return [x,y,width,height].every(Number.isFinite)?{x,y,width,height}:null;
 }catch{return null;}
}
