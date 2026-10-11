import {classifyLottiePath,lottiePathTypes,type LottiePathType} from './pathTypes.js';
import type {LottiePathNode} from './paths.js';
export type LottieStyleSubjects=Readonly<Record<string,readonly string[]>>;
export interface LottieLineageType {types:readonly LottiePathType[];basis:'geometry'|'inherited'|'affected'|'neutral';}
/** Aggregate primary geometry only. Styles do not vote twice; nulls never inherit a geometry type.
 * An owned geometric subject (including a qualified masked solid) takes precedence over children.
 * Mixed sets use canonical palette order, never source order or a majority vote. */
export function resolveLottieTypeLineage(nodes:readonly LottiePathNode[],evaluated:Readonly<Record<string,LottiePathType>>={},influences:LottieStyleSubjects={}):Readonly<Record<string,LottieLineageType>>{
 const byId=new Map(nodes.map(node=>[node.id,node])),children=new Map<string,LottiePathNode[]>(),result:Record<string,LottieLineageType>={},visiting=new Set<string>();
 for(const node of nodes)if(node.parentId)children.set(node.parentId,[...(children.get(node.parentId)??[]),node]);
 const ordered=(types:readonly LottiePathType[])=>Object.keys(lottiePathTypes).filter(type=>types.includes(type as LottiePathType)) as LottiePathType[];
 const neutral=():LottieLineageType=>({types:[],basis:'neutral'});
 const visit=(id:string):LottieLineageType=>{
  if(result[id])return result[id];const node=byId.get(id);if(!node||visiting.has(id))return neutral();visiting.add(id);
  let reading:LottieLineageType;
  if(node.sourceType==='3')reading=neutral();
  else if(['path','shape','mask'].includes(node.kind)||node.solid)reading={types:[evaluated[id]??classifyLottiePath(node)],basis:'geometry'};
  else if(node.kind==='style')reading={types:ordered((influences[id]??[]).flatMap(subject=>visit(subject).types)),basis:'affected'};
  else reading={types:ordered((children.get(id)??[]).filter(child=>child.kind!=='style').flatMap(child=>visit(child.id).types)),basis:'inherited'};
  visiting.delete(id);return result[id]=reading.types.length?reading:neutral();
 };
 for(const node of nodes)visit(node.id);return result;
}
