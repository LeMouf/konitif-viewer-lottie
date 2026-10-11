const matrixNear=(element,expected)=>element.getAttribute().slice(7,-1).split(',').map(Number).forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-9));
import test from 'node:test';import assert from 'node:assert/strict';
import {createLiveLottieTransform} from '../dist/liveTransform.js';
const parent={getScreenCTM:()=>({a:2,b:0,c:0,d:3,e:10,f:20})};
const element=(e,f,original)=>{let value=original;return {parentElement:parent,getScreenCTM:()=>({a:2,b:0,c:0,d:3,e,f}),getAttribute:()=>value,setAttribute:(_,v)=>{value=v;},removeAttribute:()=>{value=null;}};};
test('live projection follows pointer immediately, never accumulates deltas, moves authored sibling children and restores exact attributes',()=>{
 const subject=element(50,65,'original transform'),child=element(70,95,null),unrelated=element(90,110,'untouched');
 const layers=[{data:{ind:1},layerElement:subject},{data:{ind:2,parent:1},layerElement:child},{data:{ind:3},layerElement:unrelated}],node={id:'selected',kind:'layer',layerRoute:[0],shapeRoute:[]};
 const live=createLiveLottieTransform({elements:layers},[node]);
 assert.equal(live.preview(node.id,[1,0,0,1,12,9]),true);matrixNear(subject,[1,0,0,1,26,18]);matrixNear(child,[1,0,0,1,36,28]);assert.equal(unrelated.getAttribute(),'untouched');
 live.preview(node.id,[1,0,0,1,2,3]);matrixNear(subject,[1,0,0,1,21,16]);live.clear();assert.equal(subject.getAttribute(),'original transform');assert.equal(child.getAttribute(),null);
 assert.deepEqual(layers[1].data,{ind:2,parent:1});
});
test('an unavailable sibling matrix rejects the entire live preview without partial paint changes',()=>{
 const subject=element(50,65,'original'),child=element(70,95,'child');child.getScreenCTM=()=>null;
 const live=createLiveLottieTransform({elements:[{data:{ind:1},layerElement:subject},{data:{ind:2,parent:1},layerElement:child}]},[{id:'x',kind:'layer',layerRoute:[0],shapeRoute:[]}]);
 assert.equal(live.preview('x',[1,0,0,1,12,9]),false);assert.equal(subject.getAttribute(),'original');assert.equal(child.getAttribute(),'child');
});

