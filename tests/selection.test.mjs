import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexLottiePaths, selectedPathLeaves } from '../dist/index.js';
import { resolveProjectedPath, createLottieHighlight } from '../dist/highlight.js';
import {svgFixture} from './svg-dom.mjs';
import { createLottieReadingSession } from '../dist/session.js';

const source = () => ({id:'source',revision:'r1',label:'Source',data:{w:100,h:100,fr:30,ip:0,op:390,
  layers:[{ty:0,refId:'p'},{ty:0,refId:'p'}],assets:[{id:'p',layers:[{ty:4,nm:'Layer',shapes:[{ty:'gr',nm:'Group',it:[{ty:'sh',nm:'Path'},{ty:'el',nm:'Circle'},{ty:'mm',mm:4}]}]}]}]}});
test('stable identities distinguish path, parametric shape, group and repeated precomp occurrences',()=>{
  const s=source(),before=JSON.stringify(s),a=indexLottiePaths(s),b=indexLottiePaths(s);
  assert.deepEqual(a,b);assert.equal(JSON.stringify(s),before);
  assert.equal(new Set(a.map(n=>n.id)).size,a.length);
  assert.deepEqual(a.filter(n=>n.kind==='path').map(n=>n.layerRoute),[[0,0],[1,0]]);
  assert.equal(a.filter(n=>n.kind==='shape').length,2);
  assert.equal(selectedPathLeaves(a,[a[0].id]).length,2);
  assert.match(a.find(n=>n.kind==='path').note,/fusion/);
  s.revision='r2';assert.notEqual(indexLottiePaths(s)[0].id,a[0].id);
});
test('repeaters are marked unsupported rather than conflated with a source path',()=>{
  const s=source();s.data.assets[0].layers[0].shapes.push({ty:'rp'});
  const nodes=indexLottiePaths(s);assert.equal(selectedPathLeaves(nodes,[nodes[0].id]).length,0);
  assert.match(nodes.find(n=>n.kind==='path').note,/Répétiteur/);
});
test('highlight resolves the individual animated contribution, preserves paint and cleans overlays',()=>{
  const nodes=indexLottiePaths(source()),node=nodes.find(n=>n.kind==='path');
  const f=svgFixture(),path=f.paint;path.setAttribute('d','aggregate of two paths');
  const overlays=()=>f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-highlight')===node.id);
  const view={caches:['M1 2L3 4'],styles:[{pElem:path}]};
  const renderer={elements:[{elements:[{itemsData:[{it:[view]}]}]}]};
  assert.equal(resolveProjectedPath(renderer,node).d,'M1 2L3 4');
  const highlight=createLottieHighlight(renderer,nodes);highlight.update([node.id]);
  assert.equal(overlays()[0].getAttribute('d'),'M1 2L3 4');assert.equal(path.getAttribute('d'),'aggregate of two paths');
  view.caches[0]='M5 6L7 8';highlight.update([node.id]);assert.equal(overlays()[0].getAttribute('d'),'M5 6L7 8');assert.equal(overlays().length,1);
  highlight.update([]);assert.equal(overlays().length,0);highlight.dispose();assert.equal(f.svg.children.length,2);
  assert.equal(resolveProjectedPath({elements:[]},node),null);
});
test('selection updates even while paused, follows seek, and stops after disposal',async()=>{
  let reading={source:source(),timeSeconds:0,selectedIds:[]};let listener;const events=[];
  const session=createLottieReadingSession({host:{read:()=>reading,subscribe:fn=>{listener=fn;return()=>listener=null;}},
    createRenderer:async()=>({renderFrame:f=>events.push(['frame',f]),select:ids=>events.push(['select',...ids]),resize(){},dispose(){events.push(['dispose']);}}),present(){},report:e=>{throw e;}});
  await session.settled();reading={...reading,selectedIds:['path']};listener();assert.deepEqual(events.at(-1),['select','path']);
  reading={...reading,timeSeconds:2};listener();assert.deepEqual(events.slice(-2),[['frame',60],['select','path']]);
  session.dispose();assert.equal(listener,null);assert.deepEqual(events.at(-1),['dispose']);
});
