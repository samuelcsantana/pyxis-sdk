import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOWNLOAD_EXTENSIONS,
  formEventOf,
  linkEventOf,
  resolveAutoEvents,
} from './auto-events.js';
import { MAX_PROPERTY_STRING_LENGTH } from './event-input.js';

const PAGE = 'https://shop.example.com/pricing';
const OWN_HOST = 'shop.example.com';
const ALL_ON = resolveAutoEvents({ outboundLinks: true, fileDownloads: true, formSubmits: true });
const SECRET = 'S3cr3tT0k3n';
const SECRET_PARAMETERS = ['token', 'email', 'signature', 'session'] as const;

const secretQuery = fc
  .constantFrom(...SECRET_PARAMETERS)
  .map((parameter) => `?${parameter}=${SECRET}`);
const extension = fc.constantFrom(...DEFAULT_DOWNLOAD_EXTENSIONS);

function propertyValues(event: ReturnType<typeof linkEventOf>): string {
  return JSON.stringify(Object.values(event?.properties ?? {}));
}

describe('automatic events never carry a query string or a fragment', () => {
  it('for any link, wherever it points', () => {
    fc.assert(
      fc.property(
        fc.webUrl({ withQueryParameters: true, withFragments: true }),
        secretQuery,
        fc.boolean(),
        (url, query, hasDownloadAttribute) => {
          const event = linkEventOf(
            {
              href: `${url}${query}#${SECRET}`,
              baseUrl: PAGE,
              ownHost: OWN_HOST,
              hasDownloadAttribute,
            },
            ALL_ON,
          );

          expect(propertyValues(event)).not.toContain(SECRET);
          expect(propertyValues(event)).not.toContain('?');
          expect(propertyValues(event)).not.toContain('#');
        },
      ),
    );
  });

  it('for any download, whose path stays templated and within the property limit', () => {
    fc.assert(
      fc.property(fc.webPath(), extension, secretQuery, (path, fileExtension, query) => {
        const event = linkEventOf(
          {
            href: `/downloads${path}/file.${fileExtension}${query}`,
            baseUrl: PAGE,
            ownHost: OWN_HOST,
            hasDownloadAttribute: false,
          },
          ALL_ON,
        );

        expect(event?.properties.extension).toBe(fileExtension);
        expect(String(event?.properties.file_path)).toMatch(/^\//);
        expect(String(event?.properties.file_path).length).toBeLessThanOrEqual(
          MAX_PROPERTY_STRING_LENGTH,
        );
        expect(propertyValues(event)).not.toContain(SECRET);
      }),
    );
  });

  it('for any form, which keeps at most a label within the property limit', () => {
    fc.assert(
      fc.property(fc.option(fc.string()), fc.option(fc.string()), (id, name) => {
        const { properties } = formEventOf({ id, name });

        expect(Object.keys(properties).every((key) => key === 'form')).toBe(true);
        expect(String(properties.form ?? '').length).toBeLessThanOrEqual(
          MAX_PROPERTY_STRING_LENGTH,
        );
      }),
    );
  });
});
