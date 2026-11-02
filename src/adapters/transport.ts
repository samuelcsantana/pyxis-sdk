import { parseRetryAfter, type SendOutcome } from '../core/retry-policy.js';
import { periodAnswerOf } from '../core/visitor-kind.js';

export interface Transport {
  send(url: string, body: string, pageHidden: boolean): Promise<SendOutcome>;
}

export const BODY_CONTENT_TYPE = 'text/plain;charset=UTF-8';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
export type BeaconLike = (url: string, data: Blob) => boolean;

export function browserTransport(fetchImpl?: FetchLike, beacon?: BeaconLike): Transport {
  const viaBeacon = (url: string, body: string): SendOutcome =>
    beacon?.(url, new Blob([body], { type: BODY_CONTENT_TYPE })) === true
      ? { kind: 'handed-off' }
      : { kind: 'network-error' };

  const viaFetch = async (url: string, body: string): Promise<SendOutcome> => {
    if (fetchImpl === undefined) {
      throw new TypeError('fetch is not available');
    }
    const response = await fetchImpl(url, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': BODY_CONTENT_TYPE },
    });
    const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
    const period = response.ok ? periodAnswerOf(await response.text().catch(() => '')) : undefined;
    return {
      kind: 'response',
      status: response.status,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      ...(period === undefined ? {} : { period }),
    };
  };

  return {
    send: async (url, body, pageHidden) => {
      try {
        return await viaFetch(url, body);
      } catch {
        return pageHidden || fetchImpl === undefined
          ? viaBeacon(url, body)
          : { kind: 'network-error' };
      }
    },
  };
}
