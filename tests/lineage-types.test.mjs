import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveLottieTypeLineage} from '../dist/lineageTypes.js';
import {lottieNodePresentation} from '../dist/nodePresentation.js';
import {createLottieHighlight,readProjectedTypeData} from '../dist/highlight.js';
import {normalizeLottiePathAppearance} from '../dist/pathAppearance.js';
import {indexLottiePaths} from '../dist/paths.js';
import {svgFixture} from './svg-dom.mjs';
const node=(id,parentId,kind,sourceType)=>({id,parentId,kind,sourceType,selectable:true,layerRoute:[0],shapeRoute:[]});
test('one effective geometry type propagates through groups and precomps without retyping containers',()=>{
 const nodes=[node('root',null,'precomposition','0'),node('layer','root','layer','4'),node('group','layer','group','gr'),node('path','group','path','sh')];
 for(const type of ['line-open','bezier-open','bezier-closed']){const result=resolveLottieTypeLineage(nodes,{path:type});for(const id of ['root','layer','group'])assert.deepEqual(result[id],{types:[type],basis:'inherited'});const p=lottieNodePresentation(nodes[2],{colorMode:'type',lineage:result.group});assert.equal(p.label,'Groupe');assert.match(p.typeCaption,/Groupe · /);}
 nodes[3]={...nodes[3],kind:'shape',sourceType:'el'};assert.deepEqual(resolveLottieTypeLineage(nodes).root.types,['ellipse']);
});
test('mixed branches are deterministic sets, not majority/source order, and nulls stay neutral',()=>{
 const nodes=[node('root',null,'group','gr'),node('e','root','shape','el'),node('line','root','path','sh'),node('e2','root','shape','el'),node('null','root','layer','3')];
 const result=resolveLottieTypeLineage(nodes,{line:'line-open'}),reordered=resolveLottieTypeLineage([...nodes].reverse(),{line:'line-open'});
 assert.deepEqual(result.root.types,['line-open','ellipse']);assert.deepEqual(result.root,reordered.root);assert.deepEqual(result.null.types,[]);
 const p=lottieNodePresentation(nodes[0],{colorMode:'type',lineage:result.root});assert.equal(p.colors.length,2);assert.match(p.typeCaption,/Mixte \(2\)/);
 assert.deepEqual(lottieNodePresentation(nodes[0],{colorMode:'uniform',color:'#123456',lineage:result.root}).colors,['#123456']);
});
test('style palette and selection follow actual shared paint contributions only',()=>{
 const f=svgFixture(),g=f.doc.createElementNS('', 'path');f.group.append(g);
 const nodes=[node('layer',null,'layer','4'),{...node('line','layer','path','sh'),shapeRoute:[0]},{...node('ellipse','layer','shape','el'),shapeRoute:[1]},{...node('style','layer','style','st'),shapeRoute:[2]}];
 const renderer={elements:[{itemsData:[{caches:['M0 0L10 10'],styles:[{pElem:f.paint}]},{caches:['M0 0C0 10 10 10 10 0Z'],styles:[{pElem:g}]},{style:{pElem:f.paint}}]}]};
 const data=readProjectedTypeData(renderer,nodes);assert.deepEqual(data.influences.style,['line']);const resolved=resolveLottieTypeLineage(nodes,data.types,data.influences);assert.deepEqual(resolved.style.types,['line-open']);assert.deepEqual(resolved.layer.types,['line-open','ellipse']);
 const highlight=createLottieHighlight(renderer,nodes);highlight.update(['style'],[],false,normalizeLottiePathAppearance({colorMode:'type'}),data.influences);assert.deepEqual(f.descendants(f.svg).filter(e=>e.getAttribute('data-lottie-highlight')).map(e=>[e.getAttribute('data-lottie-highlight'),e.getAttribute('stroke')]),[['line','#56b4e9']]);highlight.dispose();
});
test('masked solid is the primary geometric subject, and geometry observation updates inheritance',()=>{
 const solid={...node('solid',null,'layer','1'),solid:'single-additive'},mask=node('mask','solid','mask','mask');assert.deepEqual(resolveLottieTypeLineage([solid,mask]).solid.types,['masked-solid']);
 const root=node('root',null,'group','gr'),path=node('p','root','path','sh');assert.deepEqual(resolveLottieTypeLineage([root,path],{p:'line-open'}).root.types,['line-open']);assert.deepEqual(resolveLottieTypeLineage([root,path],{p:'bezier-open'}).root.types,['bezier-open']);
});
test('source styles and nulls retain separate identities and read-only capabilities',()=>{
 const nodes=indexLottiePaths({id:'test',revision:'1',data:{w:100,h:100,fr:30,ip:0,op:60,layers:[{ty:3,nm:'Null'},{ty:4,shapes:[{ty:'gr',it:[{ty:'sh'},{ty:'st'},{ty:'fl'}]}]}]}});assert.equal(nodes[0].selectable,true);assert.match(nodes[0].note,/origine locale/);assert.equal(nodes.filter(n=>n.kind==='style').length,2);assert.ok(nodes.filter(n=>n.kind==='style').every(n=>n.selectable));
});

test('style incidence remains known before geometry caches are evaluated outside the active time range',()=>{
 const f=svgFixture(),leaf={id:'leaf',parentId:null,kind:'path',sourceType:'sh',sourcePathType:'line-open',selectable:true,layerRoute:[0],shapeRoute:[0]},style={id:'style',parentId:null,kind:'style',sourceType:'st',selectable:true,layerRoute:[0],shapeRoute:[1]};
 const renderer={elements:[{itemsData:[{caches:[],styles:[{pElem:f.paint}]},{style:{pElem:f.paint}}]}]};const data=readProjectedTypeData(renderer,[leaf,style]);assert.deepEqual(data.influences.style,['leaf']);assert.deepEqual(resolveLottieTypeLineage([leaf,style],data.types,data.influences).style.types,['line-open']);
});

test('type accents distinguish vector layers and lighter groups while preserving geometry and uniform mode',()=>{
 const layer={kind:'layer',sourceType:'4'},group={kind:'group',sourceType:'gr'},path={kind:'path',sourceType:'sh'};
 const lineage={types:['bezier-open'],basis:'inherited'};
 assert.equal(lottieNodePresentation(layer,{colorMode:'type',lineage}).tone,'#93bed1');
 assert.equal(lottieNodePresentation(group,{colorMode:'type',lineage}).tone,'#edba47');
 assert.equal(lottieNodePresentation(path,{colorMode:'type',evaluatedType:'bezier-open'}).tone,'#e69f00');
 assert.deepEqual(lottieNodePresentation(group,{colorMode:'type',lineage:{types:['bezier-open','ellipse'],basis:'inherited'}}).colors,['#edba47','#47b99a']);
 assert.equal(lottieNodePresentation(layer,{colorMode:'uniform',color:'#123456',lineage}).tone,'#123456');
 assert.equal(lottieNodePresentation(group,{colorMode:'uniform',color:'#123456',lineage}).tone,'#123456');
});
