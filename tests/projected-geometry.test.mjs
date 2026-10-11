import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectedPathBounds} from '../dist/projectedGeometry.js';
test('cubic bounds include interior extrema, not merely vertices or control hull',()=>{
 assert.deepEqual(projectedPathBounds('M0 0C0 100 100 100 100 0Z'),{x:0,y:0,width:100,height:75});
 assert.deepEqual(projectedPathBounds('M0 0C0 -100 100 -100 100 0Z'),{x:0,y:-75,width:100,height:75});
 assert.deepEqual(projectedPathBounds('M0 0C100 0 -100 0 0 0L0 10Z').height,10);
 const b=projectedPathBounds('M0 0C100 0 -100 0 0 0L0 10Z');assert.ok(Math.abs(b.x+28.867513459481287)<1e-9);assert.ok(Math.abs(b.width-57.735026918962575)<1e-9);
});
test('unsupported or invalid geometry remains unqualified',()=>{
 for(const d of ['', 'M0 0Q5 5 10 0','M0 0C10 NaN 20 30 40 50','M0 0A10 10 0 1 0 10 10'])assert.equal(projectedPathBounds(d),null);
});
