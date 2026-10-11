import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveLottieNullOrigin,createLottieNullOverlay} from '../dist/nullProjection.js';
import {normalizeLottiePathAppearance} from '../dist/pathAppearance.js';
import {svgFixture} from './svg-dom.mjs';
const matrix=(a,b,c,d,e,f)=>({finalTransform:{mProp:{v:{props:[a,b,0,0,c,d,0,0,0,0,1,0,e,f,0,1]}}}});
const node={id:'null',parentId:null,kind:'layer',sourceType:'3',layerRoute:[0],shapeRoute:[],selectable:true,label:'Null'};
function fixture(){const f=svgFixture();f.group.getScreenCTM=()=>({a:.5,b:0,c:0,d:.5,e:40,f:80});const layer={...matrix(1,0,0,1,10,20),data:{ty:3,ip:0,op:60},hierarchy:[matrix(0,2,-2,0,100,200),matrix(1,0,0,1,5,-10)]};return{f,layer,renderer:{renderedFrame:0,layerElement:f.group,elements:[layer]}};}
test('null origin uses evaluated own and transform-parent matrices before the composition/view CTM',()=>{
 const {renderer,layer}=fixture();let result=resolveLottieNullOrigin(renderer,node);assert.deepEqual(result.origin,{x:65,y:210});assert.deepEqual(result.screen,{x:72.5,y:185});
 layer.finalTransform.mProp.v.props[12]=30;result=resolveLottieNullOrigin(renderer,node);assert.deepEqual(result.origin,{x:65,y:250});
});
test('null projection rejects inactive, hidden, missing, singular or cyclic data without invented positions',()=>{
 const {renderer,layer}=fixture();renderer.renderedFrame=60;assert.equal(resolveLottieNullOrigin(renderer,node),null);renderer.renderedFrame=0;layer.data.hd=true;assert.equal(resolveLottieNullOrigin(renderer,node),null);layer.data.hd=false;layer.hierarchy.push(layer);assert.equal(resolveLottieNullOrigin(renderer,node),null);layer.hierarchy=[];layer.finalTransform.mProp.v.props[12]=NaN;assert.equal(resolveLottieNullOrigin(renderer,node),null);
});
test('null feedback is a neutral, unfilled, non-interactive cross with explicit context/hover/selection cleanup',()=>{
 const {renderer,f}=fixture(),overlay=createLottieNullOverlay(renderer,[node]),style=normalizeLottiePathAppearance({color:'#ff8800',colorMode:'type'});
 for(const [selected,hovered,show,state,width] of [[[],[],true,'context','1'],[[],['null'],false,'hover','1.5'],[['null'],[],false,'selected','2']]){overlay.update(selected,hovered,show,style,1,[]);const path=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-null-origin'));assert.equal(path.getAttribute('stroke'),'#aab3bf');assert.equal(path.getAttribute('fill'),'none');assert.equal(path.getAttribute('pointer-events'),'none');assert.equal(path.getAttribute('data-null-state'),state);assert.equal(path.getAttribute('stroke-width'),width);assert.equal(path.getAttribute('data-origin-x'),'65');}
 overlay.update(['null'],[],true,style,1,['null']);assert.equal(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-null-origin')).length,0);overlay.clear();assert.deepEqual(f.svg.children,[f.group,f.cover]);
});
