import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDepthPickCycle} from '../dist/picking.js';
test('cycles top to bottom and wraps, with five-pixel tolerance and no hover authority',()=>{
 const cycle=createDepthPickCycle(),ids=['front','middle','back'];
 assert.equal(cycle.pick(10,10,'source/frame',ids,[]),'front');
 assert.equal(cycle.pick(12,11,'source/frame',ids,['front']),'middle');
 assert.equal(cycle.pick(12,11,'source/frame',ids,['middle']),'back');
 assert.equal(cycle.pick(12,11,'source/frame',ids,['back']),'front');
});
test('resets on movement, time/source change, candidate change, external selection and empty space',()=>{
 for(const next of [
  [20,10,'s/t',['front','back'],['front']],
  [10,10,'s/t2',['front','back'],['front']],
  [10,10,'other/t',['front','back'],['front']],
  [10,10,'s/t',['front','new'],['front']],
  [10,10,'s/t',['front','back'],['external']]
 ]) {const cycle=createDepthPickCycle();cycle.pick(10,10,'s/t',['front','back'],[]);assert.equal(cycle.pick(...next),'front');}
 const cycle=createDepthPickCycle();assert.equal(cycle.pick(0,0,'s/t',[],[]),null);
 cycle.pick(0,0,'s/t',['front','back'],[]);cycle.reset();assert.equal(cycle.pick(0,0,'s/t',['front','back'],['front']),'front');
});
