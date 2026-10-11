import {test} from 'node:test';
import assert from 'node:assert/strict';
import {numericPropertyValue,numericPropertyState,writeNumericProperty,insertNumericKey,setNumericKeyLinear,removeNumericKeys,setNumericKeyInterpolation} from '../dist/numericProperty.js';
import {lottieTranslationDelta} from '../dist/editTranslation.js';
const ease={o:{x:[.25,.4],y:[.1,.2]},i:{x:[.75,.6],y:[.9,.8]}};
const original={a:1,ix:7,unknown:{retain:true},k:[{t:0,s:[10,30],e:[70,90],...ease,custom:'left'},{t:40,s:[70,90],h:1,custom:'right'}]};
test('insertion subdivides multidimensional temporal easing without changing the evaluated motion or unknown data',()=>{
 const frozen=JSON.stringify(original),inserted=insertNumericKey(original,13.25);
 assert.equal(inserted.k[1].t,13.25);assert.deepEqual(inserted.unknown,original.unknown);assert.equal(inserted.k[0].custom,'left');assert.equal(inserted.k[2].custom,'right');
 for(let t=0;t<=40;t+=.25){const a=numericPropertyValue(original,t),b=numericPropertyValue(inserted,t);for(let i=0;i<2;i++)assert.ok(Math.abs(a[i]-b[i])<1e-7,`${t}: ${a} vs ${b}`);}
 assert.equal(JSON.stringify(original),frozen);
});
test('existing-key write updates its incoming endpoint and preserves timing, handles, spatial tangents and unknown fields',()=>{
 const p=structuredClone(original);p.k[0].to=[20,0];p.k[0].ti=[-20,0];
 const next=writeNumericProperty(p,40,[80,100]);assert.deepEqual(next.k[1].s,[80,100]);assert.deepEqual(next.k[0].e,[80,100]);assert.deepEqual(next.k[0].to,p.k[0].to);assert.deepEqual(next.k[0].i,p.k[0].i);assert.deepEqual(next.k.map(k=>k.t),[0,40]);
 assert.throws(()=>writeNumericProperty(p,15,[80,100]));assert.throws(()=>insertNumericKey(p,15));assert.throws(()=>writeNumericProperty(p,40,[1]));assert.throws(()=>writeNumericProperty(p,40,[NaN,1]));
});
test('hold insertion and static scalar writes remain their original dialects; conversion is explicit',()=>{
 const held={a:1,k:[{t:0,s:[20],h:1},{t:10,s:[80],h:1}]},next=insertNumericKey(held,4.5);assert.equal(next.k[1].h,1);assert.deepEqual(numericPropertyValue(next,9),[20]);
 assert.deepEqual(writeNumericProperty({a:0,k:35,custom:9},2,[45]),{a:0,k:45,custom:9});assert.equal(numericPropertyState({a:0,k:[2,4]},2).canCreate,true);const converted=insertNumericKey({a:0,k:[2,4],ix:9},2,{start:0,end:10});assert.equal(converted.a,1);assert.deepEqual(converted.k.map(k=>k.t),[0,2,10]);assert.deepEqual(numericPropertyValue(converted,1),[2,4]);assert.deepEqual(numericPropertyValue(converted,9),[2,4]);assert.throws(()=>insertNumericKey({a:0,k:3},2));
});
test('position delta removes own transform while retaining projected parenting and camera',()=>{
 const own=[0,2,0,0,-3,0,0,0,0,0,1,0,0,0,0,1];
 const layer={layerElement:{getScreenCTM:()=>({a:0,b:8,c:-12,d:0})},finalTransform:{mProp:{v:{props:own}}}};
 assert.deepEqual(lottieTranslationDelta({elements:[layer]},{kind:'layer',layerRoute:[0],shapeRoute:[]},40,20),{dx:10,dy:5});
 assert.equal(lottieTranslationDelta({elements:[layer]},{kind:'path',layerRoute:[0],shapeRoute:[]},40,20),null);
});

test('new numeric animations interpolate linearly through scalar and vector values',()=>{
 for(const initial of [10,[10,30],[10,30,50]]){
  const value=Array.isArray(initial)?initial:[initial];
  let property=insertNumericKey({a:0,k:initial},0,{start:0,end:40});
  property=insertNumericKey(property,20);
  property=writeNumericProperty(property,20,value.map(v=>v+80));
  for(const t of [0,5,10,15,20])numericPropertyValue(property,t).forEach((v,d)=>assert.ok(Math.abs(v-(value[d]+4*t))<1e-7));
  assert.ok(property.k.slice(0,-1).every(key=>key.h!==1));
 }
});
test('linearizing one held segment is explicit, immutable, and preserves other keys and spatial tangents',()=>{
 const property={a:1,unknown:42,k:[{t:0,s:[0,10],h:1,to:[20,0],ti:[-20,0],custom:7},{t:20,s:[80,90],h:1},{t:40,s:[100,100]}]},before=JSON.stringify(property);
 const next=setNumericKeyLinear(property,0);
 assert.equal(next.k[0].h,undefined);assert.deepEqual(next.k[0].e,[80,90]);assert.deepEqual(next.k[0].to,[20,0]);assert.equal(next.k[0].custom,7);assert.deepEqual(next.k.slice(1),property.k.slice(1));assert.equal(next.unknown,42);assert.equal(JSON.stringify(property),before);
 assert.throws(()=>setNumericKeyLinear(property,10));assert.throws(()=>setNumericKeyLinear(property,40));
 const temporal=setNumericKeyLinear({a:1,k:[{t:0,s:[0,10],h:1},{t:20,s:[80,90]}]},0);
 numericPropertyValue(temporal,5).forEach((v,d)=>assert.ok(Math.abs(v-[20,30][d])<1e-7));
 assert.equal(numericPropertyState(temporal,0).interpolation,'linear');
});

test('numeric key deletion stitches only the removed segment and converts zero/one keys to a static pose',()=>{
 const property={a:1,ix:4,k:[{t:0,s:[0,10],e:[80,90],o:{x:[0],y:[0]},i:{x:[1],y:[1]},custom:7},{t:10,s:[80,90],e:[100,110],o:{x:[0],y:[0]},i:{x:[1],y:[1]}},{t:20,s:[100,110]}]},before=JSON.stringify(property);
 const next=removeNumericKeys(property,[10],5);assert.deepEqual(next.k.map(k=>k.t),[0,20]);assert.deepEqual(next.k[0].e,[100,110]);assert.equal(next.k[0].custom,7);numericPropertyValue(next,10).forEach((v,d)=>assert.ok(Math.abs(v-[50,60][d])<1e-7));
 assert.deepEqual(removeNumericKeys(property,[0],5).k,property.k.slice(1));
 assert.deepEqual(removeNumericKeys(property,[0,10],5),{a:0,ix:4,k:[100,110]});
 const all=removeNumericKeys(property,[0,10,20],10);assert.deepEqual(all,{a:0,ix:4,k:[80,90]});
 assert.throws(()=>removeNumericKeys(property,[99],0));assert.equal(JSON.stringify(property),before);
});

test('transition choices affect exactly one outgoing segment and reject a terminal key',()=>{
 const property=structuredClone(original),before=JSON.stringify(property),held=setNumericKeyInterpolation(property,0,'hold');assert.equal(held.k[0].h,1);assert.deepEqual(held.k[0].i,property.k[0].i);assert.deepEqual(held.k[1],property.k[1]);assert.deepEqual(numericPropertyValue(held,20),[10,30]);
 const linear=setNumericKeyInterpolation(held,0,'linear');numericPropertyValue(linear,20).forEach((v,d)=>assert.ok(Math.abs(v-[40,60][d])<1e-7));assert.deepEqual(linear.k[1],property.k[1]);assert.equal(JSON.stringify(property),before);assert.throws(()=>setNumericKeyInterpolation(property,40,'linear'));assert.throws(()=>setNumericKeyInterpolation(property,0,'bogus'));
});

test('easing presets change only the outgoing temporal segment and yield intermediate values',async()=>{
 const {setNumericKeyInterpolation,numericPropertyValue}=await import('../dist/numericProperty.js');
 const source={a:1,k:[{t:0,s:[0],e:[100],h:1,to:[1],ti:[2]},{t:10,s:[100],o:{x:[0],y:[0]},i:{x:[1],y:[1]}},{t:20,s:[200]}]};
 const before=JSON.stringify(source);
 for(const mode of ['ease-in','ease-out','ease-in-out']){
  const next=setNumericKeyInterpolation(source,0,mode),scalar=structuredClone(next); delete scalar.k[0].to; delete scalar.k[0].ti; const value=numericPropertyValue(scalar,5)[0];
  assert.equal(next.k[0].h,undefined);assert.deepEqual(next.k[1],source.k[1]);assert.deepEqual(next.k[0].to,[1]);assert.deepEqual(next.k[0].ti,[2]);
  if(mode==='ease-in')assert.ok(value>0&&value<50);else if(mode==='ease-out')assert.ok(value>50&&value<100);else assert.ok(Math.abs(value-50)<0.001);
 }
 assert.equal(JSON.stringify(source),before);
});
