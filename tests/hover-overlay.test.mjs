import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLottieHighlight} from '../dist/highlight.js';
import {createConstructionOverlay} from '../dist/construction.js';
import {svgFixture} from './svg-dom.mjs';
const node={id:'path',parentId:null,kind:'path',selectable:true,layerRoute:[0],shapeRoute:[0]};
test('hover paints above later authored layers and mirrors transforms/clips without copying source opacity or identity',()=>{
 const f=svgFixture();f.group.setAttribute('transform','matrix(2,0,0,2,10,30)');f.group.setAttribute('clip-path','url(#crop)');f.group.setAttribute('mask','url(#mask)');f.group.setAttribute('opacity','0.2');f.group.setAttribute('id','authored-layer');
 f.paint.setAttribute('d','authored aggregate');
 const view={caches:['M1 2L3 4'],styles:[{pElem:f.paint}]},renderer={elements:[{itemsData:[view]}]};
 const highlight=createLottieHighlight(renderer,[node]);highlight.update([],['path']);
 const layer=f.svg.children.at(-1);assert.notEqual(layer,f.cover);assert.equal(layer.getAttribute('data-lottie-hover-layer'),'');
 const wrapper=layer.children[0];assert.equal(wrapper.getAttribute('transform'),'matrix(2,0,0,2,10,30)');assert.equal(wrapper.getAttribute('clip-path'),'url(#crop)');assert.equal(wrapper.getAttribute('mask'),'url(#mask)');
 assert.equal(wrapper.getAttribute('opacity'),null);assert.equal(wrapper.getAttribute('id'),null);
 assert.deepEqual(wrapper.children.map(e=>e.getAttribute('stroke')),['#112b40','#95afbd']);
 assert.equal(wrapper.children[1].getAttribute('d'),'M1 2L3 4');assert.equal(wrapper.children[1].getAttribute('opacity'),'1');
 assert.equal(f.paint.getAttribute('d'),'authored aggregate');assert.equal(layer.getAttribute('pointer-events'),'none');
 view.caches[0]='M5 6L7 8';f.group.setAttribute('transform','translate(40,50)');highlight.update([],['path']);
 assert.equal(f.svg.children.length,3);assert.equal(f.svg.children.at(-1).children[0].getAttribute('transform'),'translate(40,50)');assert.equal(f.svg.children.at(-1).children[0].children[1].getAttribute('d'),'M5 6L7 8');
 highlight.dispose();assert.deepEqual(f.svg.children,[f.group,f.cover]);
});
test('hidden geometry produces no front hover, and selection retains priority over hover on the same path',()=>{
 const f=svgFixture(),renderer={elements:[{itemsData:[{caches:['M0 0L10 10'],styles:[{pElem:f.paint}]}]}]};
 const highlight=createLottieHighlight(renderer,[node]);highlight.update([],['path']);assert.equal(f.svg.children.length,3);
 f.group.setAttribute('visibility','hidden');highlight.update([],['path']);assert.equal(f.svg.children.length,2);
 f.group.removeAttribute('visibility');highlight.update(['path'],['path']);assert.equal(f.svg.children.length,3);assert.equal(f.svg.children.at(-1).getAttribute('data-lottie-selection-layer'),'');assert.equal(f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-highlight')==='path').getAttribute('stroke-width'),'3');
 highlight.update([],[]);assert.deepEqual(f.group.children,[f.paint]);highlight.dispose();
});

test('construction guides are in the front interaction layer, inherit spatial clipping, and clean up',()=>{
 const f=svgFixture();f.paint.getScreenCTM=()=>({a:1,b:0,c:0,d:1,e:0,f:0});f.group.setAttribute('clip-path','url(#crop)');
 const renderer={elements:[{itemsData:[{caches:['M0 0C0 10 10 10 10 0Z'],styles:[{pElem:f.paint}]}]}]};
 const construction=createConstructionOverlay(renderer,[node]);construction.update(['path']);
 assert.equal(f.svg.children.at(-1).getAttribute('data-lottie-construction-layer'),'');
 assert.equal(f.svg.children.at(-1).children[0].getAttribute('clip-path'),'url(#crop)');
 assert.equal(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-construction')==='path').length,1);
 construction.clear();assert.deepEqual(f.svg.children,[f.group,f.cover]);
});

test('global outlines are transient, behind hover/selection, hide with source and never overwrite paint',()=>{
 const f=svgFixture(),view={caches:['M0 0L10 10'],styles:[{pElem:f.paint}]},renderer={elements:[{itemsData:[view]}]};f.paint.setAttribute('d','authored');
 const other={...node,id:'other',shapeRoute:[1]};renderer.elements[0].itemsData.push({caches:['M3 3L7 7'],styles:[{pElem:f.paint}]});
 const highlight=createLottieHighlight(renderer,[node,other]);highlight.update([],[],true);
 assert.equal(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-outline')).length,2);assert.equal(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-highlight')).length,0);
 assert.equal(f.paint.getAttribute('d'),'authored');assert.equal(f.svg.children.at(-1).getAttribute('pointer-events'),'none');
 highlight.update(['path'],[],true);assert.equal(f.svg.children.at(-1).getAttribute('data-lottie-selection-layer'),'');
 view.caches[0]='M10 10L20 20';highlight.update([],[],true);assert.equal(f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-outline')==='path').getAttribute('d'),view.caches[0]);
 f.group.setAttribute('display','none');highlight.update([],[],true);assert.deepEqual(f.svg.children,[f.group,f.cover]);
 f.group.removeAttribute('display');highlight.update(['path'],[],false);assert.equal(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-outline')).length,0);assert.equal(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-highlight')).length,1);highlight.dispose();
});
test('retains context/hover layers across pointer reads and syncs changed spatial ancestry without replacing authored paint',()=>{
 const f=svgFixture(),view={caches:['M0 0L10 10'],styles:[{pElem:f.paint}]},renderer={elements:[{itemsData:[view]}]},highlight=createLottieHighlight(renderer,[node]);
 highlight.update([],[],true);const context=f.svg.children.at(-1);
 highlight.update([],[],true);assert.equal(f.svg.children.at(-1),context);
 f.group.setAttribute('transform','translate(30,40)');highlight.update([],[],true);assert.equal(f.svg.children.at(-1),context);assert.equal(context.children[0].getAttribute('transform'),'translate(30,40)');
 highlight.update([],['path'],true);const hover=f.svg.children.at(-1);
 view.caches[0]='M2 2L20 20';highlight.update([],['path'],true);assert.equal(f.svg.children.at(-1),hover);assert.equal(hover.children[0].children[0].getAttribute('d'),view.caches[0]);
 const camera=f.doc.createElementNS('http://www.w3.org/2000/svg','g');f.svg.append(camera);camera.append(f.group);camera.setAttribute('transform','scale(2)');highlight.update([],['path'],true);
 assert.notEqual(f.svg.children.at(-1),hover);assert.equal(f.svg.children.at(-1).children[0].getAttribute('transform'),'scale(2)');
 highlight.dispose();assert.deepEqual(f.group.children,[f.paint]);
});
