import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyLottiePath as classify,classifyStaticSourcePath,sourcePathClosure,lottiePathTypes} from '../dist/pathTypes.js';
import {normalizeLottiePathAppearance as appearance,normalizeLottiePathView} from '../dist/pathAppearance.js';
import {createLottieHighlight} from '../dist/highlight.js';
import {createConstructionOverlay} from '../dist/construction.js';
import {svgFixture} from './svg-dom.mjs';
test('typology precedence keeps masks and authored parametric shapes distinct from their cubic projection',()=>{
 const d='M0 0C0 10 10 10 10 0Z';
 for(const [node,type] of [[{kind:'mask'},'masked-solid'],[{kind:'layer',solid:'single-additive'},'masked-solid'],[{kind:'layer',solid:'unmasked'},'solid'],[{kind:'shape',sourceType:'el'},'ellipse'],[{kind:'shape',sourceType:'rc'},'rectangle'],[{kind:'shape',sourceType:'sr'},'star']])assert.equal(classify(node,d),type);
});
test('straightness and closure form unambiguous categories including straight cubics and coincident open endpoints',()=>{
 for(const [d,type] of [['M0 0L10 0','line-open'],['M0 0L10 0L10 10Z','line-closed'],['M0 0C0 0 10 0 10 0','line-open'],['M0 0C0 10 10 10 10 0','bezier-open'],['M0 0C0 10 10 10 10 0Z','bezier-closed'],['M0 0L10 0Z M20 0L30 0','line-open']])assert.equal(classify({kind:'path'},d),type);
 assert.equal(classify({kind:'path',sourceClosed:false},'M0 0C0 10 10 10 0 0'),'bezier-open');assert.equal(classify({kind:'path'},'M0 0Q10 0 0 0'),'path');
});
test('tree categories use real static vertices/tangents and explicit source closure',()=>{
 const line={v:[[0,0],[10,0],[10,10]],i:[[0,0],[0,0],[0,0]],o:[[0,0],[0,0],[0,0]],c:true};assert.equal(classifyStaticSourcePath(line),'line-closed');
 assert.equal(classifyStaticSourcePath({...line,o:[[0,5],[0,0],[0,0]]}),'bezier-closed');
 assert.equal(sourcePathClosure({k:[{s:[{c:true}],e:[{c:true}]}]}),true);assert.equal(sourcePathClosure({k:[{s:[{c:true}],e:[{c:false}]}]}),undefined);
});
test('color mode is backward compatible and preserves the manual color through switches and restoration',()=>{
 const saved=appearance({color:'#123456',opacity:.4,width:1.25,handles:true});const typed=appearance({colorMode:'type'},saved);assert.equal(typed.color,'#123456');assert.equal(appearance({colorMode:'uniform'},typed).color,'#123456');
 assert.equal(normalizeLottiePathView({showPaths:true,appearance:typed}).appearance.colorMode,'type');assert.equal(normalizeLottiePathView({appearance:{color:'#123456'}}).appearance.colorMode,'uniform');assert.equal(appearance({colorMode:'unknown'},typed).colorMode,'type');
});
test('global and selected contours and handles share type color, with independent emphasis',()=>{
 const f=svgFixture();f.paint.getScreenCTM=()=>({a:1,b:0,c:0,d:1,e:0,f:0});const node={id:'p',kind:'path',selectable:true,layerRoute:[0],shapeRoute:[0]},renderer={elements:[{itemsData:[{caches:['M0 0C0 10 10 10 10 0Z'],styles:[{pElem:f.paint}]}]}]},style=appearance({colorMode:'type',handles:true});
 const h=createLottieHighlight(renderer,[node]),c=createConstructionOverlay(renderer,[node]);h.update([],[],true,style);c.update(['p'],style);
 const outline=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-outline'));const controls=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-global-construction'));
 assert.equal(outline.getAttribute('data-lottie-path-type'),'bezier-closed');assert.equal(outline.getAttribute('stroke'),lottiePathTypes['bezier-closed'].color);assert.ok(controls.children.every(e=>e.getAttribute('stroke')===outline.getAttribute('stroke')));
 h.update(['p'],[],true,style);assert.equal(f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-highlight')).getAttribute('stroke'),lottiePathTypes['bezier-closed'].color);c.update(['p'],undefined,1,style);assert.ok(f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-construction')).children.every(e=>e.getAttribute('stroke')===lottiePathTypes['bezier-closed'].color));h.dispose();c.clear();
});

test('type observations are immutable, deduplicated and clear stale source entries',async()=>{
 const {createLottiePathTypeObservation}=await import('../dist/pathTypes.js');const observation=createLottiePathTypeObservation();let changes=0;const release=observation.subscribe(()=>changes++);const value={p:'ellipse'};observation.publish(value);value.p='solid';assert.equal(observation.read().p,'ellipse');observation.publish({p:'ellipse'});assert.equal(changes,1);observation.publish({});assert.deepEqual(observation.read(),{});release();observation.publish({q:'solid'});assert.equal(changes,2);
});
test('tree uses evaluated categories, neutral empty containers and uniform manual appearance',async()=>{
 const {lottieNodePresentation:present}=await import('../dist/nodePresentation.js');
 const animated={kind:'path',sourceType:'sh',animatedPath:true};for(const type of ['line-open','line-closed','bezier-open','bezier-closed']){const result=present(animated,{colorMode:'type',evaluatedType:type});assert.equal(result.tone,lottiePathTypes[type].color);assert.equal(result.label,lottiePathTypes[type].label);}
 assert.equal(present({kind:'group',sourceType:'gr'},{colorMode:'type'}).tone,'#aab3bf');assert.equal(present({kind:'mask',sourceType:'mask'},{colorMode:'type'}).tone,lottiePathTypes['masked-solid'].color);assert.equal(present({kind:'shape',sourceType:'el'},{colorMode:'uniform',color:'#123456'}).tone,'#123456');
});
