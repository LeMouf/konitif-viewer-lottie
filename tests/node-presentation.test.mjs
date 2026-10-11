import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indexLottiePaths} from '../dist/paths.js';
import {lottieNodePresentation} from '../dist/nodePresentation.js';
test('source types remain distinct without inferring geometry from their names',()=>{
 const types={0:'Précomposition',1:'Solide couleur',3:'Calque nul',4:'Calque vectoriel',5:'Texte',gr:'Groupe',sh:'Tracé Bézier',el:'Ellipse',rc:'Rectangle',sr:'Étoile / polygone'};
 for(const [sourceType,label]of Object.entries(types)){const p=lottieNodePresentation({sourceType,kind:'layer',note:'read only'});assert.equal(p.label,label);assert.ok(p.icon);}
});
test('solid swatch and mask metadata belong to the layer; mask is a distinct read-only source subject',()=>{
 const source={id:'s',revision:'1',data:{w:100,h:100,fr:30,ip:0,op:60,layers:[{ty:1,nm:'Solid',sc:'#5eac9d',masksProperties:[{nm:'Mask 1',cl:true,mode:'a',inv:false,o:{k:100},x:{k:0}}]}]}};
 const nodes=indexLottiePaths(source);assert.equal(nodes.length,2);assert.equal(nodes[1].kind,'mask');assert.equal(lottieNodePresentation(nodes[1]).label,'Masque vectoriel');const n=nodes[0],p=lottieNodePresentation(n);assert.equal(n.color,'#5eac9d');assert.equal(p.maskLabel,'Masque +');assert.match(p.details,/Mask 1 : addition/);assert.match(p.details,/Aucune édition de masque/);assert.equal(n.kind,'layer');
 source.data.layers[0].masksProperties[0].inv=true;assert.match(lottieNodePresentation(indexLottiePaths(source)[0]).details,/inversé.*non qualifié/);
 source.data.layers[0].sc='url(external)';assert.equal(indexLottiePaths(source)[0].color,undefined);
});
