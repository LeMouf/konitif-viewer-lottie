import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indexLottiePaths,selectedPathLeaves} from '../dist/paths.js';
import {resolveSolidProjection} from '../dist/solid.js';
const source=mask=>({id:'s',revision:'1',data:{w:690,h:913,fr:30,ip:0,op:392,layers:[{ty:1,nm:'Shadow',sw:690,sh:913,sc:'#5eac9d',masksProperties:mask?[mask]:[]}]}});
const additive={mode:'a',inv:false,cl:true,o:{k:100},x:{k:0},pt:{k:{v:[[1,1]],i:[[0,0]],o:[[0,0]],c:true}}};
test('solid identity remains a layer, simple additive mask is qualified and complex masks stay structure-selectable',()=>{
 const indexed=indexLottiePaths(source(additive)),n=indexed[0];assert.equal(indexed[1].kind,'mask');assert.match(indexed[1].id,/\/masks\/0\/pt$/);assert.equal(indexed[1].parentId,n.id);assert.equal(indexed[1].selectable,true);assert.equal(n.kind,'layer');assert.equal(n.solid,'single-additive');assert.equal(n.selectable,true);assert.deepEqual(selectedPathLeaves(indexed,[n.id]),[n]);assert.deepEqual(selectedPathLeaves(indexed,[indexed[1].id]),[indexed[1]]);
 for(const mask of [{...additive,inv:true},{...additive,mode:'s'},{...additive,o:{k:50}},{...additive,x:{k:10}},{...additive,cl:false}]){const node=indexLottiePaths(source(mask))[0];assert.equal(node.solid,'unsupported');assert.equal(node.selectable,true);}
});
function element(tagName,attrs={},children=[]){return{tagName,children,getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs};}
test('masked solid uses the current exact mask path, requires full containment and rejects transformed/multiple masks',()=>{
 let d='M10 20C10 10 50 10 50 20Z';const mask=element('path');mask.getAttribute=k=>k==='d'?d:null;mask.getBBox=()=>({x:10,y:10,width:40,height:20});
 const def=element('clipPath',{},[mask]);const rect=element('rect');rect.getBBox=()=>({x:0,y:0,width:690,height:913});rect.ownerDocument={getElementById:()=>def};
 const layer=element('g',{'clip-path':'url(#shadow)'},[rect]),node={solid:'single-additive'};
 assert.deepEqual(resolveSolidProjection(layer,node),{path:rect,d,qualifiedClip:def});
 d='M20 30L40 30L40 50Z';assert.equal(resolveSolidProjection(layer,node).d,d);
 d='M-1 10L39 10L39 30Z';assert.equal(resolveSolidProjection(layer,node),null);
 d='M20 30L40 30L40 50Z';
 mask.getBBox=()=>({x:10,y:10,width:40,height:20});def.children.push(mask);assert.equal(resolveSolidProjection(layer,node),null);
 def.children.pop();mask.hasAttribute=k=>k==='transform';assert.equal(resolveSolidProjection(layer,node),null);
 assert.equal(resolveSolidProjection(layer,{solid:'unsupported'}),null);
});

test('Firefox empty or throwing clip-path getBBox cannot reject a valid authored mask',()=>{
 const mask=element('path',{d:'M10 20C10 10 50 10 50 20C50 30 10 30 10 20'});
 const def=element('clipPath',{},[mask]),rect=element('rect');rect.getBBox=()=>({x:0,y:0,width:100,height:100});rect.ownerDocument={getElementById:()=>def};
 const layer=element('g',{'clip-path':'url(#shadow)'},[rect]);
 for(const native of [()=>({x:0,y:0,width:0,height:0}),()=>{throw Error('unrendered clipPath');}]){mask.getBBox=native;assert.ok(resolveSolidProjection(layer,{solid:'single-additive'}));}
});

import {onionSelectedPaint} from '../dist/onionComposition.js';
test('onion selection of a masked solid or its mask keeps the native rect and mask together',()=>{
 const mask=element('path',{d:'M10 10L50 10L50 30L10 30Z'});mask.getBBox=()=>({x:10,y:10,width:40,height:20});
 const def=element('clipPath',{},[mask]),rect=element('rect');rect.getBBox=()=>({x:0,y:0,width:690,height:913});rect.ownerDocument={getElementById:()=>def};
 const layer=element('g',{'clip-path':'url(#shadow)'},[rect]),nodes=indexLottiePaths(source(additive)),renderer={elements:[{layerElement:layer}]};
 for(const selected of [[nodes[0].id],[nodes[1].id],[nodes[0].id,nodes[1].id]]){const kept=onionSelectedPaint(renderer,nodes,selected,[]);assert.equal(kept.size,1);assert.equal(kept.has(rect),true);assert.equal(kept.get(rect),undefined);}
 assert.equal(onionSelectedPaint(renderer,nodes,[nodes[1].id],[nodes[0].id]).size,0);
});
