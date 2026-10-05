export const RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 16000];
export const RETRY_JITTER = 0.2;

export type SendOutcome =
  | { readonly kind: 'response'; readonly status: number; readonly retryAfterSeconds?: number }
  | { readonly kind: 'network-error' }
  | { readonly kind: 'handed-off' };

export type SendVerdict = 'done' | 'retry' | 'drop';

const TOO_MANY_REQUESTS = 429;

export function judgeOutcome(outcome: SendOutcome): SendVerdict {
  if (outcome.kind === 'network-error') {
    return 'retry';
  }
  if (outcome.kind === 'handed-off') {
    return 'done';
  }
  const { status } = outcome;
  if (status >= 200 && status < 300) {
    return 'done';
  }
  if (status === TOO_MANY_REQUESTS || status >= 500) {
    return 'retry';
  }
  return 'drop';
}

export function retryDelay(
  attempt: number,
  random: () => number,
  retryAfterSeconds?: number,
): number | undefined {
  const base = RETRY_DELAYS_MS[attempt];
  if (base === undefined) {
    return undefined;
  }
  const jittered = Math.round(base * (1 - RETRY_JITTER + random() * 2 * RETRY_JITTER));
  return retryAfterSeconds === undefined ? jittered : Math.max(jittered, retryAfterSeconds * 1000);
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (header === null || !/^\d+$/.test(header.trim())) {
    return undefined;
  }
  return Number(header.trim());
}
