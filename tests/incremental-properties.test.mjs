import test from 'node:test';import assert from 'node:assert/strict';
import {patchNativeNumericProperties} from '../dist/incrementalProperties.js';
test('admission is atomic and leaves native caches unchanged on unsupported changes',()=>{
 const before={layers:[{ks:{p:{a:0,k:[0,0,0]},r:{a:0,k:0}}}]},native=structuredClone(before),p={data:native.layers[0].ks.p,kf:false,effectsSequence:[],getValue(){},setVValue(){},addEffect(f){this.effectsSequence.push(f);}},renderer={elements:[{p}],renderedFrame:0};
 const after=structuredClone(before);after.layers[0].ks.p.k=[10,20,0];after.layers[0].ks.r={a:1,k:[{t:0,s:[0]},{t:30,s:[90]}]};assert.equal(patchNativeNumericProperties(native,renderer,before,after),false);assert.deepEqual(native,before);assert.equal(p.effectsSequence.length,0);assert.equal(renderer.renderedFrame,0);
 delete after.layers[0].ks.r;assert.equal(patchNativeNumericProperties(native,renderer,before,after),false);assert.deepEqual(native,before);
});
test('static edits retain native objects and register the same effect only once',()=>{
 const before={p:{a:0,k:[0,0]}},native=structuredClone(before),p={data:native.p,kf:false,effectsSequence:[],getValue(){},setVValue(){},addEffect(f){this.effectsSequence.push(f);}},renderer={elements:[{p}],renderedFrame:0},after={p:{a:0,k:[10,20]}};
 assert.equal(patchNativeNumericProperties(native,renderer,before,after),true);assert.deepEqual(p.effectsSequence[0](),[10,20]);assert.equal(renderer.renderedFrame,null);assert.equal(patchNativeNumericProperties(native,renderer,after,before),true);assert.deepEqual(p.effectsSequence[0](),[0,0]);assert.equal(p.effectsSequence.length,1);
});


test('updates all native occurrences sharing a source property',()=>{
 const before={p:{a:0,k:[0,0]}},native=structuredClone(before),make=()=>({data:native.p,kf:false,effectsSequence:[],getValue(){},setVValue(){},addEffect(f){this.effectsSequence.push(f);}}),a=make(),b=make(),renderer={elements:[{p:a},{p:b}]};
 assert.equal(patchNativeNumericProperties(native,renderer,before,{p:{a:0,k:[10,20]}}),true);assert.deepEqual(a.effectsSequence[0](),[10,20]);assert.deepEqual(b.effectsSequence[0](),[10,20]);
});
