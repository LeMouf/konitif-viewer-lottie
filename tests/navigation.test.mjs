import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLottieNavigation} from '../dist/navigation.js';
const policy={isPanGesture:({button,altKey,isPrimaryModifier})=>button===1||altKey||(button===0&&!isPrimaryModifier),panOffset:({viewportStart,pointerStart,pointerCurrent})=>({x:viewportStart.x+pointerCurrent.x-pointerStart.x,y:viewportStart.y+pointerCurrent.y-pointerStart.y}),scaleAroundPoint:({viewport,screenPoint,nextZoom})=>({x:screenPoint.x-(screenPoint.x-viewport.x)*nextZoom/viewport.zoom,y:screenPoint.y-(screenPoint.y-viewport.y)*nextZoom/viewport.zoom,zoom:nextZoom}),nextZoom:z=>z*2};
const event=(x=0,y=0,patch={})=>({button:0,altKey:false,ctrlKey:false,metaKey:false,pointerId:1,clientX:x,clientY:y,...patch});
test('short primary click stays selectable; drag and explicit pan consume release',()=>{
 const n=createLottieNavigation(policy);n.down(event());assert.equal(n.move(event(3,4)),false);assert.equal(n.up(1),false);
 n.down(event());assert.equal(n.move(event(6,0)),true);assert.deepEqual(n.read(),{x:6,y:0,zoom:1});n.move(event(0,0));assert.equal(n.up(1),true);
 n.down(event(0,0,{button:1}));assert.equal(n.up(1),true);n.down(event(0,0,{altKey:true}));assert.equal(n.up(1),true);
});
test('foreign pointers, modifiers, cancellation and wheel during drag cannot steal navigation',()=>{
 const n=createLottieNavigation(policy);assert.equal(n.down(event(0,0,{ctrlKey:true})),false);assert.equal(n.down(event(0,0,{button:2})),false);
 n.down(event());assert.equal(n.down(event(0,0,{pointerId:2})),false);assert.equal(n.move(event(30,40,{pointerId:2})),false);assert.equal(n.up(2),false);assert.equal(n.zoom({x:100,y:100},1),false);
 n.cancel();assert.equal(n.up(1),false);assert.deepEqual(n.read(),{x:0,y:0,zoom:1});n.zoom({x:100,y:100},1);assert.deepEqual(n.read(),{x:-100,y:-100,zoom:2});n.reset();assert.deepEqual(n.read(),{x:0,y:0,zoom:1});
});

test('synchronous persistence echoes do not end a multi-move pan; external history does',()=>{
 const n=createLottieNavigation(policy);n.down(event(100,100));
 assert.equal(n.move(event(120,110)),true);n.restore(n.read());
 assert.equal(n.move(event(180,140)),true);n.restore(n.read());
 assert.equal(n.move(event(250,180)),true);assert.deepEqual(n.read(),{x:150,y:80,zoom:1});assert.equal(n.up(1),true);
 assert.equal(n.move(event(300,200)),false);
 n.down(event(250,180));n.restore({x:10,y:20,zoom:2});assert.equal(n.move(event(300,200)),false);assert.deepEqual(n.read(),{x:10,y:20,zoom:2});
});
