import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOWNLOAD_EXTENSIONS,
  FILE_DOWNLOAD_EVENT,
  FORM_SUBMIT_EVENT,
  formEventOf,
  linkEventOf,
  OUTBOUND_LINK_EVENT,
  resolveAutoEvents,
  watchesLinks,
} from './auto-events.js';
import { MAX_PROPERTY_STRING_LENGTH } from './event-input.js';

const PAGE = 'https://www.shop.example.com/pricing?coupon=SAVE10';
const OWN_HOST = 'www.shop.example.com';
const ALL_ON = resolveAutoEvents({ outboundLinks: true, fileDownloads: true, formSubmits: true });

function click(href: string, hasDownloadAttribute = false) {
  return { href, baseUrl: PAGE, ownHost: OWN_HOST, hasDownloadAttribute };
}

describe('resolveAutoEvents', () => {
  it('turns every automatic event off unless asked', () => {
    const resolved = resolveAutoEvents({});

    expect(resolved).toEqual({
      outboundLinks: false,
      fileDownloads: false,
      downloadExtensions: new Set(DEFAULT_DOWNLOAD_EXTENSIONS),
      formSubmits: false,
    });
    expect(watchesLinks(resolved)).toBe(false);
  });

  it('accepts only true as on, so a truthy string from a tag manager does not switch one on', () => {
    const loose = { outboundLinks: 'false', formSubmits: 1 } as unknown as Record<string, boolean>;

    expect(resolveAutoEvents(loose)).toMatchObject({ outboundLinks: false, formSubmits: false });
  });

  it.each([
    ['outbound links', { outboundLinks: true }],
    ['file downloads', { fileDownloads: true }],
  ])('watches links when %s are on', (_, options) => {
    expect(watchesLinks(resolveAutoEvents(options))).toBe(true);
  });

  it('replaces the default extensions, normalized, and drops the ones that cannot be one', () => {
    const resolved = resolveAutoEvents({
      fileDownloads: true,
      downloadExtensions: ['.PDF', ' sketch ', 'tar.gz', '', 'a'.repeat(11)],
    });

    expect(resolved.downloadExtensions).toEqual(new Set(['pdf', 'sketch']));
  });
});

describe('linkEventOf, outbound links', () => {
  const OUTBOUND_ONLY = resolveAutoEvents({ outboundLinks: true });

  it('records only the domain of a link to another site, never its path or query', () => {
    expect(
      linkEventOf(click('https://Docs.Partner.example.org/guide/42?ref=abc#top'), OUTBOUND_ONLY),
    ).toEqual({ name: OUTBOUND_LINK_EVENT, properties: { domain: 'docs.partner.example.org' } });
  });

  it('drops the www prefix, as the referrer host does', () => {
    expect(linkEventOf(click('https://www.github.com/'), OUTBOUND_ONLY)).toEqual({
      name: OUTBOUND_LINK_EVENT,
      properties: { domain: 'github.com' },
    });
  });

  it.each([
    ['a relative link', '/checkout'],
    ['the same host', 'https://www.shop.example.com/about'],
    ['the same host without www', 'http://shop.example.com:8080/about'],
    ['an anchor on the page', '#plans'],
  ])('records nothing for %s', (_, href) => {
    expect(linkEventOf(click(href), OUTBOUND_ONLY)).toBeUndefined();
  });

  it('counts another subdomain of the site as another site', () => {
    expect(linkEventOf(click('https://blog.example.com/'), OUTBOUND_ONLY)).toEqual({
      name: OUTBOUND_LINK_EVENT,
      properties: { domain: 'blog.example.com' },
    });
  });

  it.each([
    ['mailto:', 'mailto:ana@example.com'],
    ['tel:', 'tel:+5511999999999'],
    ['javascript:', 'javascript:void(0)'],
    ['ftp:', 'ftp://files.example.org/a.zip'],
    ['an address that is not a URL', 'http://[not an address'],
  ])('ignores %s, which never leads to a web page', (_, href) => {
    expect(linkEventOf(click(href), ALL_ON)).toBeUndefined();
  });

  it(`ignores a domain longer than ${String(MAX_PROPERTY_STRING_LENGTH)} characters`, () => {
    const longHost = `${'a'.repeat(60)}.${'b'.repeat(60)}.example.org`;

    expect(linkEventOf(click(`https://${longHost}/`), OUTBOUND_ONLY)).toBeUndefined();
  });

  it('records nothing for a link to another site when only downloads are on', () => {
    expect(
      linkEventOf(
        click('https://partner.example.org/'),
        resolveAutoEvents({ fileDownloads: true }),
      ),
    ).toBeUndefined();
  });
});

describe('linkEventOf, file downloads', () => {
  const DOWNLOADS_ONLY = resolveAutoEvents({ fileDownloads: true });

  it('records the extension and the templated path, never the query', () => {
    expect(
      linkEventOf(
        click('/files/invoices/20261105123456/report.PDF?signature=s3cr3t'),
        DOWNLOADS_ONLY,
      ),
    ).toEqual({
      name: FILE_DOWNLOAD_EVENT,
      properties: { extension: 'pdf', file_path: '/files/invoices/:id/report.PDF' },
    });
  });

  it('records a file on another site as a download, not as an outbound link', () => {
    expect(linkEventOf(click('https://cdn.example.org/app/setup.dmg'), ALL_ON)).toEqual({
      name: FILE_DOWNLOAD_EVENT,
      properties: { extension: 'dmg', file_path: '/app/setup.dmg' },
    });
  });

  it('records a link to another site as outbound when its extension is not a download', () => {
    expect(linkEventOf(click('https://partner.example.org/index.html'), ALL_ON)).toEqual({
      name: OUTBOUND_LINK_EVENT,
      properties: { domain: 'partner.example.org' },
    });
  });

  it.each([
    ['a page', '/pricing'],
    ['a page with a dot in a folder name', '/v1.2/notes'],
    ['a hidden file', '/.env'],
    ['an extension not in the list', '/styles/site.css'],
  ])('records nothing for %s', (_, href) => {
    expect(linkEventOf(click(href), DOWNLOADS_ONLY)).toBeUndefined();
  });

  it('records a link with the download attribute whatever its extension', () => {
    expect(linkEventOf(click('/export/backup.sqlite', true), DOWNLOADS_ONLY)).toEqual({
      name: FILE_DOWNLOAD_EVENT,
      properties: { extension: 'sqlite', file_path: '/export/backup.sqlite' },
    });
  });

  it('leaves the extension out when a download attribute link has none', () => {
    expect(linkEventOf(click('/export/latest', true), DOWNLOADS_ONLY)).toEqual({
      name: FILE_DOWNLOAD_EVENT,
      properties: { file_path: '/export/latest' },
    });
  });

  it('follows the extensions the options give instead of the default ones', () => {
    const custom = resolveAutoEvents({ fileDownloads: true, downloadExtensions: ['sketch'] });

    expect(linkEventOf(click('/design/home.sketch'), custom)?.name).toBe(FILE_DOWNLOAD_EVENT);
    expect(linkEventOf(click('/manual.pdf'), custom)).toBeUndefined();
  });

  it(`cuts a long path at whole segments within ${String(MAX_PROPERTY_STRING_LENGTH)} characters`, () => {
    const folders = Array.from({ length: 12 }, (_, index) => `folder-${String(index)}`).join('/');

    const event = linkEventOf(click(`/${folders}/manual.pdf`), DOWNLOADS_ONLY);

    expect(event?.properties.extension).toBe('pdf');
    expect(String(event?.properties.file_path).length).toBeLessThanOrEqual(
      MAX_PROPERTY_STRING_LENGTH,
    );
    expect(String(event?.properties.file_path)).toMatch(/^\/folder-0\/folder-1\//);
  });

  it('records nothing for a download when only outbound links are on', () => {
    expect(
      linkEventOf(click('/manual.pdf'), resolveAutoEvents({ outboundLinks: true })),
    ).toBeUndefined();
  });
});

describe('formEventOf', () => {
  it('names the form by its id', () => {
    expect(formEventOf({ id: 'newsletter', name: 'signup' })).toEqual({
      name: FORM_SUBMIT_EVENT,
      properties: { form: 'newsletter' },
    });
  });

  it.each([
    ['no id', null],
    ['an empty id', '   '],
    ['an id that is too long', 'f'.repeat(MAX_PROPERTY_STRING_LENGTH + 1)],
  ])('falls back to the name with %s', (_, id) => {
    expect(formEventOf({ id, name: ' contact ' }).properties).toEqual({ form: 'contact' });
  });

  it('still counts a form with neither an id nor a name', () => {
    expect(formEventOf({ id: null, name: null })).toEqual({
      name: FORM_SUBMIT_EVENT,
      properties: {},
    });
  });
});
