import {classifyStaticSourcePath,sourcePathClosure,type LottiePathType} from './pathTypes.js';
import type { LottieSource } from './contracts.js';
import { inspectLottieProfile } from './profile.js';

export interface LottiePathNode {
  id: string; parentId: string | null; label: string; depth: number;
  kind: 'layer' | 'precomposition' | 'group' | 'path' | 'shape' | 'mask' | 'style' | 'document';
  layerRoute: number[]; shapeRoute: number[];
  selectable: boolean; note: string;
  solid?: 'unmasked' | 'single-additive' | 'unsupported';
  sourcePathType?:LottiePathType; sourceClosed?:boolean; animatedPath?:boolean;
  sourceType?: string; color?:string; maskIndex?:number; maskQualified?:boolean;
  masks?:readonly {label:string;mode:string;inverted:boolean;qualified:boolean}[];
}
type RecordValue = Record<string, any>;
const sourceIndexes=new WeakMap<LottieSource,{data:LottieSource['data'];revision:string;nodes:readonly LottiePathNode[]}>();
/** Identities refer to source occurrences, qualified by immutable source revision. */
export function indexLottiePaths(source: LottieSource, options?:{immutable?:boolean}): readonly LottiePathNode[] {
  const cached=sourceIndexes.get(source);
  if(cached?.data===source.data&&cached.revision===source.revision)return cached.nodes;
  inspectLottieProfile(source.data);
  const result: LottiePathNode[] = [];
  const prefix = JSON.stringify([source.id, source.revision]);
  const assets = new Map(((source.data.assets ?? []) as RecordValue[]).map(a => [a.id, a]));
  const add = (value: Omit<LottiePathNode, 'id'>) => {
    if (result.length >= 5000) throw new Error('Trop d’occurrences pour la liste des tracés.');
    const node = { ...value, id: `${prefix}/layers/${value.layerRoute.join('/')}/${value.maskIndex!==undefined?'masks/'+value.maskIndex+'/pt':'shapes/'+value.shapeRoute.join('/')}` };
    result.push(node); return node;
  };
  const shapes = (items: RecordValue[], parent: LottiePathNode, route: number[], blocked: boolean, merged: boolean) => {
    const repeated = blocked || items.some(item => item.ty === 'rp');
    const merge = merged || items.some(item => item.ty === 'mm');
    items.forEach((item, i) => {
      const kind = item.ty === 'gr' ? 'group' : item.ty === 'sh' ? 'path' : ['el', 'rc', 'sr'].includes(item.ty) ? 'shape' : ['fl','st','gf','gs'].includes(item.ty)?'style':null;
      if (!kind) return;
      const node = add({ parentId: parent.id, label: String(item.nm ?? ({ sh:'Tracé', el:'Ellipse', rc:'Rectangle', sr:'Étoile', gr:'Groupe',fl:'Remplissage',st:'Contour',gf:'Remplissage dégradé',gs:'Contour dégradé' } as RecordValue)[item.ty]),
        kind, sourceType:item.ty,...(kind==='path'?{sourcePathType:classifyStaticSourcePath(item.ks?.k),sourceClosed:sourcePathClosure(item.ks),animatedPath:item.ks?.a===1}:{}), depth: parent.depth + 1, layerRoute: parent.layerRoute, shapeRoute: [...route, i], selectable: !repeated && !item.hd,
        note: repeated ? 'Répétiteur : correspondance individuelle non prise en charge.' : item.hd ? 'Masqué dans la source.' : merge ? 'Géométrie projetée ; fusion des tracés non garantie.' : kind === 'path' ? 'Tracé Bézier projeté.' : kind === 'shape' ? 'Forme paramétrique projetée.' : kind==='style'?'Style source ; inspection des contributions géométriques réellement associées par le moteur.':'Ensemble des tracés du groupe.' });
      if (kind === 'group') shapes(item.it ?? [], node, node.shapeRoute, repeated, merge);
    });
  };
  const layers = (items: RecordValue[], parent: LottiePathNode | null, route: number[]) => items.forEach((layer, i) => {
    const masks=layer.masksProperties??[];
    const simpleMask=masks.length===1&&masks[0].mode==='a'&&!masks[0].inv&&masks[0].cl===true&&masks[0].o?.k===100&&(masks[0].x?.k??0)===0;
    const solid=layer.ty===1?(layer.tt||layer.td?'unsupported':!masks.length?'unmasked':simpleMask?'single-additive':'unsupported'):undefined;
    const node = add({ parentId: parent?.id ?? null, label: String(layer.nm ?? `Calque ${i + 1}`),
      kind: layer.ty === 0 ? 'precomposition' : 'layer', sourceType:String(layer.ty),
      ...(layer.ty===1&&/^#[0-9a-f]{6}$/i.test(layer.sc??'')?{color:layer.sc}:{}),
      ...(masks.length?{masks:masks.map((mask:RecordValue,i:number)=>({label:String(mask.nm??`Masque ${i+1}`),mode:String(mask.mode??'unknown'),inverted:!!mask.inv,qualified:solid==='single-additive'}))}:{}), depth: (parent?.depth ?? -1) + 1,
      layerRoute: [...route, i], shapeRoute: [], selectable: [0,1,3,4].includes(layer.ty) && !layer.hd, ...(solid?{solid:solid as LottiePathNode['solid']}:{}),
      note: solid ? (solid==='unsupported'?'Calque solide : sélection de structure ; contour et clic indisponibles pour ce masque.':solid==='single-additive'?'Solide couleur avec masque vectoriel source ; sélectionner le calque inspecte aussi le tracé du masque, en lecture seule.':'Calque solide rectangulaire ; contour projeté, sans tracé source éditable.') : layer.ty === 0 ? `Instance de précomposition ${layer.refId}.` : layer.ty === 4 ? 'Ensemble des tracés du calque.' : layer.ty===3?'Calque nul : origine locale (0,0) transformée, inspection depuis l’arbre ; repère sans prise au clic dans le dessin.':'Texte : tracés individuels non exposés.' });
    masks.forEach((mask:RecordValue,i:number)=>add({parentId:node.id,label:String(mask.nm??`Masque ${i+1}`),kind:'mask',sourceType:'mask',maskIndex:i,maskQualified:solid==='single-additive',depth:node.depth+1,layerRoute:node.layerRoute,shapeRoute:[],selectable:solid==='single-additive'&&!layer.hd,note:solid==='single-additive'?'Tracé vectoriel source du masque (masksProperties[].pt), évalué au temps courant ; sommets et contrôles en lecture seule.':'Tracé source de masque : combinaison ou projection non qualifiée pour les repères et le clic.'}));
    if (layer.ty === 4) shapes(layer.shapes ?? [], node, [], !!layer.hd, false);
    if (layer.ty === 0 && !layer.hd) layers(assets.get(layer.refId)?.layers ?? [], node, node.layerRoute);
  });
  layers(source.data.layers as RecordValue[], null, []);
  if(options?.immutable||cached)sourceIndexes.set(source,{data:source.data,revision:source.revision,nodes:result});
  return result;
}

export function selectedPathLeaves(nodes: readonly LottiePathNode[], ids: readonly string[],influences:Readonly<Record<string,readonly string[]>>={}): LottiePathNode[] {
  const selected = new Set(ids.flatMap(id=>[id,...(influences[id]??[])])), byId = new Map(nodes.map(node => [node.id, node]));
  return nodes.filter(node => {
    if (!node.selectable || (!['path','shape','mask'].includes(node.kind)&&!node.solid)) return false;
    // Selecting a solid already projects its own mask. The explicit mask subject
    // is an alternate inspection target, not a duplicate painted contribution.
    if(node.kind==='mask')return selected.has(node.id);
    let current: LottiePathNode | undefined = node;
    while (current) { if (selected.has(current.id)) return true; current = current.parentId ? byId.get(current.parentId) : undefined; }
    return false;
  });
}
