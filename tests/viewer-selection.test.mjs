import {test} from 'node:test';
import assert from 'node:assert/strict';
import {svgFixture} from './svg-dom.mjs';
import {createLottieIsolation} from '../dist/isolation.js';
import {readLottieSelectionBounds} from '../dist/rectanglePicking.js';
const node=(id,parentId,kind,layerRoute,shapeRoute=[])=>({id,parentId,kind,layerRoute,shapeRoute,selectable:true});
test('isolation multiplies evaluated opacity, restores it and keeps shared selected paint intact',()=>{
  const f=svgFixture();
  const style=(element,initial)=>{const values=new Map(Object.entries(initial));element.style={getPropertyValue:k=>values.get(k)??'',getPropertyPriority:()=>'',setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)};return values;};
  const layerA=f.group,layerB=f.cover;
  const a=style(layerA,{}),b=style(layerB,{opacity:'0.5'}),paint=style(f.paint,{opacity:'0.8'});
  f.doc.defaultView.getComputedStyle=e=>({opacity:e.style.getPropertyValue('opacity')||e.getAttribute('opacity')||'1'});
  const nodes=[node('a',null,'layer',[0]),node('a1','a','path',[0],[0]),node('a2','a','path',[0],[1]),node('b',null,'layer',[1])];
  const renderer={elements:[{layerElement:layerA,itemsData:[{caches:['M0 0L10 10'],styles:[{pElem:f.paint}]},{caches:['M20 20L30 30'],styles:[{pElem:f.paint}]}]},{layerElement:layerB}]};
  const isolation=createLottieIsolation(renderer,nodes);isolation.update(['a1']);
  assert.equal(paint.get('opacity'),'0.8');assert.equal(b.get('opacity'),'0.15');assert.equal(a.get('opacity'),undefined);
  isolation.restore();assert.equal(b.get('opacity'),'0.5');
  b.set('opacity','0.2');isolation.update(['a1']);assert.equal(b.get('opacity'),'0.06');
  isolation.update([]);assert.equal(b.get('opacity'),'0.2');assert.equal(layerB.getAttribute('data-lottie-dim-factor'),null);
});
test('rectangle geometry uses individual evaluated caches and exact cubic extrema under screen transforms',()=>{
  const f=svgFixture();f.paint.getScreenCTM=()=>({a:2,b:0,c:0,d:2,e:10,f:20});
  f.doc.defaultView.getComputedStyle=()=>({display:'inline',visibility:'visible',opacity:'1',maskImage:'none'});
  const original=globalThis.DOMPoint;globalThis.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return{x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}};
  try{
    const nodes=[node('a1','a','path',[0],[0]),node('a2','a','path',[0],[1])];
    const renderer={elements:[{itemsData:[{caches:['M0 0C0 100 100 100 100 0Z'],styles:[{pElem:f.paint}]},{caches:['M200 0L210 0L210 10L200 10Z'],styles:[{pElem:f.paint}]}]}]};
    assert.deepEqual(readLottieSelectionBounds(renderer,nodes),[{id:'a1',bounds:{left:10,top:20,right:210,bottom:170,width:200,height:150}},{id:'a2',bounds:{left:410,top:20,right:430,bottom:40,width:20,height:20}}]);
  }finally{globalThis.DOMPoint=original;}
});
