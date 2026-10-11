import type { LottieProfile } from './contracts.js';

/** Bounded vector prototype budget; shared by archive/JSON decoding and admission. */
export const LOTTIE_MAX_JSON_BYTES = 512 * 1024;
/** Total embedded layers, including technical reveal mattes and precompositions. */
export const LOTTIE_MAX_EMBEDDED_LAYERS = 128;

/** Deliberately narrow reading profile. This is not a sandbox for arbitrary uploads. */
export function inspectLottieProfile(data: Record<string, unknown>): LottieProfile {
  const numeric = (key: string) => {
    const n = data[key];
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`Lottie: invalid ${key}`);
    return n;
  };
  const width = numeric('w'), height = numeric('h'), frameRate = numeric('fr');
  const inFrame = numeric('ip'), outFrame = numeric('op');
  if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || frameRate <= 0 || frameRate > 120
      || inFrame < 0 || outFrame - inFrame < 1 || (outFrame - inFrame) / frameRate > 120) {
    throw new Error('Lottie: dimensions or interval outside the reading profile');
  }
  if (!Array.isArray(data.layers)) throw new Error('Lottie: missing layers');
  if (new TextEncoder().encode(JSON.stringify(data)).length > LOTTIE_MAX_JSON_BYTES) throw new Error('Lottie: file exceeds 512 KiB');
  const assets = Array.isArray(data.assets) ? data.assets as Record<string, unknown>[] : [];
  const assetMap = new Map<string, Record<string, unknown>>();
  for (const asset of assets) {
    if (!asset || typeof asset.id !== 'string' || assetMap.has(asset.id) || !Array.isArray(asset.layers)
      || 'p' in asset || 'u' in asset) throw new Error('Lottie: only embedded vector precompositions are admitted');
    assetMap.set(asset.id, asset);
  }
  let nodes = 0, layers = 0, mergePaths = 0;
  const visit = (value: unknown, depth: number): void => {
    if (++nodes > 100000 || depth > 64) throw new Error('Lottie: structure exceeds the reading budget');
    if (typeof value === 'string' && /(?:https?:|data:|javascript:|file:|\\\\)/i.test(value)) {
      throw new Error('Lottie: external or executable resource reference refused');
    }
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    if (!value || typeof value !== 'object') return;
    const o = value as Record<string, unknown>;
    if (typeof o.x === 'string') throw new Error('Lottie: expressions are not admitted');
    if (o.ddd || (Array.isArray(o.ef) && o.ef.length) || 'segments' in o || 'fPath' in o) {
      throw new Error('Lottie: 3D, effects, external fonts and segmented loading are not admitted');
    }
    if (o.ty === 'mm') mergePaths++;
    if (typeof o.ty === 'number' && 'ks' in o) {
      if (++layers > LOTTIE_MAX_EMBEDDED_LAYERS) throw new Error('Lottie: layer count exceeds the reading budget');
      if (![0, 1, 3, 4, 5].includes(o.ty)) throw new Error('Lottie: unsupported layer');
      if (o.ty === 5 && (!Array.isArray(data.chars) || !data.chars.length)) throw new Error('Lottie: text requires embedded glyphs');
    }
    for (const [key, item] of Object.entries(o)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Lottie: unsafe key');
      visit(item, depth + 1);
    }
  };
  visit(data, 0);
  const inspectRefs = (list: unknown[], ancestors: Set<string>, depth: number): void => {
    if (depth > 20) throw new Error('Lottie: precomposition nesting exceeds the reading budget');
    for (const entry of list) {
      const layer = entry as Record<string, unknown>;
      if (layer.ty !== 0) continue;
      const id = String(layer.refId), asset = assetMap.get(id);
      if (!asset || ancestors.has(id)) throw new Error('Lottie: missing or cyclic precomposition');
      inspectRefs(asset.layers as unknown[], new Set([...ancestors, id]), depth + 1);
    }
  };
  inspectRefs(data.layers, new Set(), 0);
  return { width, height, frameRate, inFrame, outFrame,
    durationSeconds: (outFrame - inFrame) / frameRate, frameCount: Math.floor(outFrame - inFrame),
    warnings: mergePaths ? [`${mergePaths} opérations de fusion de chemins : fidélité au rendu d’origine non établie.`] : [] };
}

export function frameAtSeconds(profile: LottieProfile, seconds: number): number {
  if (!Number.isFinite(seconds)) throw new Error('Lottie: time must be finite');
  return Math.min(profile.frameCount - 1, Math.max(0, seconds * profile.frameRate));
}
