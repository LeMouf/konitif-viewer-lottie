import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indexLottiePaths} from '../dist/index.js';
test('pristine sources retain their admitted index, while immutable revisions refresh it',()=>{
 const source={id:'source',revision:'1',label:'Source',data:{v:'5.13.0',w:100,h:100,fr:30,ip:0,op:30,layers:[]}};
 const first=indexLottiePaths(source,{immutable:true});assert.equal(indexLottiePaths(source),first);
 const next={...source,revision:'2',data:{...source.data,layers:[{ty:4,nm:'Shape',ks:{},shapes:[]}]}};
 const changed=indexLottiePaths(next,{immutable:true});assert.notEqual(changed,first);assert(changed.length>first.length);assert.equal(indexLottiePaths(source),first);
 assert.throws(()=>indexLottiePaths({...source,revision:'invalid',data:{...source.data,fr:0}}));
});
