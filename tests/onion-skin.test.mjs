import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLottieOnionSettings as normalize,onionSkinSamples as samples,defaultLottieOnionSettings as defaults} from '../dist/onionSkinPolicy.js';
import {createLottieOnionObservation} from '../dist/onionSkin.js';
import {selectedLottieOrigin,createSelectedOrigin} from '../dist/selectedOrigin.js';
import {svgFixture} from './svg-dom.mjs';
test('samples exclusive bounds and loop without duplicates or the current frame',()=>{
 const s=normalize({onionEnabled:true,onionStep:5});assert.deepEqual(samples(60,120,false,s).map(p=>p.frame),[50,70,55,65]);
 assert.deepEqual(samples(0,120,false,s).map(p=>p.frame),[10,5]);assert.deepEqual(samples(119,120,false,s).map(p=>p.frame),[109,114]);
 assert.deepEqual(samples(0,120,true,s).map(p=>p.frame),[110,10,115,5]);assert.equal(samples(0,1,true,s).length,0);
 assert.equal(samples(0,120,true,{...s,onionStep:60}).length,1);assert.equal(samples(0,120,false,defaults).length,0);
});
test('independent bounded counts and geometric opacity migrate old settings',()=>{
 const s=normalize({onionEnabled:true,onionBefore:4,onionAfter:1,onionOpacity:.4,onionOpacityDecay:.5});
 assert.deepEqual(samples(60,120,false,s).filter(p=>p.direction==='past').map(p=>p.opacity),[.05,.1,.2,.4]);
 assert.equal(samples(60,120,false,s).filter(p=>p.direction==='future').length,1);assert.equal(normalize({onionBefore:99,onionAfter:-1,onionStep:0}).onionBefore,4);
 assert.deepEqual(normalize({},{}),defaults);assert.equal(defaults.onionStep,1);assert.equal(normalize({onionOpacityDecay:2}).onionOpacityDecay,1);
});
test('rendered pose observation freezes, deduplicates and releases subscribers',()=>{
 const o=createLottieOnionObservation();let calls=0;const release=o.subscribe(()=>calls++);
 const reading={sourceId:'a',revision:'1',poses:[{frame:5,timeSeconds:.5,direction:'future',distance:1,opacity:.25,color:'#e69f00'}]};
 o.publish(reading);reading.poses[0].frame=99;assert.equal(o.read().poses[0].frame,5);assert.throws(()=>{o.read().poses[0].frame=6;});
 o.publish({...reading,poses:[{...reading.poses[0],frame:5}]});assert.equal(calls,1);o.publish(null);assert.equal(calls,2);release();o.publish(reading);assert.equal(calls,2);
});
const node={id:'shape',label:'Ellipse',parentId:'layer',kind:'path',selectable:true,layerRoute:[0,0],shapeRoute:[0,0]};
test('pivot reads evaluated enclosing group anchor through its complete native matrix',()=>{
 const f=svgFixture();f.group.getScreenCTM=()=>({a:0,b:2,c:-3,d:0,e:123,f:456});
 const r={elements:[{elements:[{layerElement:f.cover,itemsData:[{gr:f.group,it:[{transform:{mProps:{a:{v:[7,7]}}}},{p:{v:[9,9]}}]}]}]}]};
 assert.deepEqual(selectedLottieOrigin(r,node,[]),{x:102,y:470,space:'espace du groupe de formes'});
 f.group.setAttribute('visibility','hidden');assert.equal(selectedLottieOrigin(r,node,[]),null);f.group.removeAttribute('visibility');
 assert.equal(selectedLottieOrigin(r,{...node,sourceType:'3'},[]),null);assert.equal(selectedLottieOrigin(r,{...node,shapeRoute:[8]},[]),null);
});
test('origin overlay is inert, screen-sized, single-selection only and cleaned up',()=>{
 const f=svgFixture(),identity={a:1,b:0,c:0,d:1,e:0,f:0};identity.inverse=()=>identity;f.svg.getScreenCTM=()=>identity;f.group.getScreenCTM=()=>({...identity,e:20,f:30});
 const r={elements:[{elements:[{layerElement:f.group,itemsData:[{gr:f.group,it:[{}]}]}]}]},target={ownerDocument:f.doc,querySelector:()=>f.svg},overlay=createSelectedOrigin(target),nodes=[{...node,id:'layer',parentId:null},node];
 overlay.update(r,nodes,['shape'],[],true,{});let marker=f.descendants(f.svg).find(e=>e.getAttribute('data-lottie-selected-origin'));assert.ok(marker);assert.equal(marker.getAttribute('pointer-events'),'none');assert.equal(marker.children[0].getAttribute('d'),'M15,30L25,30M20,25L20,35');
 for(const [ids,hidden,visible] of [[['shape','layer'],[],true],[['shape'],['layer'],true],[['shape'],[],false],[[],[],true]]){overlay.update(r,nodes,ids,hidden,visible,{});assert.equal(f.descendants(f.svg).some(e=>e.getAttribute('data-lottie-selected-origin')),false);}
 overlay.update(r,nodes,['shape'],[],true,{});overlay.dispose();assert.equal(overlay.summary(),'');assert.equal(f.descendants(f.svg).some(e=>e.getAttribute('data-lottie-selected-origin')),false);
});

import {createLottieOnionSkin} from '../dist/onionSkin.js';
test('auxiliary renderer owns its time and IDs, publishes actual poses and cleans late loads',()=>{
 const f=svgFixture(),proto=Object.getPrototypeOf(f.svg);
 Object.defineProperties(proto,{localName:{get(){return this.tagName;}},id:{get(){return this.attrs.id??'';},set(v){this.attrs.id=v;}},attributes:{get(){return Object.entries(this.attrs).map(([name,value])=>({name,value,localName:name,namespaceURI:null}));}},firstChild:{get(){return this.children[0]??null;}}});
 proto.setAttributeNS=function(ns,k,v){this.setAttribute(k,v);};proto.querySelectorAll=function(selector){return f.descendants(this).filter(e=>selector==='*'||selector==='[id]'&&e.id||selector==='svg'&&e.localName==='svg'||selector==='[data-lottie-view-transform]'&&e.getAttribute('data-lottie-view-transform')!==null);};proto.querySelector=function(s){return this.querySelectorAll(s)[0]??null;};
 proto.cloneNode=function(deep){const copy=f.doc.createElementNS('',this.tagName);copy.attrs={...this.attrs};if(deep)copy.append(...this.children.map(e=>e.cloneNode(true)));return copy;};f.doc.createElement=tag=>f.doc.createElementNS('',tag);
 const target=f.doc.createElement('div');target.append(f.svg);f.paint.setAttribute('data-current-frame','60');
 const instances=[],evaluations=[],readings=[];const player={loadAnimation(options){const svg=f.doc.createElementNS('','svg'),defs=f.doc.createElementNS('','defs'),clip=f.doc.createElementNS('','clipPath'),paint=f.doc.createElementNS('','rect');clip.id='vendor-clip';defs.append(clip);paint.setAttribute('clip-path','url(#vendor-clip)');svg.append(defs,paint);options.container.append(svg);const listeners={};const instance={isLoaded:false,renderer:{elements:[]},destroyed:false,addEventListener(k,fn){listeners[k]=fn;},removeEventListener(k){delete listeners[k];},goToAndStop(frame,relative){assert.equal(relative,true);evaluations.push(frame);paint.setAttribute('data-evaluated-frame',String(frame));},destroy(){this.destroyed=true;},loaded(){listeners.DOMLoaded?.();}};instances.push(instance);return instance;}};
 const source={id:'a',revision:'r',label:'a',data:{w:100,h:100,fr:60,ip:0,op:120,layers:[{ty:4,ind:1,ip:0,op:120,ks:{},shapes:[]}]}};
 const onion=createLottieOnionSkin(target,source,player,value=>readings.push(value)),settings=normalize({onionEnabled:true,onionStep:5});
 onion.update(60,false,false,settings,[]);assert.equal(instances.length,1);assert.equal(evaluations.length,0);instances[0].loaded();assert.deepEqual(evaluations,[50,70,55,65]);
 assert.equal(f.paint.getAttribute('data-current-frame'),'60');assert.equal(readings.at(-1).poses.length,4);const ghosts=f.descendants(f.svg).filter(e=>e.getAttribute('data-onion-frame')!==null);assert.equal(ghosts.length,4);assert.ok(ghosts.every(e=>e.style.pointerEvents==='none'));const ids=f.descendants(f.svg).filter(e=>e.id).map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 onion.update(60,false,false,settings,[]);assert.equal(evaluations.length,4);onion.update(60,false,true,settings,[],['not-projectable']);assert.equal(evaluations.length,8);assert.equal(f.descendants(target).filter(e=>e.getAttribute('data-onion-frame')!==null).flatMap(e=>f.descendants(e)).filter(e=>e.localName==='rect').length,0);onion.update(60,false,true,settings,[],['not-projectable']);assert.equal(evaluations.length,8);onion.update(60,false,true,settings,[],[]);assert.equal(evaluations.length,12);assert.equal(f.descendants(target).filter(e=>e.getAttribute('data-onion-frame')!==null).flatMap(e=>f.descendants(e)).filter(e=>e.localName==='rect').length,4);onion.update(60,false,false,{...settings,onionEnabled:false},[]);assert.equal(instances[0].destroyed,true);assert.equal(readings.at(-1),null);assert.equal(target.children.length,1);
 onion.update(60,false,false,settings,[]);const late=instances[1];onion.dispose();late.loaded();assert.equal(late.destroyed,true);assert.equal(evaluations.length,12);assert.equal(target.children.length,1);
});

import {onionSelectedPaint,onionUnderlayIndices,cloneOnionPaint,mountOnionPaint} from '../dist/onionComposition.js';
test('static full-duration underlays do not cover ghosts or get duplicated in them',()=>{
 const staticLayer={ty:4,ip:0,op:120,ks:{p:{k:[0,0]},o:{k:100}},shapes:[]},animatedLayer={...staticLayer,ks:{p:{k:[{t:0,s:[0,0]},{t:60,s:[50,0]}]}}};
 assert.deepEqual(onionUnderlayIndices({ip:0,op:120,layers:[animatedLayer,staticLayer]}),[1]);
 assert.deepEqual(onionUnderlayIndices({ip:0,op:120,layers:[staticLayer,animatedLayer]}),[]);
 assert.deepEqual(onionUnderlayIndices({ip:0,op:120,layers:[{...staticLayer,shapes:[{ty:'fl',c:{a:1,k:[{t:0,s:[0,0,0]},{t:60,s:[1,1,1]}]},o:{k:100}}]}]}),[0]);
 for(const patch of [{parent:1},{ip:10},{op:100},{ty:0},{ks:{o:{a:1,k:[]}}}])assert.deepEqual(onionUnderlayIndices({ip:0,op:120,layers:[{...staticLayer,...patch}]}),[]);
 const f=svgFixture(),camera=f.svg,background=f.group,foreground=f.cover,ghost=f.doc.createElementNS('','g');camera.contains=e=>f.descendants(camera).includes(e);camera.insertBefore=function(e,before){e.remove();e.parentElement=this;const index=before?this.children.indexOf(before):this.children.length;this.children.splice(index,0,e);return e;};
 mountOnionPaint(camera,ghost,[1],{elements:[{baseElement:foreground},{baseElement:background}]});assert.deepEqual(camera.children,[background,ghost,foreground]);assert.equal(background.parentElement,camera);assert.equal(f.paint.parentElement,background);
 ghost.remove();assert.deepEqual(camera.children,[background,foreground]);
 const deepClone=(element)=>{const copy=f.doc.createElementNS('',element.tagName);copy.attrs={...element.attrs};copy.append(...element.children.map(deepClone));return copy;};background.cloneNode=()=>deepClone(background);foreground.cloneNode=()=>deepClone(foreground);
 cloneOnionPaint(camera,ghost,[background]);assert.equal(ghost.children.length,1);assert.equal(ghost.children[0].tagName,foreground.tagName);assert.deepEqual(camera.children,[background,foreground]);
});

import {sampleTrajectory} from '../dist/trajectory.js';
test('Adrock masked shadow pivot stays fixed throughout scale while its local zero moves',async()=>{
 const source={ks:{p:{k:[339,808.5,0]},a:{k:[327,796.5,0]}}},data={layers:[source]};
 assert.equal(source.parent,undefined);assert.deepEqual(source.ks.p.k,[339,808.5,0]);
 const before=JSON.stringify(data),f=svgFixture(),a=source.ks.a.k,p=source.ks.p.k;
 const layer={layerElement:f.group,finalTransform:{mProp:{a:{v:a}}}},r={elements:[layer]},n={...node,layerRoute:[0],shapeRoute:[],kind:'layer',sourceType:'1'};
 let firstZero,lastZero;
 const samples=await sampleTrajectory(32,49,frame=>{const scale=(69-(frame-32)/17*16)/100;const matrix={a:scale,b:0,c:0,d:scale,e:p[0]-scale*a[0],f:p[1]-scale*a[1]};f.group.getScreenCTM=()=>matrix;if(frame===32)firstZero=matrix.f;if(frame===49)lastZero=matrix.f;return selectedLottieOrigin(r,n,[]);});
 assert.ok(lastZero-firstZero>127);for(const sample of samples){assert.ok(Math.abs(sample.point.x-339)<1e-9);assert.ok(Math.abs(sample.point.y-808.5)<1e-9);}assert.equal(JSON.stringify(data),before);
 layer.finalTransform.mProp.a.v=[NaN,0];assert.equal(selectedLottieOrigin(r,n,[]),null);
});
test('group pivot cancels squash and reads fresh animated anchor and parent/precomp projection',()=>{
 const f=svgFixture(),anchor={v:[204,169]},group={gr:f.group,it:[{transform:{mProps:{a:anchor}}},{}]},r={elements:[{elements:[{layerElement:f.cover,itemsData:[group]}]}]};
 const n={...node,shapeRoute:[0,1]};
 for(const [sx,sy]of [[1,1],[1.36,.59],[.8,1.2]]){f.group.getScreenCTM=()=>({a:sx,b:0,c:0,d:sy,e:335-sx*204,f:370.27769-sy*169});const p=selectedLottieOrigin(r,n,[]);assert.ok(Math.abs(p.x-335)<1e-9);assert.ok(Math.abs(p.y-370.27769)<1e-9);}
 // A composed rotating/scaled ancestor matrix, supplied by native getScreenCTM.
 f.group.getScreenCTM=()=>({a:0,b:2,c:-3,d:0,e:123,f:456});anchor.v=[7,7];assert.deepEqual(selectedLottieOrigin(r,n,[]),{x:102,y:470,space:'espace du groupe de formes'});
 anchor.v=[8,9];assert.deepEqual(selectedLottieOrigin(r,n,[]),{x:96,y:472,space:'espace du groupe de formes'});
 f.group.getScreenCTM=()=>({a:0,b:2,c:-3,d:0,e:133,f:476});assert.deepEqual(selectedLottieOrigin(r,n,[]),{x:106,y:492,space:'espace du groupe de formes'});
});

test('onion selection keeps exact shared-paint contributions, unions groups and excludes hidden geometry',()=>{
 const f=svgFixture(),shared=f.paint,other=f.doc.createElementNS('','path');f.cover.append(other);
 const base={...node,layerRoute:[0],shapeRoute:[0],parentId:'group'},nodes=[{...base,id:'group',parentId:null,kind:'group',shapeRoute:[]},{...base,id:'a'},{...base,id:'b',shapeRoute:[1]},{...base,id:'c',shapeRoute:[2]}];
 const renderer={elements:[{layerElement:f.group,itemsData:[{styles:[{pElem:shared}],caches:['M0,0L1,1']},{styles:[{pElem:shared}],caches:['M2,2L3,3']},{styles:[{pElem:other}],caches:['M4,4L5,5']}]}]};
 const single=onionSelectedPaint(renderer,nodes,['a'],[]);assert.equal(single.size,1);assert.equal(single.get(shared),'M0,0L1,1');
 const multi=onionSelectedPaint(renderer,nodes,['a','c'],[]);assert.equal(multi.size,2);assert.equal(multi.get(other),'M4,4L5,5');
 const grouped=onionSelectedPaint(renderer,nodes,['group'],[]);assert.equal(grouped.get(shared),'M0,0L1,1 M2,2L3,3');
 assert.equal(onionSelectedPaint(renderer,nodes,['group'],['group']).size,0);
 f.cover.setAttribute('display','none');assert.equal(onionSelectedPaint(renderer,nodes,['c'],[]).size,0);
});
test('onion copy filtering retains clip/mask definitions and ancestors without altering current paint',()=>{
 const f=svgFixture(),proto=Object.getPrototypeOf(f.svg);Object.defineProperty(proto,'localName',{get(){return this.tagName;}});
 proto.cloneNode=function(deep){const copy=f.doc.createElementNS('',this.tagName);copy.attrs={...this.attrs};if(deep)copy.append(...this.children.map(e=>e.cloneNode(true)));return copy;};
 const defs=f.doc.createElementNS('','defs'),mask=f.doc.createElementNS('','mask'),maskPaint=f.doc.createElementNS('','path'),sibling=f.doc.createElementNS('','rect');defs.append(mask);mask.append(maskPaint);f.svg.append(defs);f.cover.append(sibling);
 f.group.setAttribute('transform','translate(20,30)');f.group.setAttribute('mask','url(#mask)');f.paint.setAttribute('d','M0,0L1,1 M2,2L3,3');const before=JSON.stringify(f.paint.attrs),ghost=f.doc.createElementNS('','g');
 cloneOnionPaint(f.svg,ghost,[],new Map([[f.paint,'M0,0L1,1']]));const all=f.descendants(ghost);
 assert.equal(all.filter(e=>e.localName==='rect').length,0);assert.equal(all.filter(e=>e.localName==='path').length,2);assert.ok(all.some(e=>e.getAttribute('transform')==='translate(20,30)'&&e.getAttribute('mask')==='url(#mask)'));assert.ok(all.some(e=>e.getAttribute('d')==='M0,0L1,1'));assert.equal(JSON.stringify(f.paint.attrs),before);assert.equal(sibling.parentElement,f.cover);
 const full=f.doc.createElementNS('','g');cloneOnionPaint(f.svg,full,[]);assert.equal(f.descendants(full).filter(e=>e.localName==='rect').length,1);
});

test('selected onion paint survives auxiliary isolation but still excludes authored hidden paint',()=>{
 const f=svgFixture(),proto=Object.getPrototypeOf(f.svg);
 Object.defineProperties(proto,{localName:{get(){return this.tagName;}},id:{get(){return this.attrs.id??'';},set(v){this.attrs.id=v;}},attributes:{get(){return Object.entries(this.attrs).map(([name,value])=>({name,value,localName:name,namespaceURI:null}));}},firstChild:{get(){return this.children[0]??null;}}});
 proto.setAttributeNS=function(ns,k,v){this.setAttribute(k,v);};proto.querySelectorAll=function(selector){return f.descendants(this).filter(e=>selector==='*'||selector==='[id]'&&e.id||selector==='svg'&&e.localName==='svg'||selector==='[data-lottie-view-transform]'&&e.getAttribute('data-lottie-view-transform')!==null);};proto.querySelector=function(s){return this.querySelectorAll(s)[0]??null;};
 proto.cloneNode=function(deep){const copy=f.doc.createElementNS('',this.tagName);copy.attrs={...this.attrs};if(deep)copy.append(...this.children.map(e=>e.cloneNode(true)));return copy;};f.doc.createElement=tag=>f.doc.createElementNS('',tag);

 f.doc.defaultView.getComputedStyle=element=>{
  let visibility='visible';for(let p=element;p;p=p.parentElement){if(p.attrs.visibility!==undefined){visibility=p.attrs.visibility;break;}if(/visibility:hidden/.test(p.style.cssText??'')){visibility='hidden';break;}}
  return {display:element.attrs.display??'inline',visibility,opacity:element.attrs.opacity??'1'};
 };
 const target=f.doc.createElement('div');target.append(f.svg);let instance;
 const player={loadAnimation(options){const svg=f.doc.createElementNS('','svg'),paint=f.doc.createElementNS('','path'),other=f.doc.createElementNS('','path');paint.setAttribute('data-subject','selected');other.setAttribute('data-subject','other');svg.append(paint,other);options.container.append(svg);const listeners={};
  instance={isLoaded:false,paint,renderer:{elements:[{layerElement:svg,itemsData:[{styles:[{pElem:paint}],caches:['M0,0L10,10']},{styles:[{pElem:other}],caches:['M20,20L30,30']}]}]},addEventListener(k,fn){listeners[k]=fn;},removeEventListener(k){delete listeners[k];},goToAndStop(){},destroy(){},loaded(){listeners.DOMLoaded?.();}};return instance;
 }};
 const shape={ty:'sh',ks:{a:0,k:{v:[[0,0],[10,10]],i:[[0,0],[0,0]],o:[[0,0],[0,0]],c:false}}},source={id:'selected',revision:'1',label:'Selected',data:{w:100,h:100,fr:30,ip:0,op:60,layers:[{ty:4,ip:0,op:60,shapes:[shape,shape]}]}};
 const id='["selected","1"]/layers/0/shapes/0',settings=normalize({onionEnabled:true,onionStep:5}),onion=createLottieOnionSkin(target,source,player);
 const painted=()=>f.descendants(f.svg).filter(e=>e.getAttribute('data-onion-frame')!==null).flatMap(e=>f.descendants(e)).filter(e=>e.getAttribute('data-subject')!==null);
 onion.update(30,false,false,settings,[],[id]);instance.loaded();assert.equal(painted().length,4);assert.ok(painted().every(e=>e.getAttribute('data-subject')==='selected'));
 instance.paint.setAttribute('visibility','hidden');onion.update(31,false,false,settings,[],[id]);assert.equal(painted().length,0);
 instance.paint.removeAttribute('visibility');onion.update(32,false,false,settings,[id],[id]);assert.equal(painted().length,0);
 onion.update(33,false,false,settings,[],[]);assert.equal(painted().length,8);onion.dispose();
});
