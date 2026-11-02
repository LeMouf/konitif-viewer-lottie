import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvasOutputWithPlayer} from '../dist/canvasRenderer.js';
const source=()=>({id:'canvas-fixture',revision:'1',label:'Canvas fixture',data:{v:'5.7.4',w:256,h:256,fr:30,ip:10,op:100,assets:[],layers:[]}});
function fixture(loaded=true){
  let prepared;const preparing=new Promise(resolve=>{prepared=resolve;});
  const handlers=new Map();const calls={frames:[],destroyed:0,resized:0,loaded:0,config:null,subframe:null};
  const animation={isLoaded:loaded,addEventListener(name,fn){handlers.set(name,fn);},removeEventListener(name,fn){if(handlers.get(name)===fn)handlers.delete(name);},setSubframe(value){calls.subframe=value;},goToAndStop(...args){calls.frames.push(args);},resize(){calls.resized++;},destroy(){calls.destroyed++;}};
  const context={};const canvas={width:256,height:256,ownerDocument:{createElement:()=>({detached:true})},getContext:()=>context};
  const player={loadAnimation(config){calls.loaded++;calls.config=config;prepared();return animation;}};
  return{calls,canvas,player,handlers,animation,preparing,emit(name){handlers.get(name)?.();}};
}
test('canvas renderer borrows the host canvas and source, disables autoplay and reports dirty frames',async()=>{
  const f=fixture(),original=source(),snapshot=JSON.stringify(original);const out=await createCanvasOutputWithPlayer(f.canvas,original,async()=>f.player);
  assert.equal(out.canvas,f.canvas);assert.equal(f.calls.config.renderer,'canvas');assert.equal('container' in f.calls.config,false);assert.equal(f.calls.config.autoplay,false);assert.equal(f.calls.config.loop,false);assert.equal(f.calls.config.rendererSettings.context,f.canvas.getContext());assert.equal(f.calls.config.rendererSettings.runExpressions,false);assert.equal(f.calls.subframe,false);
  assert.notEqual(f.calls.config.animationData,original.data);f.calls.config.animationData.w=100;assert.equal(JSON.stringify(original),snapshot);
  assert.equal(out.renderFrame(0),true);assert.equal(out.renderFrame(.9),false);assert.equal(out.renderFrame(65.1),true);assert.equal(out.renderFrame(65.9),false);assert.deepEqual(f.calls.frames,[[0,true],[65,true]]);
  out.dispose();out.dispose();assert.equal(f.calls.destroyed,1);assert.equal(out.renderFrame(5),false);assert.equal(f.canvas.width,256);
});
test('relative frames clamp to the source interval and invalid time preserves the preceding frame',async()=>{
  const f=fixture(),out=await createCanvasOutputWithPlayer(f.canvas,source(),async()=>f.player);
  out.renderFrame(-100);out.renderFrame(1000);assert.deepEqual(f.calls.frames,[[0,true],[89,true]]);assert.throws(()=>out.renderFrame(NaN),/finite/);assert.equal(out.renderFrame(89),false);out.dispose();
});
test('source and output budgets are admitted before loading the vendor',async()=>{
  const f=fixture(),bad=source();bad.data.layers=[{ty:4,ks:{x:'expression()'}}];let loads=0;
  await assert.rejects(createCanvasOutputWithPlayer(f.canvas,bad,async()=>{loads++;return f.player;}),/expression/);
  f.canvas.width=4096;await assert.rejects(createCanvasOutputWithPlayer(f.canvas,source(),async()=>{loads++;return f.player;}),/budget/);assert.equal(loads,0);
});
test('preparation failure destroys the partial renderer and releases event listeners',async()=>{
  const f=fixture(false),pending=createCanvasOutputWithPlayer(f.canvas,source(),async()=>f.player);await f.preparing;f.emit('data_failed');await assert.rejects(pending,/preparation failed/);assert.equal(f.calls.destroyed,1);assert.equal(f.handlers.size,0);
});
test('cancellation while the renderer is preparing destroys it exactly once',async()=>{
  const f=fixture(false),controller=new AbortController(),pending=createCanvasOutputWithPlayer(f.canvas,source(),async()=>f.player,{signal:controller.signal});await f.preparing;controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(f.calls.destroyed,1);assert.equal(f.handlers.size,0);
});
test('an already cancelled request never loads a renderer',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort();await assert.rejects(createCanvasOutputWithPlayer(f.canvas,source(),async()=>f.player,{signal:controller.signal}),{name:'AbortError'});assert.equal(f.calls.loaded,0);
});
test('readiness timeout destroys an incomplete renderer',async()=>{
  const f=fixture(false);await assert.rejects(createCanvasOutputWithPlayer(f.canvas,source(),async()=>f.player,{loadTimeoutMs:5}),/preparation failed/);assert.equal(f.calls.destroyed,1);assert.equal(f.handlers.size,0);
});
test('host resize validates dimensions and invalidates the frame cache',async()=>{
  const f=fixture(),out=await createCanvasOutputWithPlayer(f.canvas,source(),async()=>f.player);out.renderFrame(5);f.canvas.width=320;out.resize();assert.equal(f.calls.resized,1);assert.equal(out.renderFrame(5),true);f.canvas.height=0;assert.throws(()=>out.resize(),/budget/);out.dispose();out.resize();assert.equal(f.calls.resized,1);
});

test('cancels while the lazy provider is still loading and never mounts its late result',async()=>{
  const f=fixture(),controller=new AbortController();let resolvePlayer;
  const pending=createCanvasOutputWithPlayer(f.canvas,source(),()=>new Promise(resolve=>{resolvePlayer=resolve;}),{signal:controller.signal});
  await Promise.resolve();controller.abort();await assert.rejects(pending,{name:'AbortError'});resolvePlayer(f.player);await Promise.resolve();assert.equal(f.calls.loaded,0);
});
test('bounds a provider that never resolves',async()=>{
  const f=fixture();await assert.rejects(createCanvasOutputWithPlayer(f.canvas,source(),()=>new Promise(()=>{}),{loadTimeoutMs:5}),/timed out/);assert.equal(f.calls.loaded,0);
});
