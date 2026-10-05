import { describe, expect, it } from 'vitest';
import { AD_CLICK_PARAMETERS, buildAttribution, MAX_UTM_VALUE_LENGTH } from './attribution.js';

const OWN_HOST = 'shop.example.com';

function attribution(search: string, referrer?: string) {
  return buildAttribution({ search, referrer, ownHost: OWN_HOST });
}

describe('buildAttribution', () => {
  it('keeps the utm tags, turns click ids into a flag and drops everything else', () => {
    expect(attribution('?utm_source=g&gclid=abc&email=x')).toEqual({
      utm: { source: 'g' },
      from_ad_click: true,
    });
  });

  it('reads all three utm tags', () => {
    expect(
      attribution('?utm_source=newsletter&utm_medium=email&utm_campaign=black-friday').utm,
    ).toEqual({ source: 'newsletter', medium: 'email', campaign: 'black-friday' });
  });

  it('ignores empty utm values and trims the rest', () => {
    expect(attribution('?utm_source=&utm_medium=%20cpc%20').utm).toEqual({ medium: 'cpc' });
  });

  it(`cuts a utm value at ${String(MAX_UTM_VALUE_LENGTH)} characters`, () => {
    expect(attribution(`?utm_campaign=${'c'.repeat(80)}`).utm?.campaign).toHaveLength(
      MAX_UTM_VALUE_LENGTH,
    );
  });

  it.each(AD_CLICK_PARAMETERS)(
    'flags an ad click for %s without keeping its value',
    (parameter) => {
      expect(attribution(`?${parameter}=Cj0KCQ`)).toEqual({ from_ad_click: true });
    },
  );

  it('reports no ad click and no utm on a plain URL', () => {
    expect(attribution('')).toEqual({ from_ad_click: false });
  });

  it('keeps the referrer host, lower-cased and without www.', () => {
    expect(attribution('', 'https://WWW.Google.com.br/search?q=private')).toEqual({
      referrer_host: 'google.com.br',
      from_ad_click: false,
    });
  });

  it.each([
    ['the same host', 'https://shop.example.com/pricing'],
    ['the same host with www.', 'https://www.shop.example.com/'],
    ['an empty referrer', ''],
    ['no referrer', undefined],
    ['a referrer that is not a URL', 'not a url'],
    ['an IPv6 address', 'http://[::1]:8080/'],
    ['a host longer than 128 characters', `https://${'a'.repeat(125)}.com/`],
  ])('omits the referrer for %s', (_, referrer) => {
    expect(attribution('', referrer)).toEqual({ from_ad_click: false });
  });
});
