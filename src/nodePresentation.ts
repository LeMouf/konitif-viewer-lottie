import {classifyLottiePath,lottiePathTypes,lottieTypeColor,lottieNeutralColor,type LottiePathType} from './pathTypes.js';
import type {LottieLineageType} from './lineageTypes.js';
import type {LottiePathNode} from './paths.js';
export type LottieNodeIcon='composition'|'vector'|'solid'|'null'|'text'|'group'|'path'|'shape'|'mask'|'style';
export function lottieNodePresentation(node:LottiePathNode,options:{colorMode?:'uniform'|'type';evaluatedType?:LottiePathType;lineage?:LottieLineageType;color?:string}={}):{label:string;icon:LottieNodeIcon;tone:string;colors:readonly string[];typeCaption:string;maskLabel:string;details:string}{
 const types:Record<string,[string,LottieNodeIcon,string]>={
  '0':['Précomposition','composition','#a4afd3'],'1':['Solide couleur','solid','#9ec7b6'],'3':['Calque nul','null','#aab3bf'],'4':['Calque vectoriel','vector','#93bed1'],'5':['Texte','text','#c7add3'],
  fl:['Remplissage','style','#aab3bf'],st:['Contour','style','#aab3bf'],gf:['Remplissage dégradé','style','#aab3bf'],gs:['Contour dégradé','style','#aab3bf'],
  mask:['Masque vectoriel','mask','#d1bc91'],gr:['Groupe','group','#b4bfcd'],sh:['Tracé Bézier','path','#91c8cf'],el:['Ellipse','shape','#9ec6c7'],rc:['Rectangle','shape','#9ec6c7'],sr:['Étoile / polygone','shape','#9ec6c7']
 };
 const fallback:Record<LottiePathNode['kind'],[string,LottieNodeIcon,string]>={document:['Animation','composition','#aab3bf'],layer:['Calque','vector','#aab3bf'],precomposition:types['0'],group:types.gr,path:types.sh,shape:['Forme','shape','#9ec6c7'],mask:types.mask,style:['Style','style','#aab3bf']};
 let [label,icon,tone]=types[node.sourceType??'']??fallback[node.kind];
 const geometry=['path','shape','mask'].includes(node.kind)||!!node.solid;
 const type=options.evaluatedType??classifyLottiePath(node);
 if(node.kind==='path')label=options.evaluatedType||node.sourcePathType?lottiePathTypes[type].label:node.animatedPath?'Tracé animé':label;
 const effective=options.lineage?.types??(geometry?[type]:[]),appearance={colorMode:options.colorMode??'uniform',color:options.color??'#95afbd'};
 // Role accents belong to the shared tree presentation, not geometry paint.
 const lighter=(color:string)=>'#'+[1,3,5].map(offset=>Math.round(parseInt(color.slice(offset,offset+2),16)*0.72+255*0.28).toString(16).padStart(2,'0')).join('');
 let colors=[...new Set(effective.map(type=>lottieTypeColor(type,appearance)))];
 if(appearance.colorMode==='type'){
  if(node.kind==='layer'&&node.sourceType==='4')colors=['#93bed1'];
  else if(node.kind==='group')colors=colors.map(lighter);
 }
 tone=colors.length===1?colors[0]:lottieNeutralColor;
 const inherited=options.lineage?.basis==='inherited'||options.lineage?.basis==='affected';
 const typeCaption=inherited&&effective.length?`${label} · ${effective.length===1?lottiePathTypes[effective[0]].label:'Mixte ('+effective.length+')'}`:label;
 const lineageDetails=inherited&&effective.length?`${options.lineage?.basis==='affected'?'Géométries influencées':'Couleurs héritées'} : ${effective.map(type=>lottiePathTypes[type].label).join(', ')}. Identité ${label.toLocaleLowerCase()} conservée.`:'';
 const modes:Record<string,string>={a:'addition',s:'soustraction',i:'intersection',n:'désactivé',f:'différence'};
 const symbols:Record<string,string>={a:'+',s:'−',i:'∩',n:'off',f:'≠'};
 const masks=node.masks??[];
 return{label,icon,tone,colors,typeCaption,maskLabel:masks.length?`${masks.length>1?masks.length+' masques':'Masque'} ${[...new Set(masks.map(mask=>symbols[mask.mode]??'?'))].join(' ')}`:'',
  details:[node.note,lineageDetails,node.animatedPath?'Couleur par type : géométrie évaluée au temps courant.':'',node.color?`Couleur source : ${node.color}.`:'',...masks.map(mask=>`${mask.label} : ${modes[mask.mode]??mask.mode}${mask.inverted?', inversé':''}. ${mask.qualified?'Tracé source du masque et repères pris en charge, en lecture seule.':'Masque non qualifié pour le clic géométrique.'} Aucune édition de masque.`)].filter(Boolean).join(' ')};
}
