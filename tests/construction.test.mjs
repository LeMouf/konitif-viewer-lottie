import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectProjectedConstruction,isStraightCubic,screenSquare} from '../dist/construction.js';
test('inspects evaluated cubic vertices, controls, straight segments and close without editing input',()=>{
 const d='M0,0 C0,0 10,0 10,0 C12,0 12,10 10,10 L0,0z';
 const geometry=inspectProjectedConstruction(d);
 assert.equal(geometry.vertices.length,3);assert.equal(geometry.segments.length,3);
 assert.deepEqual(geometry.segments.map(s=>s.straight),[true,false,true]);
 assert.deepEqual(geometry.segments[1].c1,{x:12,y:0});
 assert.equal(inspectProjectedConstruction('M0 0 C0 0 20 0 20 0').vertices[1].x,20);
 assert.throws(()=>inspectProjectedConstruction('M0 0 A1 1 0 0 0 2 2'));
 assert.throws(()=>inspectProjectedConstruction('M0 0 C1 2'));
});
test('does not label an overshooting collinear cubic as a straight segment',()=>{
 assert.equal(isStraightCubic({x:0,y:0},{x:-5,y:0},{x:15,y:0},{x:10,y:0}),false);
});
test('construction squares stay six screen pixels under rotation, scaling and translation',()=>{
 const matrix={a:0,b:2,c:-3,d:0,e:100,f:40},center={x:12,y:8};
 const projected=screenSquare(center,matrix).map(p=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f}));
 assert.deepEqual(projected,[{x:73,y:61},{x:79,y:61},{x:79,y:67},{x:73,y:67}]);
 assert.deepEqual(screenSquare(center,{a:0,b:0,c:0,d:0,e:0,f:0}),[]);
});
