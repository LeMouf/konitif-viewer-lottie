import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLottiePathAppearance as normalize,defaultLottiePathAppearance as defaults} from '../dist/pathAppearance.js';
import {createLottieHighlight} from '../dist/highlight.js';
import {createConstructionOverlay} from '../dist/construction.js';
import {svgFixture} from './svg-dom.mjs';
const node={id:'path',parentId:null,kind:'path',selectable:true,layerRoute:[0],shapeRoute:[0]};
test('appearance accepts bounded view values and preserves prior settings on invalid input',()=>{
 assert.deepEqual(normalize({colorMode:'uniform',color:'#FF8800',opacity:4,width:100,handles:true}),{...defaults,rulers:false,grid:false,axes:false,cropViewport:true,colorMode:'uniform',color:'#ff8800',opacity:1,width:2.5,handles:true});
 assert.deepEqual(normalize({colorMode:'uniform',color:'url(secret)',opacity:NaN,width:Infinity,handles:'yes'}),defaults);
 assert.deepEqual(normalize({opacity:-1,width:0}),{...defaults,opacity:0,width:.25});
 const previous={rulers:true,grid:true,axes:true,cropViewport:false,colorMode:'uniform',color:'#112233',opacity:.3,width:1.5,handles:true};assert.deepEqual(normalize({colorMode:'uniform',color:'bad'},previous),{...defaults,...previous});
});
test('uniform appearance colors context and selected geometry; emphasis and hover stay distinct',()=>{
 const f=svgFixture(),renderer={elements:[{itemsData:[{caches:['M0 0L10 10'],styles:[{pElem:f.paint}]}]}]},highlight=createLottieHighlight(renderer,[node]),style=normalize({colorMode:'uniform',color:'#ff8800',opacity:.4,width:2.5});
 highlight.update([],[],true,style);let path=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-outline'));assert.equal(path.getAttribute('stroke'),'#ff8800');assert.equal(path.getAttribute('opacity'),'0.4');assert.equal(path.getAttribute('stroke-width'),'2.5');
 highlight.update([],['path'],true,style);path=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-hover'));assert.equal(path.getAttribute('stroke'),'#ff8800');assert.equal(path.getAttribute('stroke-dasharray'),'5 3');
 highlight.update(['path'],[],true,style);path=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-highlight'));assert.equal(path.getAttribute('stroke'),'#ff8800');assert.equal(path.getAttribute('stroke-width'),'3');highlight.dispose();
});
test('global handles use current geometry and appearance, respect visibility and dispose',()=>{
 const f=svgFixture();f.paint.getScreenCTM=()=>({a:2,b:0,c:0,d:2,e:10,f:30});
 const renderer={elements:[{itemsData:[{caches:['M0 0C0 10 10 10 10 0Z'],styles:[{pElem:f.paint}]}]}]},overlay=createConstructionOverlay(renderer,[node]),style=normalize({colorMode:'uniform',color:'#ff8800',opacity:.4,handles:true});
 overlay.update(['path'],style);const group=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-global-construction'));
 assert.equal(group.getAttribute('opacity'),'0.4');assert.equal(group.getAttribute('pointer-events'),'none');assert.ok(group.children.every(e=>e.getAttribute('stroke')==='#ff8800'));assert.ok(!f.descendants(f.svg).some(e=>e.getAttribute('data-lottie-construction')));
 f.group.setAttribute('display','none');overlay.update(['path'],style);assert.deepEqual(f.svg.children,[f.group,f.cover]);overlay.clear();
});

test('selected and global construction markers follow view zoom equally',()=>{
 const f=svgFixture();f.paint.getScreenCTM=()=>({a:2,b:0,c:0,d:2,e:0,f:0});
 const renderer={elements:[{itemsData:[{caches:['M0 0C0 10 10 10 10 0Z'],styles:[{pElem:f.paint}]}]}]},overlay=createConstructionOverlay(renderer,[node]);
 for(const context of [undefined,normalize({handles:true})]){
  overlay.update(['path'],context,1);const base=f.descendants(f.svg).find(e=>e.getAttribute('fill')==='#ffffff').getAttribute('d');
  overlay.update(['path'],context,2);const zoomed=f.descendants(f.svg).find(e=>e.getAttribute('fill')==='#ffffff').getAttribute('d');
  assert.equal(base,'M-1.5,-1.5L1.5,-1.5L1.5,1.5L-1.5,1.5Z');assert.equal(zoomed,'M-3,-3L3,-3L3,3L-3,3Z');
 }overlay.clear();
});
