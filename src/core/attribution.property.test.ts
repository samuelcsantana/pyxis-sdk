import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AD_CLICK_PARAMETERS,
  buildAttribution,
  MAX_REFERRER_HOST_LENGTH,
  MAX_UTM_VALUE_LENGTH,
  UTM_PARAMETERS,
} from './attribution.js';

const BARE_LOWERCASE_HOST = /^[a-z0-9.-]+$/;
const WWW_PREFIX = 'www.';
const MAX_GENERATED_PARAMETERS = 8;

const knownParameterNames: readonly string[] = [
  ...UTM_PARAMETERS.map(([parameter]) => parameter),
  ...AD_CLICK_PARAMETERS,
];

const parameterName = fc.oneof(
  fc.constantFrom(...knownParameterNames, 'ref', 'email'),
  fc.string({ maxLength: 10 }),
);

const parameterValue = fc.oneof(
  fc.string({ unit: 'grapheme', maxLength: 90 }),
  fc.string({ minLength: MAX_UTM_VALUE_LENGTH - 4, maxLength: MAX_UTM_VALUE_LENGTH + 4 }),
  fc.emailAddress(),
  fc.constantFrom('', '   ', ' google '),
);

const queryParameters = fc.array(fc.tuple(parameterName, parameterValue), {
  maxLength: MAX_GENERATED_PARAMETERS,
});

const toSearch = (parameters: readonly (readonly [string, string])[]) =>
  `?${new URLSearchParams(parameters.map(([name, value]) => [name, value])).toString()}`;

const anyReferrer = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.webUrl({
    authoritySettings: { withIPv4: true, withIPv6: true, withPort: true, withUserInfo: true },
    withQueryParameters: true,
    withFragments: true,
  }),
  fc.string({ unit: 'grapheme', maxLength: 60 }),
  fc
    .array(fc.stringMatching(/^[a-z0-9]{20,40}$/), { minLength: 2, maxLength: 8, size: 'max' })
    .map((labels) => `https://${labels.join('.')}/`),
);

const normalizedHost = (host: string) => {
  const lowercase = host.toLowerCase();
  return lowercase.startsWith(WWW_PREFIX) ? lowercase.slice(WWW_PREFIX.length) : lowercase;
};

describe('buildAttribution properties', () => {
  it(`keeps each UTM value non-empty and at most ${String(MAX_UTM_VALUE_LENGTH)} characters, for any query string`, () => {
    fc.assert(
      fc.property(
        fc.oneof(queryParameters.map(toSearch), fc.string({ unit: 'grapheme' })),
        anyReferrer,
        fc.domain(),
        (search, referrer, ownHost) => {
          const values = Object.values(buildAttribution({ search, referrer, ownHost }).utm ?? {});

          expect(
            values.every((value) => value.length > 0 && value.length <= MAX_UTM_VALUE_LENGTH),
          ).toBe(true);
        },
      ),
    );
  });

  it('marks a visit as an ad click exactly when the query carries an ad click parameter', () => {
    fc.assert(
      fc.property(queryParameters, fc.domain(), (parameters, ownHost) => {
        const attribution = buildAttribution({
          search: toSearch(parameters),
          referrer: undefined,
          ownHost,
        });
        const carriesAdClick = parameters.some(([name]) =>
          (AD_CLICK_PARAMETERS as readonly string[]).includes(name),
        );

        expect(attribution.from_ad_click).toBe(carriesAdClick);
      }),
    );
  });

  it(`keeps only the referrer's bare lowercase host name, at most ${String(MAX_REFERRER_HOST_LENGTH)} characters: no path, query, credentials or port`, () => {
    fc.assert(
      fc.property(anyReferrer, fc.domain(), (referrer, ownHost) => {
        const host = buildAttribution({ search: '', referrer, ownHost }).referrer_host;

        expect(
          host === undefined ||
            (host.length <= MAX_REFERRER_HOST_LENGTH && BARE_LOWERCASE_HOST.test(host)),
        ).toBe(true);
      }),
    );
  });

  it("never reports the site's own host as the referrer, with or without www and in any case", () => {
    const ownSiteReferrer = fc
      .tuple(fc.domain(), fc.boolean(), fc.boolean(), fc.boolean(), fc.webPath())
      .map(([domain, referrerHasWww, ownHostHasWww, upperCase, path]) => {
        const referrerHost = `${referrerHasWww ? WWW_PREFIX : ''}${domain}`;
        return {
          referrer: `https://${upperCase ? referrerHost.toUpperCase() : referrerHost}${path}`,
          ownHost: `${ownHostHasWww ? WWW_PREFIX : ''}${domain}`,
        };
      });

    fc.assert(
      fc.property(
        fc.oneof(ownSiteReferrer, fc.record({ referrer: anyReferrer, ownHost: fc.domain() })),
        ({ referrer, ownHost }) => {
          const host = buildAttribution({ search: '', referrer, ownHost }).referrer_host;

          expect(host === undefined || host !== normalizedHost(ownHost)).toBe(true);
        },
      ),
    );
  });
});
