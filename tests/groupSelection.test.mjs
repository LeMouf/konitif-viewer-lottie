import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readGroupSelection} from '../dist/groupSelection.js';
const node=(id,parentId,kind,sourceType)=>({id,parentId,kind,sourceType,selectable:true,layerRoute:[0],shapeRoute:[],depth:0,label:id});
const nodes=[node('parent',null,'group','gr'),node('a','parent','shape','el'),node('b','parent','shape','rc'),node('unsupported','parent','path','sh'),node('other',null,'shape','el')];
const box=(id,left,top,right,bottom)=>({id,bounds:{left,top,right,bottom,width:right-left,height:bottom-top}});
test('group box unions only observed descendants, preserves mixed lineage and ignores siblings',()=>{
 const value=readGroupSelection(nodes,['parent','a','b','unsupported'],[box('a',10,20,30,40),box('b',50,60,80,90),box('other',-100,-100,300,300)]);
 assert.deepEqual(value.bounds,{left:10,top:20,right:80,bottom:90,width:70,height:70});
 assert.deepEqual(value.colors,['#009e73','#f0e442','#ffffff']);assert.equal(value.count,2);assert.deepEqual(value.roots,['parent']);
});
test('group bounds follow fresh frame/view observations and omit invisible or unsupported geometry',()=>{
 assert.equal(readGroupSelection(nodes,['parent'],[]),null);
 assert.deepEqual(readGroupSelection(nodes,['parent'],[box('a',20,40,60,80)]).bounds,{left:20,top:40,right:60,bottom:80,width:40,height:40});
 assert.equal(readGroupSelection(nodes,['a'],[box('a',20,40,60,80)]),null);
 assert.deepEqual(readGroupSelection(nodes,['a','b'],[box('a',0,0,5,5),box('b',10,0,15,5)]).bounds,{left:0,top:0,right:15,bottom:5,width:15,height:5});
});
