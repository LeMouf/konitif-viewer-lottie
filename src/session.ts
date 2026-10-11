import type { LottieProfile, LottieRenderer, LottieSource, LottieViewerHost, LottieReading } from './contracts.js';
import { frameAtSeconds, inspectLottieProfile } from './profile.js';

/** Owns only the reading occurrence, never playback or the borrowed host. */
export function createLottieReadingSession(options: {
  host: LottieViewerHost;
  createRenderer(source: LottieSource): Promise<LottieRenderer>;
  present(reading: LottieReading, profile: LottieProfile | null, ready: boolean, inspection?: string): void;
  report(error: unknown): void;
}) {
  let closed = false, generation = 0, key: string | null = null, activeKey: string | null = null, activeId: string | null = null;
  let renderer: LottieRenderer | null = null, profile: LottieProfile | null = null, desiredProfile: LottieProfile | null = null;
  let pending = Promise.resolve();
  let lastFrame: number | null = null;
  const isCurrent = () => !!renderer && activeKey === key;
  const paint = () => {
    if (closed) return false;
    const reading = options.host.read();
    try {
      // Keep the prior image during a document revision, but never pick or paint
      // that revision with IDs or time belonging to the incoming source.
      if (!isCurrent()) { options.present(reading, desiredProfile, false); return true; }
      const frame = profile ? frameAtSeconds(profile, reading.timeSeconds) : 0;
      if (renderer && frame !== lastFrame) { renderer.renderFrame(frame); lastFrame = frame; }
      renderer?.setOnionTime?.(frame,reading.loop,reading.playing);
      renderer?.setVisibility?.(reading.hiddenIds ?? []);
      renderer?.setSelectionIsolation?.(!!reading.isolateSelection);
      renderer?.select?.(reading.selectedIds, reading.hoveredIds);
      options.present(reading, profile, true, renderer?.inspectionSummary?.());
      return true;
    } catch (error) { options.report(error); return false; }
  };
  const refresh = () => {
    if (closed) return;
    const source = options.host.read().source;
    const nextKey = source ? JSON.stringify([source.id, source.revision]) : null;
    if (nextKey === key) { paint(); return; }
    if(nextKey===activeKey)renderer?.clearTransformPreview?.();
    key = nextKey;
    const ticket = ++generation;
    if (!source || source.id !== activeId) {
      renderer?.dispose(); renderer = null; profile = null; activeKey = null; activeId = null; lastFrame = null;
    }
    desiredProfile = null;
    if (!source) { paint(); return; }
    let nextProfile: LottieProfile;
    try { nextProfile = inspectLottieProfile(source.data); desiredProfile = nextProfile; }
    catch (error) { paint(); options.report(error); return; }
    if(renderer&&source.id===activeId&&activeKey&&renderer.updateSource?.(source)){
      activeKey=nextKey;profile=nextProfile;lastFrame=null;renderer.clearTransformPreview?.();paint();pending=Promise.resolve();return;
    }
    paint();
    pending = Promise.resolve().then(() => {
      // Multiple numeric writes in one turn only construct the latest revision.
      if (closed || ticket !== generation) return null;
      return options.createRenderer(source);
    }).then(result => {
      if (!result) return;
      if (closed || ticket !== generation) { result.dispose(); return; }
      const previous = renderer, previousProfile = profile, previousKey = activeKey, previousId = activeId, previousFrame = lastFrame;
      renderer = result; profile = nextProfile; activeKey = nextKey; activeId = source.id; lastFrame = null;
      if (!paint()) {
        renderer = previous; profile = previousProfile; activeKey = previousKey; activeId = previousId; lastFrame = previousFrame;
        result.dispose(); return;
      }
      previous?.dispose();
      result.activate?.();
    }).catch(error => { if (!closed && ticket === generation) options.report(error); });
  };
  const release = options.host.subscribe(refresh);
  refresh();
  return {
    previewTransform:(id:string,matrix:readonly number[])=>{const changed=isCurrent()&&!!renderer?.previewTransform?.(id,matrix);if(changed)paint();return changed;},
    clearTransformPreview:()=>{renderer?.clearTransformPreview?.();if(isCurrent())paint();},
    isReady:()=>isCurrent(),
    gradientSpace:(id:string)=>isCurrent()?renderer?.gradientSpace?.(id)??null:null,
    transformFrame:(id:string)=>isCurrent()?renderer?.transformFrame?.(id)??null:null,
    translationDelta: (id:string,dx:number,dy:number) => isCurrent() ? renderer?.translationDelta?.(id,dx,dy) ?? null : null,
    selectionBounds: () => isCurrent() ? renderer?.selectionBounds?.() ?? [] : [],
    isVisible: (ids: readonly string[]) => isCurrent() && (renderer?.isVisible?.(ids) ?? false),
    hitTest: (x: number, y: number) => isCurrent() ? renderer?.hitTest?.(x,y) ?? [] : [],
    settled: () => pending,
    refreshView: paint,
    resize() { renderer?.resize(); paint(); },
    dispose() { if (closed) return; closed = true; ++generation; release(); renderer?.dispose(); renderer = null; }
  };
}
