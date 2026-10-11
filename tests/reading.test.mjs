import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectLottieProfile, frameAtSeconds, lottieViewerToolModule } from '../dist/index.js';
import { createLottieReadingSession } from '../dist/session.js';

const data = () => ({ v: '4.0.0', w: 100, h: 100, ip: 10, op: 402, fr: 30, layers: [{ ty: 4, ks: {}, shapes: [] }], assets: [] });
const source = id => ({ id, revision: 'one', label: id, data: data() });
test('declaration does not need a browser or activate a vendor', () => {
  assert.equal(lottieViewerToolModule.id, 'konitif.viewer-lottie');
  assert.equal(typeof globalThis.document, 'undefined');
});
test('native duration and relative frames honor the exclusive out-point', () => {
  const p = inspectLottieProfile(data());
  assert.equal(p.durationSeconds, 392 / 30);
  assert.equal(frameAtSeconds(p, -1), 0);
  assert.equal(frameAtSeconds(p, 0), 0);
  assert.equal(frameAtSeconds(p, 0.5), 15);
  assert.equal(frameAtSeconds(p, p.durationSeconds), 391);
  assert.equal(frameAtSeconds(p, 99), 391);
  assert.throws(() => frameAtSeconds(p, NaN));
});
test('rejects expressions, effects, URLs, images, missing references and cyclic compositions', () => {
  for (const change of [
    d => { d.layers[0].ks = { p: { x: 'alert(1)' } }; },
    d => { d.layers[0].ef = [{ ty: 20 }]; },
    d => { d.layers[0].nm = 'https://untrusted.test'; },
    d => { d.assets = [{ id: 'image', p: 'local.png' }]; },
    d => { d.layers = [{ ty: 0, ks: {}, refId: 'missing' }]; },
    d => { d.layers = [{ ty: 0, ks: {}, refId: 'self' }]; d.assets = [{ id: 'self', layers: d.layers }]; }
  ]) { const d = data(); change(d); assert.throws(() => inspectLottieProfile(d)); }
});
test('merge paths stay explicit; inputs are never rewritten', () => {
  const d = data(); d.layers[0].shapes = [{ ty: 'mm', mm: 4 }];
  const before = JSON.stringify(d);
  assert.equal(inspectLottieProfile(d).warnings.length, 1);
  assert.equal(JSON.stringify(d), before);
});
function harness() {
  let reading = { sourceId: 'a', source: source('a'), timeSeconds: 0, durationSeconds: 392 / 30, playing: false, loop: false, selectedIds: [], observedAtMs: 0 };
  const listeners = new Set(); let dispatched = 0;
  const host = { sources: [], read: () => reading, dispatch: () => dispatched++, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  return { host, listeners, dispatched: () => dispatched, update: patch => { reading = { ...reading, ...patch }; for (const fn of listeners) fn(); } };
}
test('renders admitted time, holds the last frame, and releases only owned resources', async () => {
  const h = harness(), frames = []; let destroys = 0;
  const session = createLottieReadingSession({ host: h.host, createRenderer: async () => ({ renderFrame: f => frames.push(f), resize() {}, dispose: () => destroys++ }), present() {}, report: e => { throw e; } });
  await session.settled(); h.update({ timeSeconds: 5 }); h.update({ timeSeconds: 392 / 30 }); h.update({ timeSeconds: 392 / 30 });
  assert.deepEqual(frames, [0, 150, 391]);
  session.dispose(); session.dispose(); h.update({ timeSeconds: 0 });
  assert.equal(destroys, 1); assert.equal(h.listeners.size, 0); assert.equal(h.dispatched(), 0);
});
test('late renderers are destroyed after source replacement or closing, without painting stale frames', async () => {
  const h = harness(), pending = [], disposed = [], painted = [];
  const session = createLottieReadingSession({ host: h.host, createRenderer: s => new Promise(resolve => pending.push({ id: s.id, resolve })), present() {}, report: e => { throw e; } });
  await Promise.resolve(); h.update({ sourceId: 'b', source: source('b') }); await Promise.resolve();
  for (const p of pending) p.resolve({ renderFrame: () => painted.push(p.id), resize() {}, dispose: () => disposed.push(p.id) });
  await session.settled(); assert.deepEqual(painted, ['b']); assert.deepEqual(disposed, ['a']);
  h.update({ sourceId: 'c', source: source('c') }); await Promise.resolve(); session.dispose();
  pending[2].resolve({ renderFrame: () => painted.push('c'), resize() {}, dispose: () => disposed.push('c') });
  await session.settled(); assert.deepEqual(disposed, ['a', 'b', 'c']); assert.deepEqual(painted, ['b']);
});
test('a rejected profile never reaches the renderer', async () => {
  const h = harness(); h.update({ source: { ...source('x'), data: { ...data(), fr: 0 } } });
  let called = 0, error;
  const session = createLottieReadingSession({ host: h.host, createRenderer: async () => { called++; throw Error('unexpected'); }, present() {}, report: cause => { error = cause; } });
  await session.settled(); assert.equal(called, 0); assert.match(error.message, /interval/); session.dispose();
});

test('same-document revisions keep the old image until the replacement has painted and activated',async()=>{
 const h=harness(),pending=[],events=[],ready=[];
 const session=createLottieReadingSession({host:h.host,createRenderer:s=>new Promise(resolve=>pending.push({s,resolve})),present:(_,__,value)=>ready.push(value),report:e=>{throw e;}});
 const make=id=>({renderFrame:()=>events.push('paint:'+id),activate:()=>events.push('activate:'+id),hitTest:()=>[id],resize(){},dispose:()=>events.push('dispose:'+id)});
 await Promise.resolve();pending[0].resolve(make('one'));await session.settled();events.length=0;
 h.update({source:{...source('a'),revision:'two'}});await Promise.resolve();
 assert.deepEqual(events,[]);assert.deepEqual(session.hitTest(0,0),[]);assert.equal(ready.at(-1),false);
 h.update({timeSeconds:2,selectedIds:['new-id']});assert.deepEqual(events,[]);
 pending[1].resolve(make('two'));await session.settled();
 assert.deepEqual(events,['paint:two','dispose:one','activate:two']);assert.deepEqual(session.hitTest(0,0),['two']);assert.equal(ready.at(-1),true);session.dispose();
});
test('rapid writes coalesce before construction and superseded in-flight projections never activate',async()=>{
 const h=harness(),pending=[],events=[];
 const session=createLottieReadingSession({host:h.host,createRenderer:s=>new Promise(resolve=>pending.push({s,resolve})),present(){},report:e=>{throw e;}});
 const make=id=>({renderFrame:()=>events.push('paint:'+id),activate:()=>events.push('activate:'+id),resize(){},dispose:()=>events.push('dispose:'+id)});
 await Promise.resolve();pending[0].resolve(make('one'));await session.settled();events.length=0;
 for(const revision of ['two','three','four'])h.update({source:{...source('a'),revision}});
 await Promise.resolve();assert.deepEqual(pending.map(p=>p.s.revision),['one','four']);
 h.update({source:{...source('a'),revision:'five'}});await Promise.resolve();
 pending[1].resolve(make('four'));await Promise.resolve();await Promise.resolve();assert.ok(!events.includes('dispose:one'));assert.ok(!events.includes('activate:four'));
 pending[2].resolve(make('five'));await session.settled();assert.deepEqual(events,['dispose:four','paint:five','dispose:one','activate:five']);session.dispose();
});
test('failed replacement keeps the preceding image and never admits stale picking',async()=>{
 const h=harness(),events=[],errors=[];let reject;
 const session=createLottieReadingSession({host:h.host,createRenderer:s=>s.revision==='one'?Promise.resolve({renderFrame(){},hitTest:()=>['old'],resize(){},dispose:()=>events.push('disposed')}):new Promise((_,r)=>{reject=r;}),present(){},report:e=>errors.push(e)});
 await session.settled();h.update({source:{...source('a'),revision:'two'}});await Promise.resolve();reject(Error('failed'));await session.settled();
 assert.deepEqual(events,[]);assert.equal(errors.length,1);assert.deepEqual(session.hitTest(0,0),[]);session.dispose();assert.deepEqual(events,['disposed']);
});

test('live drag paints without rebuilding or advancing frames and keeps the last preview until replacement',async()=>{
 const h=harness(),pending=[],events=[];let builds=0,frames=0,live=false;
 const first={renderFrame(){frames++;},previewTransform(id,matrix){live=true;events.push('preview');return true;},clearTransformPreview(){live=false;events.push('clear');},select(){events.push('select');},resize(){},dispose(){events.push(live?'dispose-live':'dispose-original');}};
 const session=createLottieReadingSession({host:h.host,createRenderer:s=>{builds++;return s.revision==='one'?Promise.resolve(first):new Promise(resolve=>pending.push(resolve));},present(){},report:e=>{throw e;}});
 await session.settled();events.length=0;session.previewTransform('subject',[1,0,0,1,1,2]);session.previewTransform('subject',[1,0,0,1,2,4]);assert.equal(builds,1);assert.equal(frames,1);assert.equal(live,true);assert.deepEqual(events,['preview','select','preview','select']);
 h.update({source:{...source('a'),revision:'two'}});await Promise.resolve();assert.equal(live,true);assert.ok(!events.includes('clear'));pending[0]({renderFrame(){},resize(){},dispose(){}});await session.settled();assert.ok(events.includes('dispose-live'));session.dispose();
});


test('compatible revisions use one native reader and rejected revisions reconstruct',async()=>{
 const h=harness();let creates=0,updates=0,disposed=0;const painted=[],selected=[];
 const session=createLottieReadingSession({host:h.host,createRenderer:async()=>{creates++;return {updateSource:s=>{updates++;return s.revision!=='structural';},renderFrame:f=>painted.push(f),select:ids=>selected.push(ids),resize(){},dispose(){disposed++;}};},present(){},report:e=>{throw e;}});await session.settled();
 h.update({source:{...source('a'),revision:'numeric'},selectedIds:['new-id']});await session.settled();assert.equal(creates,1);assert.equal(updates,1);assert.equal(disposed,0);assert.deepEqual(painted,[0,0]);assert.deepEqual(selected.at(-1),['new-id']);assert.equal(session.isReady(),true);
 h.update({source:{...source('a'),revision:'structural'}});await session.settled();assert.equal(creates,2);assert.equal(disposed,1);session.dispose();assert.equal(disposed,2);
});
