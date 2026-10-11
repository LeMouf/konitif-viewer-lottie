import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendLottieBezier,defaultLottiePenStyle} from '../dist/drawing.js';
import {inspectLottieProfile} from '../dist/profile.js';
const data={v:'5.13.0',w:512,h:512,fr:60,ip:0,op:120,layers:[]},vertices=[{point:[100,120],in:[-20,0],out:[20,0]},{point:[300,240],in:[0,0],out:[0,0]}];
test('empty document and static open Bezier preserve source and explicit style dialect',()=>{
 assert.equal(inspectLottieProfile(data).durationSeconds,2);const before=JSON.stringify(data);
 for(const [v,expected]of [['5.13.0',[86/255,180/255,233/255]],['4.0.0',[86,180,233]]]){const result=appendLottieBezier({...data,v},vertices,defaultLottiePenStyle),group=result.data.layers[0].shapes[0];assert.equal(result.index,0);assert.equal(group.it[0].ks.a,0);assert.equal(group.it[0].ks.k.c,false);assert.deepEqual(group.it[0].ks.k.v,[[0,0],[200,120]]);assert.deepEqual(group.it[1].c.k,expected);assert.equal(group.it[2].ty,'tr');assert.equal(group.it.some(s=>s.ty==='fl'),false);}
 assert.equal(JSON.stringify(data),before);assert.deepEqual(vertices[0].point,[100,120]);
});
test('invalid or excessive draft geometry and contour cannot create source paint',()=>{
 for(const points of [[],[vertices[0]],Array(513).fill(vertices[0]),[{...vertices[0],point:[NaN,0]},vertices[1]]])assert.throws(()=>appendLottieBezier(data,points,defaultLottiePenStyle));
 for(const style of [{...defaultLottiePenStyle,width:0},{...defaultLottiePenStyle,opacity:101},{...defaultLottiePenStyle,color:'invalid'}])assert.throws(()=>appendLottieBezier(data,vertices,style));assert.deepEqual(data.layers,[]);
});