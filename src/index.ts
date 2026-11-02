import { defineKonitifToolModule } from '@konitif/tools';
export type * from './contracts.js';
export { indexLottiePaths, selectedPathLeaves, type LottiePathNode } from './paths.js';
export { inspectLottieProfile, frameAtSeconds, LOTTIE_MAX_JSON_BYTES } from './profile.js';

/** Declaration only: importing it never loads Lottie, reads a fixture or creates a clock. */
export const lottieViewerToolModule = defineKonitifToolModule({
  id: 'konitif.viewer-lottie', name: 'Lottie', version: '0.2.0', scope: 'generic',
  capability: 'vector-animation-reading', implementationBindingKey: 'konitif.viewer-lottie',
  description: 'Optional Lottie reading projection over Viewer, driven by an explicit host playback port.',
  capabilities: {
    provides: [{ id: 'konitif.viewer-lottie.read', version: '0.1.0' }],
    consumes: [{ id: 'konitif.viewer-lottie.host', versionRange: '^0.1.0', mode: 'required',
      purpose: 'Read an admitted source and request playback through the host; never own canonical time.' }]
  },
  contributions: [{ id: 'konitif.viewer-lottie.surface', kind: 'surface' }]
});

export { lottieAncestors, isLottieNodeHidden, lottieVisibilityState } from './visibility.js';

export {numericPropertyValue,numericPropertyState,writeNumericProperty,insertNumericKey,setNumericKeyLinear,removeNumericKeys,setNumericKeyInterpolation,moveNumericKey,moveNumericKeys} from './numericProperty.js';

export {appendLottieBezier,defaultLottiePenStyle,validateLottiePenStyle} from './drawing.js';
