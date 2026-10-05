import type { PropertyValue } from './core/batch.js';
import type { PyxisOptions } from './core/options.js';

export type { Batch, BatchAttribution, BatchEvent, PropertyValue } from './core/batch.js';
export type { PyxisDebugOptions, PyxisOptions } from './core/options.js';

export type Properties = Readonly<Record<string, PropertyValue>>;

const doNothing = (): undefined => undefined;

export const init: (options: PyxisOptions) => void = doNothing;
export const track: (name: string, properties?: Properties) => void = doNothing;
export const identify: (userId: string) => void = doNothing;
export const reset: () => void = doNothing;
export const optOut: () => void = doNothing;
export const optIn: () => void = doNothing;
