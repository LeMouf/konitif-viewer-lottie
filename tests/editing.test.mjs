import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLottieEditing,projectLottieSourceProperties} from '../dist/editing.js';
import {indexLottiePaths} from '../dist/index.js';

const property=k=>({a:0,k});
function fixture(){return {id:'document',revision:'original',label:'Test',data:{v:'5.13.0',w:256,h:256,fr:30,ip:0,op:90,assets:[],layers:[{ty:4,nm:'Eye',ind:1,ip:0,op:90,st:0,sr:1,ks:{p:property([128,128,0]),a:property([0,0,0]),s:property([100,100,100]),r:property(0),o:property(100)},shapes:[{ty:'gr',nm:'Pupil',it:[{ty:'el',p:property([0,0]),s:property([40,40])},{ty:'fl',c:property([0,0,1,1]),o:property(100)},{ty:'tr',p:property([0,0]),a:property([0,0]),s:property([100,100]),r:property(0),o:property(100)}]}]}]}};}
function setup(initial=fixture()){
 let source=structuredClone(initial),time=0,playing=false,selected=[];
 const undo=[],redo=[];let pending=null;const persisted=[];
 const history={getStatus:()=>({core:{canUndo:undo.length>0,canRedo:redo.length>0}}),beginTransaction(_,value){pending=structuredClone(value);},commitTransaction(_,value){if(pending&&JSON.stringify(pending.data)!==JSON.stringify(value.data)){undo.push(pending);redo.length=0;}pending=null;},cancelTransaction(){const value=pending;pending=null;return value;},undo(_,current){const previous=undo.pop();if(previous)redo.push(structuredClone(current));return previous;},redo(_,current){const next=redo.pop();if(next)undo.push(structuredClone(current));return next;},reset(){undo.length=redo.length=0;pending=null;}};
 const read=()=>({source,sourceId:source.id,timeSeconds:time,durationSeconds:3,playing,loop:false,selectedIds:selected});
 const editor=createLottieEditing({history,read,replace(value){source=value;},notify(){},persist(value){persisted.push(value);},select(id){selected=[id];}});
 return {editor,read,persisted,history,setTime:value=>{time=value;},setPlaying:value=>{playing=value;}};
}

test('a transform is one host-owned transaction and never mutates the admitted original',()=>{
 const original=fixture(),frozen=JSON.stringify(original),session=setup(original),owner=indexLottiePaths(session.read().source)[0].id;
 session.editor.port.dispatch({type:'transform',id:owner,values:{p:[140,135,0],r:[15],s:[90,90,100]}});
 assert.equal(JSON.stringify(original),frozen);
 assert.deepEqual(session.read().source.data.layers[0].ks.p.k,[140,135,0]);
 assert.equal(session.read().source.data.layers[0].ks.r.k,15);
 assert.equal(session.persisted.length,1);assert.equal(session.editor.port.read().canUndo,true);
 session.editor.port.dispatch({type:'undo'});assert.deepEqual(session.read().source.data,original.data);
 session.editor.port.dispatch({type:'redo'});assert.equal(session.read().source.data.layers[0].ks.r.k,15);
});

test('translation of an animated property creates its key at the borrowed host time',()=>{
 const source=fixture();source.data.layers[0].ks.p={a:1,k:[{t:0,s:[0,0,0],e:[60,0,0],o:{x:[0],y:[0]},i:{x:[1],y:[1]}},{t:60,s:[60,0,0]}]};
 const session=setup(source);session.setTime(.5);const owner=indexLottiePaths(session.read().source)[0].id;
 session.editor.port.dispatch({type:'translate',id:owner,dx:5,dy:8,atCurrentTime:true});
 const keys=session.read().source.data.layers[0].ks.p.k;
 assert.deepEqual(keys.map(key=>key.t),[0,15,60]);assert.ok(Math.abs(keys[1].s[0]-20)<1e-9);assert.deepEqual(keys[1].s.slice(1),[8,0]);
 assert.deepEqual(source.data.layers[0].ks.p.k.map(key=>key.t),[0,60]);
});

test('invalid or stale references reject the entire transform before history or persistence',()=>{
 const session=setup(),original=JSON.stringify(session.read().source),owner=indexLottiePaths(session.read().source)[0].id;
 session.editor.port.dispatch({type:'transform',id:owner,values:{p:[130,130,0],r:[NaN]}});
 assert.equal(JSON.stringify(session.read().source),original);assert.equal(session.persisted.length,0);assert.equal(session.editor.port.read().canUndo,false);
 session.editor.port.dispatch({type:'translate',id:'other-revision',dx:3,dy:2});
 assert.equal(session.persisted.length,0);assert.ok(session.editor.port.read().message);
});

test('playing refuses writes, while resetting the host document clears transient history and mode',()=>{
 const session=setup(),owner=indexLottiePaths(session.read().source)[0].id;
 session.editor.port.dispatch({type:'set-mode',mode:'move'});session.setPlaying(true);
 session.editor.port.dispatch({type:'translate',id:owner,dx:4,dy:0});assert.equal(session.persisted.length,0);
 session.setPlaying(false);session.editor.port.dispatch({type:'translate',id:owner,dx:4,dy:0});
 assert.equal(session.editor.port.read().canUndo,true);session.editor.reset();
 assert.equal(session.editor.port.read().canUndo,false);assert.equal(session.editor.port.read().mode,'inspect');
});

test('numeric preview can cancel without writing or commit once through the host history',()=>{
 const session=setup(),track=session.editor.port.read().properties.find(p=>p.pointer==='/layers/0/ks/p');
 session.editor.port.dispatch({type:'begin-value',trackId:track.id,pointer:track.pointer});
 session.editor.port.dispatch({type:'preview-value',value:[150,150,0]});assert.equal(session.persisted.length,0);
 session.editor.port.dispatch({type:'cancel-value'});assert.deepEqual(session.read().source.data.layers[0].ks.p.k,[128,128,0]);
 const current=session.editor.port.read().properties.find(p=>p.pointer==='/layers/0/ks/p');
 session.editor.port.dispatch({type:'begin-value',trackId:current.id,pointer:current.pointer});
 session.editor.port.dispatch({type:'preview-value',value:[160,160,0]});session.editor.port.dispatch({type:'commit-value'});
 assert.equal(session.persisted.length,1);session.editor.port.dispatch({type:'undo'});assert.deepEqual(session.read().source.data.layers[0].ks.p.k,[128,128,0]);
});

test('nested precomposition time preserves stretch and offset; remapping stays explicitly uneditable',()=>{
 const source=fixture(),child=structuredClone(source.data.layers[0]);source.data.ip=10;source.data.op=100;
 source.data.assets=[{id:'child',layers:[child]}];source.data.layers=[{ty:0,refId:'child',nm:'Nested',ip:10,op:100,st:10,sr:2,ks:child.ks}];
 const session=setup(source);session.setTime(1);
 const track=session.editor.port.read().properties.find(p=>p.pointer==='/assets/0/layers/0/ks/p');assert.equal(track.frame,15);
 source.data.layers[0].tm=property(0);const remapped=setup(source);
 assert.equal(remapped.editor.port.read().properties.some(p=>p.pointer.startsWith('/assets/')),false);
 assert.ok(projectLottieSourceProperties(source).notes.some(note=>note.includes('remappée')));
});

test('disposed editing rejects late commands and releases pending previews',()=>{const session=setup(),track=session.editor.port.read().properties.find(p=>p.pointer==='/layers/0/ks/p');session.editor.port.dispatch({type:'begin-value',trackId:track.id,pointer:track.pointer});session.editor.port.dispatch({type:'preview-value',value:[200,200,0]});session.editor.dispose();assert.deepEqual(session.read().source.data.layers[0].ks.p.k,[128,128,0]);session.editor.port.dispatch({type:'translate',id:track.ownerId,dx:7,dy:1});assert.equal(session.persisted.length,0);});
