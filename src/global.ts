import {
  identify,
  init,
  optIn,
  optOut,
  reset,
  track,
  trackingStatus,
  trackRequest,
} from './index.js';

Object.assign(globalThis, {
  pyxis: { init, track, identify, reset, trackRequest, optOut, optIn, trackingStatus },
});
