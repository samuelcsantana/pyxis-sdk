import { parseRetryAfter, type SendOutcome } from '../core/retry-policy.js';

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
    return retryAfterSeconds === undefined
      ? { kind: 'response', status: response.status }
      : { kind: 'response', status: response.status, retryAfterSeconds };
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
