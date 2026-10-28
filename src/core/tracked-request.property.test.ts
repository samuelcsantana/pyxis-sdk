import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { templatePath } from './path-template.js';
import {
  checkTrackedRequest,
  MAX_HTTP_STATUS,
  MAX_REQUEST_DURATION_MS,
  MAX_ROUTE_LENGTH,
  REQUEST_METHODS,
  routeOf,
  type TrackedRequest,
} from './tracked-request.js';

const ERROR_CODE_PATTERN = /^[a-z0-9_.]{1,64}$/;
const KNOWN_PROPERTY_KEYS: readonly string[] = [
  'method',
  'route',
  'status',
  'duration_ms',
  'error_code',
];

const MAX_GENERATED_WORDS = 20;

const emailAddress = fc.emailAddress();

const longPath = fc
  .array(
    fc.oneof(
      fc.stringMatching(/^[a-z]{5,20}$/),
      fc.stringMatching(/^\d{1,3}[a-z]{1,10}$/),
      fc.stringMatching(/^\d{1,12}$/),
    ),
    {
      minLength: 1,
      maxLength: MAX_GENERATED_WORDS,
      size: 'max',
    },
  )
  .map((words) => `/${words.join('/')}`);

const urlPath = fc.oneof(fc.webPath(), longPath);

const urlCarryingEmails = fc
  .tuple(
    fc.webUrl(),
    urlPath,
    emailAddress,
    emailAddress,
    emailAddress,
    fc.constantFrom('@', '%40'),
  )
  .map(([base, path, inPath, inQuery, inFragment, atSign]) => {
    const pathWithEmail = `${path}/${inPath.replaceAll('@', atSign)}`;
    return `${base}${pathWithEmail}?to=${encodeURIComponent(inQuery)}#${inFragment}`;
  });

const relativeUrl = fc
  .tuple(longPath, emailAddress)
  .map(([path, email]) => `${path}/${email}/settings?email=${email}`);

const anyUrl = fc.oneof(
  urlCarryingEmails,
  relativeUrl,
  fc.webUrl({ withQueryParameters: true, withFragments: true }),
  fc.string({ unit: 'grapheme', maxLength: 60 }),
  fc
    .tuple(fc.constantFrom('http://', 'https://', '//'), fc.string({ maxLength: 20 }))
    .map(([scheme, host]) => `${scheme}${host}`),
  fc.anything(),
);

const anyRequest = fc
  .record(
    {
      method: fc.oneof(fc.constantFrom(...REQUEST_METHODS), fc.anything()),
      url: anyUrl,
      status: fc.oneof(fc.integer({ min: -10, max: MAX_HTTP_STATUS + 10 }), fc.anything()),
      durationMs: fc.oneof(
        fc.integer({ min: -10, max: MAX_REQUEST_DURATION_MS + 10 }),
        fc.double(),
        fc.anything(),
      ),
      errorCode: fc.oneof(fc.stringMatching(ERROR_CODE_PATTERN), fc.anything()),
    },
    { requiredKeys: ['method', 'url', 'status', 'durationMs'] },
  )
  .map((request) => request as TrackedRequest);

const isIntegerWithin = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

describe('routeOf properties', () => {
  it('never returns the query, the fragment or an e-mail address of the URL', () => {
    fc.assert(
      fc.property(fc.oneof(urlCarryingEmails, relativeUrl), (url) => {
        const route = routeOf(url, []) ?? '';

        expect(route).not.toMatch(/[?#@]|%40/i);
        expect(route.length).toBeLessThanOrEqual(MAX_ROUTE_LENGTH);
      }),
    );
  });

  it('returns a route that templating again leaves unchanged, as the API does, whatever the length', () => {
    fc.assert(
      fc.property(fc.oneof(urlCarryingEmails, relativeUrl), (url) => {
        const route = routeOf(url, []);
        fc.pre(route !== undefined);

        expect(templatePath(route, [])).toBe(route);
      }),
    );
  });
});

describe('checkTrackedRequest properties', () => {
  it('never throws, and accepts only a known method, a route, an in-range status and duration and a well-formed error code', () => {
    fc.assert(
      fc.property(anyRequest, (request) => {
        const check = checkTrackedRequest(request, []);
        if (!check.ok) {
          return;
        }
        const { properties } = check;

        expect(Object.keys(properties).every((key) => KNOWN_PROPERTY_KEYS.includes(key))).toBe(
          true,
        );
        expect(REQUEST_METHODS).toContain(properties.method);
        expect(typeof properties.route === 'string' && properties.route.length).toBeLessThanOrEqual(
          MAX_ROUTE_LENGTH,
        );
        expect(isIntegerWithin(properties.status, MAX_HTTP_STATUS)).toBe(true);
        expect(isIntegerWithin(properties.duration_ms, MAX_REQUEST_DURATION_MS)).toBe(true);
        expect(
          properties.error_code === undefined ||
            (typeof properties.error_code === 'string' &&
              ERROR_CODE_PATTERN.test(properties.error_code)),
        ).toBe(true);
      }),
    );
  });
});
