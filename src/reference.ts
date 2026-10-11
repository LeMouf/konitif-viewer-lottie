/** Explicit qualification-only entry: the default surface never imports this fuller provider. */
import { createRenderer } from './renderer.js';
import type { LottieSource } from './contracts.js';
import type { LottiePlayer } from 'lottie-web';
export const createReferenceRenderer = (target: HTMLElement, source: LottieSource) =>
  createRenderer(target, source, async () => (await import('lottie-web/build/player/lottie_svg.js')).default as unknown as LottiePlayer);
