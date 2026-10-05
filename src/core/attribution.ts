import type { BatchAttribution } from './batch.js';

export const UTM_PARAMETERS = [
  ['utm_source', 'source'],
  ['utm_medium', 'medium'],
  ['utm_campaign', 'campaign'],
] as const;
export const AD_CLICK_PARAMETERS = [
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ttclid',
  'li_fat_id',
  'twclid',
  'dclid',
] as const;
export const MAX_UTM_VALUE_LENGTH = 64;
export const MAX_REFERRER_HOST_LENGTH = 128;

const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const WWW_PREFIX = /^www\./;

export interface AttributionSource {
  readonly search: string;
  readonly referrer: string | undefined;
  readonly ownHost: string;
}

type Utm = NonNullable<BatchAttribution['utm']>;

function readUtm(parameters: URLSearchParams): Utm | undefined {
  const entries = UTM_PARAMETERS.flatMap(([parameter, field]) => {
    const value = parameters.get(parameter)?.trim().slice(0, MAX_UTM_VALUE_LENGTH);
    return value ? [[field, value] as const] : [];
  });
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(WWW_PREFIX, '');
  } catch {
    return undefined;
  }
}

function referrerHost(referrer: string | undefined, ownHost: string): string | undefined {
  const host = referrer ? hostOf(referrer) : undefined;
  const isUsable =
    host !== undefined &&
    host.length <= MAX_REFERRER_HOST_LENGTH &&
    HOSTNAME_PATTERN.test(host) &&
    host !== ownHost.toLowerCase().replace(WWW_PREFIX, '');
  return isUsable ? host : undefined;
}

export function buildAttribution(source: AttributionSource): BatchAttribution {
  const parameters = new URLSearchParams(source.search);
  const utm = readUtm(parameters);
  const host = referrerHost(source.referrer, source.ownHost);
  return {
    ...(host === undefined ? {} : { referrer_host: host }),
    ...(utm === undefined ? {} : { utm }),
    from_ad_click: AD_CLICK_PARAMETERS.some((parameter) => parameters.has(parameter)),
  };
}
