import type {LottiePenVertex,LottiePenStyle} from './contracts.js';
import {inspectLottieProfile} from './profile.js';
export const defaultLottiePenStyle:LottiePenStyle={color:'#56b4e9',width:3,opacity:100};
export function validateLottiePenStyle(style:LottiePenStyle){if(!/^#[0-9a-f]{6}$/i.test(style.color)||!Number.isFinite(style.width)||style.width<=0||style.width>100||!Number.isFinite(style.opacity)||style.opacity<0||style.opacity>100)throw new Error('Contour invalide.');return {...style};}
export function appendLottieBezier(data:Record<string,any>,vertices:readonly LottiePenVertex[],style:LottiePenStyle){
 inspectLottieProfile(data);validateLottiePenStyle(style);
 if(vertices.length<2||vertices.length>512||vertices.some(v=>[...v.point,...v.in,...v.out].some(n=>!Number.isFinite(n))||[v.point,v.in,v.out].some(a=>a.length!==2)))throw new Error('Un tracé demande entre 2 et 512 sommets valides.');
 const version=String(data.v??'').split('.').map(Number),legacyColor=version[0]<4||(version[0]===4&&(version[1]<1||(version[1]===1&&version[2]<9)));
 const next=structuredClone(data),index=next.layers.length;if(index>=100)throw new Error('Limite de calques atteinte.');
 const pivot=[...vertices[0].point],vector=(value:number[])=>({a:0,k:value}),scalar=(value:number)=>({a:0,k:value});
 const transform={a:vector([0,0]),p:vector(pivot),s:vector([100,100]),r:scalar(0),o:scalar(100),ty:'tr'};
 next.layers.push({ddd:0,ind:Math.max(0,...next.layers.map((l:any)=>Number(l.ind)||0))+1,ty:4,nm:'Courbe '+(index+1),sr:1,ks:{a:vector([0,0,0]),p:vector([0,0,0]),s:vector([100,100,100]),r:scalar(0),o:scalar(100)},ip:data.ip,op:data.op,st:0,bm:0,shapes:[{ty:'gr',nm:'Groupe de courbe',it:[{ty:'sh',nm:'Tracé Bézier',ks:{a:0,k:{c:false,v:vertices.map(v=>[v.point[0]-pivot[0],v.point[1]-pivot[1]]),i:vertices.map(v=>[...v.in]),o:vertices.map(v=>[...v.out])}}},{ty:'st',nm:'Contour',c:vector([1,3,5].map(i=>parseInt(style.color.slice(i,i+2),16)/(legacyColor?1:255))),o:scalar(style.opacity),w:scalar(style.width),lc:2,lj:2,bm:0},transform]}]});
 inspectLottieProfile(next);return {data:next,index};
}
