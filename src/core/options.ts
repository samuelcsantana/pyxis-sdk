import type { Batch } from './batch.js';

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

export interface ResolvedOptions {
  readonly key: string;
  readonly batchUrl: string;
  readonly pathRules: readonly string[];
  readonly autoPageViews: boolean;
  readonly dryRun: boolean;
  readonly onBatch?: (batch: Batch) => void;
}

export type OptionsResolution =
  | { readonly ok: true; readonly options: ResolvedOptions }
  | { readonly ok: false; readonly reason: 'no-key' | 'invalid-endpoint' };

export const BATCH_PATH = '/v1/batch';

export function batchUrlFor(endpoint: string): string | undefined {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return undefined;
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${BATCH_PATH}`;
}

export function resolveOptions(options: PyxisOptions): OptionsResolution {
  const key = options.key?.trim();
  if (!key) {
    return { ok: false, reason: 'no-key' };
  }
  const batchUrl = batchUrlFor(options.endpoint);
  if (batchUrl === undefined) {
    return { ok: false, reason: 'invalid-endpoint' };
  }
  const base = {
    key,
    batchUrl,
    pathRules: options.pathRules ?? [],
    autoPageViews: options.autoPageViews ?? true,
    dryRun: options.debug?.dryRun ?? false,
  };
  const onBatch = options.debug?.onBatch;
  return { ok: true, options: onBatch === undefined ? base : { ...base, onBatch } };
}
