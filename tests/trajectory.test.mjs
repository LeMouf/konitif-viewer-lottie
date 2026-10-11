import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleTrajectory,trajectoryPath,trajectoryEvaluationData,admitsStaticTrajectory} from '../dist/trajectory.js';
import {normalizeLottiePathView} from '../dist/pathAppearance.js';
test('static trajectory admission refuses animated properties, visibility gaps and shifted precomposition clocks',()=>{
 const data={layers:[{ty:4,ip:0,op:30,ks:{p:{a:0,k:[12,30]}}}],assets:[{layers:[{ty:4,ip:0,op:30,ks:{r:{a:0,k:20}}}]}]};
 assert.equal(admitsStaticTrajectory(data,0,30),true);
 for(const patch of [{ip:1},{op:29},{st:5},{sr:2},{tm:{a:0,k:0}}]){const next=structuredClone(data);Object.assign(next.assets[0].layers[0],patch);assert.equal(admitsStaticTrajectory(next,0,30),false);}
 const next=structuredClone(data);next.layers[0].ks.p={a:1,k:[{t:0,s:[0,0]},{t:30,s:[20,20]}]};assert.equal(admitsStaticTrajectory(next,0,30),false);
 const expression=structuredClone(data);expression.layers[0].ks.p.x='time';assert.equal(admitsStaticTrajectory(expression,0,30),false);
});
test('trajectory samples the exact terminal origin, refines curves and stays bounded without forced closure',async()=>{
 const samples=await sampleTrajectory(0,120,t=>({x:t,y:100*Math.sin(t/120*Math.PI)}));
 assert.equal(samples[0].frame,0);assert.equal(samples.at(-1).frame,120);assert.equal(samples.at(-1).point.x,120);assert.ok(samples.length<=512);assert.ok(samples.some(s=>s.point.y>99));assert.ok(!trajectoryPath(samples).includes('Z'));
});
test('trajectory keeps visibility gaps separate and stops stale work',async()=>{
 const samples=await sampleTrajectory(0,4,t=>t>1&&t<3?null:{x:t,y:0});assert.equal((trajectoryPath(samples).match(/M/g)||[]).length,2);
 let calls=0;await assert.rejects(sampleTrajectory(0,100,t=>{calls++;return{x:t,y:0};},()=>calls>=16),/cancelled/);assert.equal(calls,16);
});
test('terminal inclusion changes only auxiliary layer visibility and leaves source keys and duration immutable',()=>{
 const data={ip:0,op:120,layers:[{ty:4,op:120,ks:{p:{a:1,k:[{t:120,s:[20,30]}]}}}],assets:[{layers:[{ty:4,op:60,ks:{}}]}]},before=JSON.stringify(data),clone=trajectoryEvaluationData(data);
 assert.equal(JSON.stringify(data),before);assert.equal(clone.op,120);assert.equal(clone.layers[0].op,120.000001);assert.deepEqual(clone.layers[0].ks,data.layers[0].ks);assert.equal(clone.assets[0].layers[0].op,60.000001);
});
test('Path view state persists independently and old presets default to disabled',()=>{
 assert.equal(normalizeLottiePathView({appearance:{onionEnabled:true}}).appearance.trajectoryEnabled,false);
 const value=normalizeLottiePathView({showPaths:false,appearance:{trajectoryEnabled:true,onionEnabled:false}});assert.deepEqual(normalizeLottiePathView(JSON.parse(JSON.stringify(value))),value);
});
