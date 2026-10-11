import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compositionClipRectangle} from '../dist/picking.js';
const element=(tagName,attrs={},children=[])=>({tagName,children,getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs});
const clip=(shape,attrs={})=>element('clipPath',attrs,[shape]);
test('qualifies both exact rectangle encodings used by the pinned renderer',()=>{
 const expected={x:0,y:0,width:690,height:913};
 assert.deepEqual(compositionClipRectangle(clip(element('rect',{width:'690',height:'913'}))),expected);
 assert.deepEqual(compositionClipRectangle(clip(element('path',{d:'M0,0 L690,0 L690,913 L0,913z'}))),expected);
 assert.deepEqual(compositionClipRectangle(clip(element('path',{d:'M-10,-20 L-10,40 L30,40 L30,-20Z'}))),{x:-10,y:-20,width:40,height:60});
});
test('does not promote curved, open, diagonal, multi-contour or transformed masks to bounding boxes',()=>{
 for(const d of ['M0,0 L690,0 L690,913 L0,913','M0,0 L690,913 L690,0 L0,913z','M0,0 L690,0 L690,913 L0,900z','M0,0 C1,2 3,4 5,6z','M0,0 L690,0 L690,913 L0,913z M0,0','m0,0 l690,0 l0,913 l-690,0z'])assert.equal(compositionClipRectangle(clip(element('path',{d}))),null,d);
 const rect=element('rect',{width:'690',height:'913'});
 assert.equal(compositionClipRectangle(clip(rect,{clipPathUnits:'objectBoundingBox'})),null);
 assert.equal(compositionClipRectangle(clip(rect,{transform:'translate(1)'})),null);
 assert.equal(compositionClipRectangle(element('clipPath',{},[rect,rect])),null);
 assert.equal(compositionClipRectangle(clip(element('rect',{width:'690',height:'913',rx:'8'}))),null);
 assert.equal(compositionClipRectangle(clip(element('rect',{width:'690',height:'913',transform:'scale(2)'}))),null);
});
