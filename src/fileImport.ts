import {inspectLottieProfile,LOTTIE_MAX_JSON_BYTES} from './profile.js';
const limit=LOTTIE_MAX_JSON_BYTES,decoder=new TextDecoder('utf-8',{fatal:true});
const fail=()=>new Error('Archive .lottie invalide ou non prise en charge.');
const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
async function archive(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw fail();
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);if(!count||count>256||view.getUint16(end+8,true)!==count||offset+size!==end)throw fail();
 const entries=new Map<string,{method:number;flags:number;crc:number;compressed:number;size:number;offset:number}>();let cursor=offset;
 for(let i=0;i<count;i++){
  if(cursor+46>end||view.getUint32(cursor,true)!==0x02014b50)throw fail();const nameSize=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),next=cursor+46+nameSize+extra+comment;if(next>end)throw fail();
  const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameSize));if(entries.has(name)||name.includes('..')||name.startsWith('/')||name.includes('\\'))throw fail();
  entries.set(name,{flags:view.getUint16(cursor+8,true),method:view.getUint16(cursor+10,true),crc:view.getUint32(cursor+16,true),compressed:view.getUint32(cursor+20,true),size:view.getUint32(cursor+24,true),offset:view.getUint32(cursor+42,true)});cursor=next;
 }
 if(cursor!==end)throw fail();
 async function read(name:string){const entry=entries.get(name);if(!entry||entry.flags&1||![0,8].includes(entry.method)||entry.size>limit||entry.compressed>4*1024*1024||entry.offset+30>offset||view.getUint32(entry.offset,true)!==0x04034b50)throw fail();
  const start=entry.offset+30+view.getUint16(entry.offset+26,true)+view.getUint16(entry.offset+28,true),stop=start+entry.compressed;if(stop>offset)throw fail();let result=bytes.slice(start,stop);
  if(entry.method===8){if(typeof DecompressionStream==='undefined')throw Error('Ce navigateur ne peut pas ouvrir les archives .lottie. Déposez le JSON de l’animation.');const stream=new Blob([result]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),chunks:Uint8Array[]=[];let total=0;
   try{while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.length;if(total>limit||total>entry.size){await reader.cancel();throw fail();}chunks.push(chunk.value);}result=new Uint8Array(total);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}}finally{reader.releaseLock();}
  }
  if(result.length!==entry.size||crc(result)!==entry.crc)throw fail();return JSON.parse(decoder.decode(result));
 }
 const manifest=await read('manifest.json'),animations=manifest?.animations;if(!Array.isArray(animations)||!animations.length)throw fail();
 const selected=animations.find(a=>a.id===(manifest.activeAnimationId??manifest.initial?.animation))??animations[0];if(typeof selected?.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(selected.id))throw fail();
 return read('animations/'+selected.id+'.json');
}
/** Decode only; admission and document authority remain with the host. */
export async function readDroppedLottieFile(file:{name:string;size:number;arrayBuffer():Promise<ArrayBuffer>}){
 if(!/\.(json|lottie)$/i.test(file.name))throw Error('Déposez un fichier Lottie .json ou .lottie.');if(file.size<=0||file.size>4*1024*1024)throw Error('Fichier Lottie trop volumineux.');
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>4*1024*1024)throw Error('Fichier Lottie trop volumineux.');const packed=bytes[0]===0x50&&bytes[1]===0x4b;
 if(!packed&&bytes.length>limit)throw Error('Le JSON dépasse la taille admise.');
 const data=packed?await archive(bytes):JSON.parse(decoder.decode(bytes).replace(/^\uFEFF/,''));if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Composition Lottie invalide.');inspectLottieProfile(data);return {data,label:file.name.replace(/\.(json|lottie)$/i,'')||'Composition importée'};
}
