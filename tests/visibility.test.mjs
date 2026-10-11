import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lottieAncestors,isLottieNodeHidden,lottieVisibilityState,createLottieVisibility} from '../dist/visibility.js';
import {createLottieHighlight} from '../dist/highlight.js';
import {svgFixture} from './svg-dom.mjs';
const nodes=[{id:'comp',parentId:null,kind:'precomposition',layerRoute:[0],shapeRoute:[]},
 {id:'layer',parentId:'comp',kind:'layer',layerRoute:[0,0],shapeRoute:[]},
 {id:'path',parentId:'layer',kind:'path',layerRoute:[0,0],shapeRoute:[0],selectable:true}];
test('visibility distinguishes explicit, inherited and mixed states without conflating tree expansion',()=>{
 assert.deepEqual(lottieAncestors(nodes,'path'),['layer','comp']);
 assert.equal(isLottieNodeHidden(nodes,'path',['comp']),true);
 assert.equal(lottieVisibilityState(nodes,'comp',['layer']),'mixed');
 assert.equal(lottieVisibilityState(nodes,'layer',['comp']),'inherited');
 assert.equal(lottieVisibilityState(nodes,'layer',['layer']),'hidden');
 assert.equal(lottieVisibilityState(nodes,'path',[]),'visible');
});
test('visibility changes only layer projection attributes and restores pre-existing values on cleanup',()=>{
 const attrs=new Map([['visibility','visible']]);const element={getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const visibility=createLottieVisibility({elements:[{elements:[{baseElement:element}]}]},nodes);
 visibility.update(['path']);assert.equal(attrs.get('visibility'),'visible');
 visibility.update(['layer']);assert.equal(attrs.get('visibility'),'hidden');visibility.update([]);assert.equal(attrs.get('visibility'),'visible');
 visibility.update(['layer']);visibility.dispose();assert.equal(attrs.get('visibility'),'visible');
});
test('hover has dashed thin overlay, selection takes precedence, authored paint stays intact',()=>{
 const f=svgFixture(),path=f.paint;
 const renderer={elements:[{elements:[{itemsData:[{caches:['M0 0L1 1'],styles:[{pElem:path}]}]}]}]};
 const highlight=createLottieHighlight(renderer,nodes);highlight.update([],['path']);
 const hover=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-hover')==='path');
 assert.equal(hover.getAttribute('stroke-width'),'1.5');assert.equal(hover.getAttribute('stroke-dasharray'),'5 3');
 highlight.update(['path'],['path']);assert.equal(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-hover')).length,0);
 assert.equal(f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-highlight')==='path').getAttribute('stroke-width'),'3');highlight.dispose();
});
