import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectLottieProfile,LOTTIE_MAX_EMBEDDED_LAYERS} from '../dist/profile.js';

const layer=()=>({ty:4,ks:{},shapes:[]});
const document=count=>({w:512,h:512,fr:60,ip:0,op:300,layers:[{ty:0,ks:{},refId:'embedded'}],assets:[{id:'embedded',layers:Array.from({length:count-1},layer)}]});
test('counts root and embedded vector layers within the explicit reading budget',()=>{
 assert.equal(inspectLottieProfile(document(106)).durationSeconds,5);
 assert.equal(inspectLottieProfile(document(LOTTIE_MAX_EMBEDDED_LAYERS)).durationSeconds,5);
 assert.throws(()=>inspectLottieProfile(document(LOTTIE_MAX_EMBEDDED_LAYERS+1)),/layer count exceeds/);
 const unsupported=document(2);unsupported.assets[0].layers[0].ty=2;
 assert.throws(()=>inspectLottieProfile(unsupported),/unsupported layer/);
});
