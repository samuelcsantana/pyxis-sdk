import type { Batch, PropertyValue } from './core/batch.js';

export type { Batch, BatchAttribution, BatchEvent, PropertyValue } from './core/batch.js';

export type Properties = Readonly<Record<string, PropertyValue>>;

export interface PyxisDebugOptions {
  readonly dryRun?: boolean;
  readonly onBatch?: (batch: Batch) => void;
}

export interface PyxisOptions {
  readonly key: string | undefined | null;
  readonly endpoint: string;
  readonly pathRules?: readonly string[];
  readonly autoPageViews?: boolean;
  readonly debug?: PyxisDebugOptions;
}

const doNothing = (): undefined => undefined;

export const init: (options: PyxisOptions) => void = doNothing;
export const track: (name: string, properties?: Properties) => void = doNothing;
export const identify: (userId: string) => void = doNothing;
export const reset: () => void = doNothing;
export const optOut: () => void = doNothing;
export const optIn: () => void = doNothing;
