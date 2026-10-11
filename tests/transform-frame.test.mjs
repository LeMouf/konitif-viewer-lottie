import test from 'node:test';
import assert from 'node:assert/strict';
import {lottieTransformFrame,transformGestureValues} from '../dist/transformFrame.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const frame={pivot:{x:50,y:60},parentInverse:[.5,0,0,.25],localInverse:[0,-1/6,1/8,0],own:[0,2,-3,0]};
test('visual rotation and proportional scale remove nonuniform parent/view transforms',()=>{
 const r=transformGestureValues('rotate',frame,{x:70,y:60},{x:50,y:100},{r:[20]});near(r.r[0],110);
 const s=transformGestureValues('scale',frame,{x:70,y:60},{x:90,y:60},{s:[100,60,100]});assert.deepEqual(s.s,[200,120,100]);
 assert.equal(transformGestureValues('rotate',frame,frame.pivot,{x:100,y:60},{r:[0]}),null);
});
test('pivot compensation preserves every painted local point through rotation and unequal scales',()=>{
 const old={a:[2,3,0],p:[40,50,0]},next=transformGestureValues('pivot',frame,{x:50,y:60},{x:62,y:76},old);
 near(next.a[0],4);near(next.a[1],1);near(next.p[0],46);near(next.p[1],54);
 for(const q of [[0,0],[10,20],[-30,4]])for(let d=0;d<2;d++){
  const paint=(a,p)=>p[d]+frame.own[d]*(q[0]-a[0])+frame.own[d+2]*(q[1]-a[1]);near(paint(old.a,old.p),paint(next.a,next.p));
 }
 assert.deepEqual(old,{a:[2,3,0],p:[40,50,0]});
});
test('native transform observation rejects singular and 3D subjects, resolves group transforms without positional assumptions',()=>{
 const own=[0,2,0,0,-3,0,0,0,0,0,1,0,0,0,0,1],prop={v:{props:own},a:{v:[2,3,0]}},group={gr:{getScreenCTM:()=>({a:0,b:8,c:-6,d:0,e:68,f:44})},it:[{transform:{mProps:prop}},{}]},layer={data:{ddd:0},itemsData:[group]},renderer={elements:[layer]},node={kind:'group',selectable:true,layerRoute:[0],shapeRoute:[0]};
 const observed=lottieTransformFrame(renderer,node);assert.deepEqual(observed.pivot,{x:50,y:60});observed.parentInverse.forEach((n,i)=>near(n,[.5,0,0,.25][i]));
 layer.data.ddd=1;assert.equal(lottieTransformFrame(renderer,node),null);layer.data.ddd=0;own[0]=own[1]=0;assert.equal(lottieTransformFrame(renderer,node),null);
});

