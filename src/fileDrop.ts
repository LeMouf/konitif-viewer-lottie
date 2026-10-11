import {readDroppedLottieFile} from './fileImport.js';import type {LottieViewerHost} from './contracts.js';
export function mountLottieFileDrop(target:HTMLElement,host:LottieViewerHost){
 const note=target.ownerDocument.createElement('div');note.setAttribute('data-lottie-file-drop','');note.setAttribute('role','status');note.style.cssText='position:absolute;inset:8px;display:none;align-items:center;justify-content:center;border:2px dashed var(--color-action-primary,#56b5ff);border-radius:8px;background:rgba(10,20,30,.88);color:#fff;pointer-events:none;z-index:5;padding:16px;text-align:center';target.append(note);let depth=0,closed=false,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
 const files=(e:DragEvent)=>!!e.dataTransfer&&Array.from(e.dataTransfer.types).includes('Files');
 const message=(text:string)=>{clearTimeout(timer);note.textContent=text;note.style.display='flex';};const hide=()=>{note.style.display='none';depth=0;};
 const enter=(e:DragEvent)=>{if(!files(e))return;e.preventDefault();e.stopPropagation();depth++;message('Déposer une composition Lottie');};
 const over=(e:DragEvent)=>{if(!files(e))return;e.preventDefault();e.stopPropagation();e.dataTransfer!.dropEffect='copy';};
 const leave=(e:DragEvent)=>{if(!files(e))return;e.stopPropagation();if(--depth<=0)hide();};
 const drop=async(e:DragEvent)=>{if(!files(e))return;e.preventDefault();e.stopPropagation();depth=0;const ticket=++generation,source=host.read().source,list=Array.from(e.dataTransfer!.files);message('Lecture de la composition…');
  try{if(list.length!==1)throw Error('Déposez une seule composition à la fois.');const imported=await readDroppedLottieFile(list[0]);if(closed||ticket!==generation)return;if(host.read().source!==source){hide();return;}host.dispatch({type:'import-source',...imported});hide();}
  catch(error){if(closed||ticket!==generation)return;message(error instanceof Error?error.message:'Fichier Lottie illisible.');timer=setTimeout(hide,6000);}
 };
 target.addEventListener('dragenter',enter);target.addEventListener('dragover',over);target.addEventListener('dragleave',leave);target.addEventListener('drop',drop);
 return{dispose(){closed=true;generation++;clearTimeout(timer);target.removeEventListener('dragenter',enter);target.removeEventListener('dragover',over);target.removeEventListener('dragleave',leave);target.removeEventListener('drop',drop);note.remove();}};
}
