import type {LottiePathType} from './pathTypes.js';
import type {LottiePathAppearance} from './pathAppearance.js';
import type { ViewerIntent, ViewerPort, ViewerSnapshot } from '@konitif/viewer';

export interface LottieSource {
  id: string;
  revision: string;
  label: string;
  /** Host-admitted, immutable source. The vendor receives its own clone. */
  data: Record<string, unknown>;
}
export interface LottieReading extends ViewerSnapshot {
  source: LottieSource | null;
  timeSeconds: number;
  durationSeconds: number;
  isolateSelection?: boolean;
  hiddenIds?: readonly string[];
  expandedIds?: readonly string[];
  hoveredIds?: readonly string[];
  hoverOrigin?: 'viewport' | 'list';
  playing: boolean;
  loop: boolean;
  loading?: boolean;
  error?: string | null;
}
export type LottieIntent = ViewerIntent
  | { type: 'set-selection-isolation'; enabled: boolean }
  | { type: 'set-expanded'; id: string; expanded: boolean }
  | { type: 'set-visibility'; id: string; visible: boolean }
  | { type: 'hover'; ids: readonly string[]; origin: 'viewport' | 'list' }
  | { type: 'play' | 'pause' }
  | { type: 'seek'; seconds: number }
  | { type: 'set-loop'; enabled: boolean }
  | { type: 'load-source'; id: string }
  | {type:'import-source';data:Record<string,unknown>;label:string}
  | {type:'new-composition';width:number;height:number;fps:number;duration:number;label?:string};
/** A reading projection borrows this port; it does not own the host or its clock. */
export interface LottieViewerHost extends ViewerPort<LottieReading, LottieIntent> {
  subscribe(listener: () => void): () => void;
  editing?: LottieEditingPort;
  canImport?:boolean;
  sources: readonly { id: string; label: string }[];
}
export interface LottieProfile {
  width: number;
  height: number;
  frameRate: number;
  inFrame: number;
  outFrame: number;
  durationSeconds: number;
  frameCount: number;
  warnings: readonly string[];
}
export interface LottieTransformFrame {
 pivot:{x:number;y:number};
 /** Screen to parent and screen to local linear maps, in SVG coefficient order. */
 parentInverse:readonly number[];localInverse:readonly number[];own:readonly number[];
}
export interface LottieRenderer {
  /** Return false without mutation when a revision needs full reconstruction. */
  updateSource?(source:LottieSource):boolean;
  /** Reveal a prepared projection only after its current frame and selection are painted. */
  activate?():void;
  /** Frames are relative to the source in-point, not absolute AE frame numbers. */
  renderFrame(relativeFrame: number): void;
  setOnionTime?(relativeFrame:number,loop:boolean,playing:boolean):void;
  hitTest?(clientX: number, clientY: number): readonly string[];
  select?(ids: readonly string[], hoveredIds?: readonly string[]): void;
  selectionBounds?(): readonly LottieSelectionBounds[];
  setSelectionIsolation?(enabled: boolean): void;
  setVisibility?(hiddenIds: readonly string[]): void;
  inspectionSummary?(): string;
  pathTypes?():Readonly<Record<string,LottiePathType>>;
  pathInfluences?():Readonly<Record<string,readonly string[]>>;
  isVisible?(ids: readonly string[]): boolean;
  /** View zoom controls inspection marker size, independently of source transforms. */
  setViewScale?(scale:number):void;
  setPathAppearance?(appearance:Partial<LottiePathAppearance>):void;
  setShowPaths?(enabled:boolean):void;
  previewTransform?(id:string,screenDelta:readonly number[]):boolean;
  clearTransformPreview?():void;
  gradientSpace?(id:string):readonly number[]|null;
  transformFrame?(id:string):LottieTransformFrame|null;
  translationDelta?(id:string,dx:number,dy:number):{dx:number;dy:number}|null;
  resize(): void;
  dispose(): void;
}
export type LottieRendererFactory = (target: HTMLElement, source: LottieSource) => Promise<LottieRenderer>;

/** Screen-space bounds of admitted individual projected geometry, never aggregate shared fill bounds. */
export interface LottieSelectionBounds { id:string; bounds:{left:number;top:number;right:number;bottom:number;width:number;height:number} }
export type LottieRectangleSelectionMount = (target:HTMLElement, options:{targets():readonly LottieSelectionBounds[];canStart?(x:number,y:number):boolean;select(ids:readonly string[]):void}) => {cancel():void;dispose():void};

/** Commands are admitted and executed by the document host, never by a paint overlay. */
export interface LottieNumericEdit {
 id:string;pointer:string;ownerId:string;label:string;frame:number;axes:string[];value:number[]|null;
 editable:boolean;canCreate:boolean;staticValue:boolean;reason:string;unit?:string;min?:number;max?:number;interpolation?:'hold'|'linear'|'curve';canLinearize?:boolean;
}
export interface LottiePenVertex {point:[number,number];in:[number,number];out:[number,number];}
export interface LottiePenStyle {color:string;width:number;opacity:number;}
export interface LottiePenState {vertices:readonly LottiePenVertex[];style:LottiePenStyle;}
export type LottieEditCommand = {type:'gradient-color-key';id:string}| {type:'style-fit-gradient';id:string}| {type:'style-add-stroke';id:string}| {type:'style-options';id:string;change:{field:'lc'|'lj'|'r'|'t';value:number}|{field:'paint';value:'solid'|'gradient'}|{field:'stop';index:number;position:number;color:readonly number[]}}| {type:'move-keys';keys:readonly {trackId:string;pointer:string;frame:number;nextFrame:number}[]}| {type:'move-key';trackId:string;pointer:string;frame:number;nextFrame:number}| {type:'transform';id:string;values:Partial<Record<'p'|'a'|'s'|'r',readonly number[]>>}|{type:'set-interpolation';trackId:string;pointer:string;frame:number;mode:'hold'|'linear'|'ease-in'|'ease-out'|'ease-in-out'}|{type:'delete-keys';keys:readonly {trackId:string;pointer:string;frame:number}[]}|{type:'pen-add';point:[number,number]}|{type:'pen-tangent';out:[number,number]}|{type:'pen-style';style:LottiePenStyle}|{type:'pen-finish'}|{type:'pen-cancel'}|{type:'target-key';trackId:string;pointer:string;frame:number}|{type:'begin-value';trackId:string;pointer:string}|{type:'preview-value';value:readonly number[]}|{type:'commit-value'}|{type:'cancel-value'}|{type:'set-mode';mode:'inspect'|'move'|'rotate'|'scale'|'pivot'|'pen'}|{type:'undo'}|{type:'redo'}|{type:'linear-key';trackId:string;pointer:string}|{type:'create-key';trackId:string;pointer:string}|{type:'set-value';trackId:string;pointer:string;value:readonly number[]}|{type:'translate';id:string;dx:number;dy:number;atCurrentTime?:boolean};
export interface LottieEditingPort {
 read(options?:{atCurrentTime?:boolean}):{mode:'inspect'|'move'|'rotate'|'scale'|'pivot'|'pen';canUndo:boolean;canRedo:boolean;message:string;properties:readonly LottieNumericEdit[];gradient?:{id:string;frame:number;value:readonly number[]|null;staticValue:boolean;canCreate:boolean;editable:boolean;reason:string};pen?:LottiePenState};
 dispatch(command:LottieEditCommand):void;
 exportJSON():string;
}
