import type { AnimationItem, AnimationConfigWithData, CanvasRendererConfig, LottiePlayer } from 'lottie-web';
import type { LottieProfile, LottieSource } from './contracts.js';
import { inspectLottieProfile } from './profile.js';

export const LOTTIE_CANVAS_MAX_DIMENSION = 2048;
export const LOTTIE_CANVAS_MAX_PIXELS = 2048 * 2048;

/** A borrowed host canvas, driven only by explicit relative-frame requests. */
export interface LottieCanvasOutput {
  readonly canvas: HTMLCanvasElement;
  readonly profile: LottieProfile;
  /** True only when the integer source frame was repainted. No vendor autoplay. */
  renderFrame(relativeFrame: number): boolean;
  /** Read the host's current canvas dimensions; the host remains their owner. */
  resize(): void;
  dispose(): void;
}

export interface LottieCanvasOutputOptions {
  signal?: AbortSignal;
  /** Bounds initialization failure, independently of any playback time. */
  loadTimeoutMs?: number;
}

function assertCanvasDimensions(canvas: HTMLCanvasElement): void {
  if (![canvas.width, canvas.height].every(value => Number.isInteger(value) && value > 0 && value <= LOTTIE_CANVAS_MAX_DIMENSION)
    || canvas.width * canvas.height > LOTTIE_CANVAS_MAX_PIXELS) {
    throw new RangeError('Lottie canvas: output dimensions exceed the rendering budget');
  }
}

function abortError(): Error {
  return new DOMException('Lottie canvas: preparation cancelled', 'AbortError');
}

function waitForPlayer(load: () => Promise<LottiePlayer>, signal: AbortSignal | undefined, timeoutMs: number): Promise<LottiePlayer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); };
    const finish = (error: unknown, player?: LottiePlayer) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(player!);
    };
    const aborted = () => finish(abortError());
    const timer = setTimeout(() => finish(new Error('Lottie canvas: provider preparation timed out')), timeoutMs);
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) { aborted(); return; }
    Promise.resolve().then(load).then(player => finish(null, player), error => finish(error));
  });
}

function waitForReady(animation: AnimationItem, signal: AbortSignal | undefined, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      animation.removeEventListener('DOMLoaded', loaded);
      animation.removeEventListener('data_failed', failed);
      signal?.removeEventListener('abort', aborted);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve();
    };
    const loaded = () => finish();
    const failed = () => finish(new Error('Lottie canvas: source preparation failed'));
    const aborted = () => finish(abortError());
    animation.addEventListener('DOMLoaded', loaded);
    animation.addEventListener('data_failed', failed);
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) { aborted(); return; }
    if (animation.isLoaded) { loaded(); return; }
    timer = setTimeout(failed, timeoutMs);
  });
}

/** Injection seam used to qualify the native adapter without a browser clock. */
export async function createCanvasOutputWithPlayer(
  canvas: HTMLCanvasElement,
  source: LottieSource,
  loadPlayer: () => Promise<LottiePlayer>,
  options: LottieCanvasOutputOptions = {}
): Promise<LottieCanvasOutput> {
  const profile = inspectLottieProfile(source.data);
  assertCanvasDimensions(canvas);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Lottie canvas: a 2D context is required');
  if (options.signal?.aborted) throw abortError();
  const timeoutMs = options.loadTimeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new RangeError('Lottie canvas: invalid preparation timeout');
  }
  const startedAt = performance.now();
  const player = await waitForPlayer(loadPlayer, options.signal, timeoutMs);
  if (options.signal?.aborted) throw abortError();
  let animation: AnimationItem | undefined;
  try {
    const rendererSettings: CanvasRendererConfig & { runExpressions: boolean; progressiveLoad: boolean } = {
      context, clearCanvas: true, dpr: 1, preserveAspectRatio: 'xMidYMid meet',
      runExpressions: false, progressiveLoad: false
    };
    // In the pinned vendor a wrapper takes precedence over the context and
    // creates a different canvas. The native context path MUST omit container.
    // Its runtime supports this path although its declaration requires container.
    const config: Omit<AnimationConfigWithData<'canvas'>, 'container'> = {
      renderer: 'canvas', loop: false, autoplay: false,
      animationData: structuredClone(source.data), rendererSettings
    };
    animation = player.loadAnimation(config as AnimationConfigWithData<'canvas'>);
    await waitForReady(animation, options.signal, Math.max(1, timeoutMs - (performance.now() - startedAt)));
    const current = animation;
    current.setSubframe(false);
    let disposed = false;
    let lastFrame: number | null = null;
    return {
      canvas,
      profile,
      renderFrame(relativeFrame) {
        if (disposed) return false;
        if (!Number.isFinite(relativeFrame)) throw new RangeError('Lottie canvas: frame must be finite');
        const frame = Math.min(profile.frameCount - 1, Math.max(0, Math.floor(relativeFrame)));
        if (frame === lastFrame) return false;
        current.goToAndStop(frame, true);
        lastFrame = frame;
        return true;
      },
      resize() {
        if (disposed) return;
        assertCanvasDimensions(canvas);
        current.resize();
        lastFrame = null;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        current.destroy();
      }
    };
  } catch (error) {
    animation?.destroy();
    throw error;
  }
}

/** Lazy import keeps the package declaration and unrelated Tools vendor-free. */
export function createLottieCanvasOutput(
  canvas: HTMLCanvasElement,
  source: LottieSource,
  options?: LottieCanvasOutputOptions
): Promise<LottieCanvasOutput> {
  return createCanvasOutputWithPlayer(canvas, source,
    async () => (await import('lottie-web/build/player/lottie_light_canvas.js')).default as unknown as LottiePlayer,
    options);
}
