/** Screen-space targets keep magnetic distance independent of viewport zoom. */
export function pivotSnapTargets(corners:readonly (readonly number[])[]){
 if(corners.length!==4||corners.some(p=>p.length<2||!p.slice(0,2).every(Number.isFinite)))return [];
 return [...corners.map((p,i)=>({x:p[0],y:p[1],kind:['nw','ne','se','sw'][i]})),{x:(corners[0][0]+corners[2][0])/2,y:(corners[0][1]+corners[2][1])/2,kind:'center'}];
}
export function snapLottiePivot(point:{x:number;y:number},corners:readonly (readonly number[])[],radius=8){
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(radius)||radius<0)return null;
 const closest=pivotSnapTargets(corners).map(target=>({...target,distance:Math.hypot(target.x-point.x,target.y-point.y)})).sort((a,b)=>a.distance-b.distance)[0];
 return closest&&closest.distance<=radius?closest:null;
}
