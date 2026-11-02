import {readLottieSourceProfile} from './sourceProfile.js';
import {indexLottiePaths,type LottiePathNode} from './paths.js';
import type {LottieSource} from './contracts.js';
type RecordValue=Record<string,any>;
export interface LottieKeyReference {pointer:string;index:number;frame:number;raw:Readonly<RecordValue>;}
export interface LottieTrackReference {pointer:string;ownerId:string;ancestors:readonly string[];selectable:boolean;}
export interface LottieSourceInspectionKey {id:string;timeSeconds:number|null;label:string;valueLabel:string;detail:string;terminal:boolean;active:boolean;transition?:{kind:'hold'|'linear'|'curve'|'ease-in'|'ease-out'|'ease-in-out'|'unknown';editable:boolean};}
export interface LottieSourcePropertyTrack {id:string;kind:string;label:string;source:LottieTrackReference;keys:{id:string;timeSeconds:number;value:unknown;source:LottieKeyReference}[];inspectionKeys:LottieSourceInspectionKey[];sourceKeys:LottieKeyReference[];metadata:{timeMapping:{scale:number;offset:number;rootInFrame:number;fps:number}|null;visibleRootFrames:{start:number;end:number}};}
const record = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = (value: string | number) => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const number = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
function valueLabel(value: unknown): string {
  if (value === undefined) return 'Fin de segment · sans valeur initiale';
  if (Array.isArray(value) && value.some((item) => record(item) && Array.isArray(item.v))) {
    const path = value.find((item) => record(item) && Array.isArray(item.v));
    return `Chemin ${path.c ? 'fermé' : 'ouvert'} · ${path.v.length} sommets`;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === 'number'))
    return `[${value.map((item) => Number(item.toFixed(5))).join(', ')}]`;
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
const propertyLabels: Record<string, string> = {
  p: 'Position',
  a: 'Ancrage',
  s: 'Échelle',
  r: 'Rotation',
  rz: 'Rotation Z',
  rx: 'Rotation X',
  ry: 'Rotation Y',
  o: 'Opacité',
  c: 'Couleur',
  w: 'Largeur',
  ks: 'Tracé',
  pt: 'Tracé du masque',
  tm: 'Remappage temporel'
};
function propertyLabel(layer: RecordValue, path: (string | number)[]): string {
  const name = String(path.at(-1));
  const parent = path.slice(0, -1).reduce<any>((value, key) => value?.[key], layer);
  if (name === 'k' && path.at(-2) === 'g') {
    const paint = path.slice(0, -2).reduce<any>((value, key) => value?.[key], layer);
    if (paint?.ty === 'gf' || paint?.ty === 'gs') return 'Couleurs du dégradé';
  }
  if ((path[0] === 'ks' && path.length === 2) || parent?.ty === 'tr') return propertyLabels[name] ?? name;
  if (parent?.ty === 'tm' || (path[0] === 't' && path.at(-2) === 's'))
    return ({ s: 'Début', e: 'Fin', o: 'Décalage', a: 'Amplitude' } as Record<string, string>)[name] ?? name;
  if (parent?.ty === 'el' || parent?.ty === 'rc')
    return ({ s: 'Dimensions', p: 'Position', r: 'Arrondi' } as Record<string, string>)[name] ?? name;
  if (parent?.ty === 'gf' || parent?.ty === 'gs')
    return (
      ({ s: 'Début du dégradé', e: 'Fin du dégradé', o: 'Opacité', w: 'Largeur' } as Record<string, string>)[
        name
      ] ?? name
    );
  if (path[0] === 't')
    return (
      (
        {
          s: 'Échelle',
          p: 'Position',
          r: 'Rotation',
          o: 'Opacité',
          fc: 'Couleur de remplissage',
          sc: 'Couleur de contour',
          sw: 'Largeur du contour',
          d: 'Document de texte'
        } as Record<string, string>
      )[name] ?? name
    );
  if (path[0] === 'masksProperties')
    return (
      (
        { pt: 'Tracé du masque', o: 'Opacité du masque', x: 'Dilatation du masque' } as Record<string, string>
      )[name] ?? name
    );
  if (name === 's' || name === 'a') return name; // Unknown dialect context: retain source token rather than guess its meaning.
  return propertyLabels[name] ?? name;
}
/** Dialect projection only: no evaluation, generated samples, source edits or runtime. */
export function projectLottieSourceProperties(source: LottieSource, options:{includeStatic?:boolean}={}) {
  const profile = readLottieSourceProfile(source),
    nodes: readonly LottiePathNode[] = indexLottiePaths(source),
    nodeById = new Map(nodes.map((node) => [node.id, node]));
  const prefix = JSON.stringify([source.id, source.revision]);
  const tracks: LottieSourcePropertyTrack[] = [],
    notes = new Set<string>();
  const assets = new Map(
    ((source.data.assets ?? []) as RecordValue[]).map((asset, index) => [asset.id, { asset, index }])
  );
  const ancestorIds = (node: LottiePathNode) => {
    const ids: string[] = [];
    let current: LottiePathNode | undefined = node;
    while (current) {
      ids.push(current.id);
      current = current.parentId ? nodeById.get(current.parentId) : undefined;
    }
    return ids;
  };
  function visit(
    layers: RecordValue[],
    route: number[],
    pointer: string,
    mapping: { scale: number; offset: number } | null,
    active: { start: number; end: number },
    hidden: boolean
  ) {
    layers.forEach((layer, index) => {
      const layerRoute = [...route, index],
        base = `${prefix}/layers/${layerRoute.join('/')}`;
      const layerNode = nodeById.get(`${base}/shapes/`);
      if (!layerNode) return;
      const map = (frame: number) => (mapping ? mapping.offset + mapping.scale * frame : null);
      const first = map(number(layer.ip, 0)),
        last = map(number(layer.op, profile.outFrame));
      const visible =
        first === null || last === null
          ? active
          : {
              start: Math.max(active.start, Math.min(first, last)),
              end: Math.min(active.end, Math.max(first, last))
            };
      const concealed = hidden || !!layer.hd;
      function owner(path: (string | number)[]) {
        if (path[0] === 'masksProperties') return nodeById.get(`${base}/masks/${path[1]}/pt`) ?? layerNode!;
        if (path[0] !== 'shapes') return layerNode!;
        const shapeRoute: number[] = [];
        let best = layerNode!;
        for (let i = 0; i < path.length - 1; i++)
          if ((path[i] === 'shapes' || path[i] === 'it') && typeof path[i + 1] === 'number') {
            shapeRoute.push(path[i + 1] as number);
            best = nodeById.get(`${base}/shapes/${shapeRoute.join('/')}`) ?? best;
          }
        return best;
      }
      function scan(value: unknown, path: (string | number)[]) {
        if (!value || typeof value !== 'object') return;
        if(options.includeStatic && record(value) && value.a!==1 && (record(value.k)&&Array.isArray(value.k.v)&&Array.isArray(value.k.i)&&Array.isArray(value.k.o)||typeof value.k==='number'||Array.isArray(value.k)&&value.k.length>0&&value.k.length<=(path.at(-1)==='k'&&path.at(-2)==='g'?1024:4)&&value.k.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)))) {
          const target=owner(path),sourcePointer=`${pointer}/${index}/${path.map(escape).join('/')}`,id=`${base}/properties/${path.map(escape).join('/')}`;
          if (tracks.length >= 8192) throw new Error('Trop de pistes pour cette projection.');
          tracks.push({id,kind:'lottie.source-property',label:propertyLabel(layer,path)+(record(value.k)&&Array.isArray((value.k as RecordValue).v)?' · '+(value.k as RecordValue).v.length+' sommets · statique':''),source:{pointer:sourcePointer,ownerId:target.id,ancestors:ancestorIds(target),selectable:target.selectable},keys:[],inspectionKeys:[],sourceKeys:[],metadata:{timeMapping:mapping?{...mapping,rootInFrame:profile.inFrame,fps:profile.frameRate}:null,visibleRootFrames:{...visible}}});return;
        }
        if (
          record(value) &&
          Array.isArray(value.k) &&
          (value.k.length > 1 || options.includeStatic && value.a===1 && value.k.length===1) &&
          value.k.every((key) => record(key) && Number.isFinite(key.t))
        ) {
          if (tracks.length >= 8192) throw new Error('Trop de pistes pour cette projection.');
          const target = owner(path),
            ancestors = ancestorIds(target);
          const sourcePointer = `${pointer}/${index}/${path.map(escape).join('/')}`;
          const id = `${base}/properties/${path.map(escape).join('/')}`;
          const inspectionKeys: LottieSourceInspectionKey[] = [];
          const keys: LottieSourcePropertyTrack['keys'][number][] = [];
          const numericVector=(raw:unknown)=>Array.isArray(raw)&&raw.length>0&&raw.length<=(sourcePointer.endsWith('/g/k')?1024:4)&&raw.every(item=>typeof item==='number'&&Number.isFinite(item))?raw:null;
          const numericKeys=value.k.map((key:RecordValue)=>numericVector(key.s));
          const handle=(raw:unknown,axis:number,fallback:number)=>typeof raw==='number'?raw:Array.isArray(raw)?raw[axis]??raw[0]??fallback:fallback;
          for (const [keyIndex, key] of value.k.entries()) {
            const rootFrame = map(key.t),
              seconds = rootFrame === null ? null : (rootFrame - profile.inFrame) / profile.frameRate;
            const keyId = `${id}/keys/${keyIndex}`;
            const following=value.k[keyIndex+1],numeric=numericKeys[keyIndex];
            const outgoing=record(key.o)?key.o:{},incoming=record(key.i)?key.i:{};
            const diagonal=numeric?.every((_:unknown,axis:number)=>handle(outgoing.x,axis,0)===handle(outgoing.y,axis,0)&&handle(incoming.x,axis,1)===handle(incoming.y,axis,1));
            const handles=[key.o?.x,key.o?.y,key.i?.x,key.i?.y].map(value=>Array.isArray(value)?(value.every(item=>item===value[0])?value[0]:NaN):value);
            const presets=[['ease-in',[0.42,0,1,1]],['ease-out',[0,0,0.58,1]],['ease-in-out',[0.42,0,0.58,1]]] as const;
            const preset=presets.find(([,values])=>values.every((value,index)=>value===handles[index]))?.[0];
            const kind=key.h===1?'hold':key.i||key.o?diagonal?'linear':preset??'curve':'unknown';
            const transition=following?{kind:kind as 'hold'|'linear'|'curve'|'ease-in'|'ease-out'|'ease-in-out'|'unknown',editable:!!numeric&&following.t>key.t&&!!(numericKeys[keyIndex+1]??numericVector(key.e))}:undefined;
            const ease =
              key.h === 1
                ? 'Maintien (hold)'
                : kind==='linear'?'Linéaire':key.i || key.o
                  ? 'Bézier source'
                  : key.s===undefined?'Fin de segment sans valeur initiale':'Clé source avec valeur · interpolation non déclarée';
            const detail =
              `${sourcePointer}/k/${keyIndex} · image locale ${key.t} · ${ease}` +
              (seconds === null ? ' · Précomposition remappée : temps global non résolu' : '') +
              (key.i || key.o || key.to || key.ti
                ? ` · ${JSON.stringify({ i: key.i, o: key.o, ti: key.ti, to: key.to })}`
                : '');
            const activeKey =
              !concealed && rootFrame !== null && rootFrame >= visible.start && rootFrame < visible.end;
            inspectionKeys.push({
              id: keyId,
              transition,
              timeSeconds: seconds,
              label:
                seconds === null
                  ? `Image locale ${key.t}`
                  : `${seconds.toFixed(6)} s · image locale ${key.t}`,
              valueLabel: valueLabel(key.s),
              detail:
                detail +
                (concealed
                  ? ' · Calque masqué dans la source'
                  : rootFrame !== null && !activeKey
                    ? ' · Hors plage de visibilité du calque'
                    : ''),
              terminal: key.s === undefined,
              active: activeKey
            });
            // The headless API normalizes negative times. Keep those exact source keys in
            // inspectionKeys, outside its nonnegative viewport, rather than fabricating t=0.
            if (seconds !== null && seconds >= 0)
              keys.push({
                id: keyId,
                timeSeconds: seconds,
                value: key.s,
                source: { pointer: `${sourcePointer}/k/${keyIndex}`, index: keyIndex, frame: key.t, raw: key }
              });
          }
          tracks.push({
            id,
            kind: 'lottie.source-property',
            label: propertyLabel(layer, path),
            source: { pointer: sourcePointer, ownerId: target.id, ancestors, selectable: target.selectable },
            keys,
            inspectionKeys,
            sourceKeys: value.k.map((raw: RecordValue, index: number) => ({
              pointer: `${sourcePointer}/k/${index}`,
              index,
              frame: raw.t,
              raw
            })),
            metadata: {
              timeMapping: mapping
                ? { ...mapping, rootInFrame: profile.inFrame, fps: profile.frameRate }
                : null,
              visibleRootFrames: { ...visible }
            }
          });
          return;
        }
        for (const [key, child] of Object.entries(value))
          if (key !== 'layers') scan(child, [...path, Array.isArray(value) ? Number(key) : key]);
      }
      scan(layer, []);
      if (layer.ty === 0) {
        const asset = assets.get(layer.refId);
        if (!asset) return;
        const stretched = number(layer.sr, 1);
        const childMapping =
          mapping && !layer.tm && stretched !== 0
            ? {
                offset: mapping.offset + mapping.scale * number(layer.st, 0),
                scale: mapping.scale * stretched
              }
            : null;
        if (!childMapping)
          notes.add('Précomposition remappée : clés conservées en temps local, sans placement global.');
        visit(
          asset.asset.layers,
          layerRoute,
          `/assets/${asset.index}/layers`,
          childMapping,
          visible,
          concealed
        );
      }
    });
  }
  visit(
    source.data.layers as RecordValue[],
    [],
    '/layers',
    { scale: 1, offset: 0 },
    { start: profile.inFrame, end: profile.outFrame },
    false
  );
  const outside = tracks
    .flatMap((track) => track.inspectionKeys)
    .filter(
      (key) => key.timeSeconds !== null && (key.timeSeconds < 0 || key.timeSeconds > profile.durationSeconds)
    ).length;
  if (outside) notes.add(`${outside} clés hors de la durée racine, conservées dans la projection source.`);
  notes.add('Valeurs et easing source conservés.');
  const projection = {sourceId:prefix,durationSeconds:profile.durationSeconds,tracks};
  const used = new Set(tracks.flatMap((track) => track.source!.ancestors));
  return {
    ...projection,
    nodes,
    fps: profile.frameRate,
    title: source.label,
    notes: [...notes],
    groups: nodes
      .filter((node) => used.has(node.id))
      .map((node) => ({
        id: node.id,
        parentId: node.parentId,
        depth: node.depth,
        label: node.label,
        navigationRoot: node.kind === 'document'
      }))
  };
}
export type LottieSourceProperties = ReturnType<typeof projectLottieSourceProperties>;
