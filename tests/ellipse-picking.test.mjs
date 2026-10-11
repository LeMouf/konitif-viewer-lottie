import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hitTestLottiePaths,createLottiePickCache} from '../dist/picking.js';
import {svgFixture} from './svg-dom.mjs';
// This isolates admission/mapping/coordinate plumbing. Real SVG fill geometry is
// checked against Adrock in browser QA, not simulated by this recording probe.
function setup(t){
 const previous={DOMPoint:globalThis.DOMPoint,Path2D:globalThis.Path2D};
 t.after(()=>Object.assign(globalThis,previous));
 globalThis.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return{x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}};
 globalThis.Path2D=class{constructor(d){this.d=d;}};
 const f=svgFixture(),calls=[];
 const style={display:'inline',visibility:'visible',opacity:'1',fill:'rgb(255,254,230)',fillOpacity:'1',fillRule:'nonzero',stroke:'none',strokeOpacity:'1',strokeWidth:'2',strokeLinecap:'round',strokeLinejoin:'round',strokeMiterlimit:'4',strokeDasharray:'none',strokeDashoffset:'0',maskImage:'none'};
 f.doc.defaultView.getComputedStyle=e=>({...style,...e.attrs});
 const context={setLineDash(){},isPointInPath:(d,x,y,rule)=>{calls.push(['fill',d.d,x,y,rule]);return true;},isPointInStroke:(d,x,y)=>{calls.push(['stroke',d.d,x,y]);return true;}};
 f.doc.createElement=()=>({getContext:()=>context});
 const identity={a:1,b:0,c:0,d:1,e:0,f:0};
 f.group.getScreenCTM=()=>({inverse:()=>identity});
 f.paint.getScreenCTM=()=>({a:0,b:2,c:-3,d:0,inverse:()=>({a:0,b:-1/3,c:1/2,d:0,e:-10,f:20})});
 const shape={tagName:'path',children:[],getAttribute:k=>k==='d'?'M0,0 L690,0 L690,913 L0,913z':null,hasAttribute:()=>false};
 const definition={children:[shape],getAttribute:()=>null,hasAttribute:()=>false};
 f.doc.getElementById=()=>definition;f.group.setAttribute('clip-path','url(#precomp)');
 const views=[0,1].map(()=>({styles:[{pElem:f.paint}],caches:['M0,-88.5C48.843,-88.5 88.5,-48.843 88.5,0C88.5,48.843 48.843,88.5 0,88.5C-48.843,88.5 -88.5,48.843 -88.5,0C-88.5,-48.843 -48.843,-88.5 0,-88.5z']}));
 const renderer={elements:[{elements:[{itemsData:[{it:views}]}]}]};
 const nodes=views.map((_,i)=>({id:`ellipse-${i}`,kind:'shape',selectable:true,layerRoute:[0,0],shapeRoute:[0,i]}));
 return{...f,renderer,nodes,views,calls,style,definition,shape};
}
test('ellipse picking admits the precomp rectangle, uses each current evaluated contribution and inverse screen transform',t=>{
 const f=setup(t);
 assert.deepEqual(hitTestLottiePaths(f.renderer,f.nodes,60,20),['ellipse-0','ellipse-1']);
 assert.deepEqual(f.calls[0],['fill',f.views[0].caches[0],0,0,'nonzero']);
 f.views[0].caches[0]='M0,-40C22,-40 40,-22 40,0Z';f.calls.length=0;
 hitTestLottiePaths(f.renderer,f.nodes,60,100);assert.deepEqual(f.calls[0],['fill',f.views[0].caches[0],40,0,'nonzero']);
 f.style.fill='none';f.style.stroke='black';f.calls.length=0;hitTestLottiePaths(f.renderer,f.nodes,60,100);assert.equal(f.calls[0][0],'stroke');
});
test('ellipse admission still rejects hidden geometry, real masks, unsupported clips and positions outside the composition',t=>{
 const f=setup(t);
 for(const attrs of [{visibility:'hidden'},{opacity:'0'},{mask:'url(#mask)'}]){
  Object.assign(f.group.attrs,attrs);assert.deepEqual(hitTestLottiePaths(f.renderer,f.nodes,60,20),[]);for(const k of Object.keys(attrs))delete f.group.attrs[k];
 }
 assert.deepEqual(hitTestLottiePaths(f.renderer,f.nodes,700,20),[]);
 f.shape.getAttribute=k=>k==='d'?'M0,0C100,0 100,100 0,100z':null;
 assert.deepEqual(hitTestLottiePaths(f.renderer,f.nodes,60,20),[]);assert.equal(f.calls.length,0);
});
test('evaluated-frame cache reuses policies while contribution geometry and explicit invalidation stay exact',t=>{
 const f=setup(t),geometry=new WeakMap(),cache=createLottiePickCache();let styles=0;
 const readStyle=f.doc.defaultView.getComputedStyle;f.doc.defaultView.getComputedStyle=e=>{styles++;return readStyle(e);};
 assert.deepEqual(hitTestLottiePaths(f.renderer,f.nodes,60,20,6,geometry,cache),['ellipse-0','ellipse-1']);const coldStyles=styles;
 hitTestLottiePaths(f.renderer,f.nodes,65,25,6,geometry,cache);assert.equal(styles,coldStyles);
 const before=geometry.get(f.paint);f.views[1].caches[0]='M0,0L30,40Z';hitTestLottiePaths(f.renderer,f.nodes,60,20,6,geometry,cache);assert.notEqual(geometry.get(f.paint),before);
 f.group.attrs.visibility='hidden';assert.deepEqual(hitTestLottiePaths(f.renderer,f.nodes,60,20,6,geometry,createLottiePickCache()),[]);
});
