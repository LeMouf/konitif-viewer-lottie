import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lottieFitInsets,lottieFitViewBox,rulerTicks} from '../dist/viewGuides.js';
test('fit reserves four-sided safety, ruler rails and toolbar at both wide and narrow sizes',()=>{
 for(const [w,h]of [[1000,800],[240,420]]){const p=lottieFitInsets(w,h,true);assert.ok(p.left>=38&&p.right>=16&&p.top>=78&&p.bottom>=16);assert.ok(w-p.left-p.right>0&&h-p.top-p.bottom>0);const plain=lottieFitInsets(w,h,false);assert.equal(p.left-plain.left,22);assert.equal(p.top-plain.top,22);}
});
test('ruler labels invert the camera including negative coordinates, pan and zoom',()=>{
 for(const [origin,scale,length]of [[250,.75,1000],[-120,2.5,500],[50,.05,200]]){const ticks=rulerTicks(origin,scale,length);assert.ok(ticks.length>0);for(const t of ticks){assert.ok(t.position>=22&&t.position<=length);assert.ok(Math.abs((t.position-origin)/scale-t.value)<1e-8);}for(let i=1;i<ticks.length;i++)assert.ok(ticks[i].position-ticks[i-1].position>=70-1e-8);}
 assert.deepEqual(rulerTicks(0,0,100),[]);
});

test('safety only changes the fit viewBox and keeps composition inside all margins',()=>{
 for(const [w,h,sw,sh]of [[970,290,512,512],[1000,800,690,913],[240,420,970,250]])for(const rulers of [false,true]){
  const p=lottieFitInsets(w,h,rulers),b=lottieFitViewBox(w,h,sw,sh,rulers);assert.ok(b);
  const left=-b.x*b.scale,top=-b.y*b.scale;
  assert.ok(left>=p.left-1e-8);assert.ok(top>=p.top-1e-8);assert.ok(w-left-sw*b.scale>=p.right-1e-8);assert.ok(h-top-sh*b.scale>=p.bottom-1e-8);
  assert.ok(Math.abs(b.width*b.scale-w)<1e-8);assert.ok(Math.abs(b.height*b.scale-h)<1e-8);
  // The outer world rectangle extends all the way to the physical panel edges.
  assert.ok(b.x<0&&b.y<0);assert.ok(b.x+b.width>sw);assert.ok(b.y+b.height>sh);
 }
 assert.equal(lottieFitViewBox(0,800,512,512,false),null);
});
