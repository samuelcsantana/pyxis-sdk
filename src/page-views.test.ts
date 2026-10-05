import { describe, expect, it, vi } from 'vitest';
import { type PageLocation, startPageViews } from './page-views.js';
import type { EventInput, Tracker } from './tracker.js';

function setup(referrer = 'https://www.google.com/') {
  let location: PageLocation = {
    pathname: '/',
    search: '?utm_source=newsletter&fbclid=abc',
    hostname: 'shop.example.com',
  };
  const enqueued: EventInput[] = [];
  const tracker: Tracker = {
    enqueue: (input) => enqueued.push(input),
    flush: vi.fn(),
    dispose: vi.fn(),
  };
  let onNavigate: () => void = () => undefined;
  const stopWatching = vi.fn();
  const stop = startPageViews(tracker, ['/blog/:slug'], {
    location: () => location,
    referrer,
    watch: (listener) => {
      onNavigate = listener;
      return stopWatching;
    },
    guard: (action) => {
      action();
    },
  });
  const navigate = (next: Partial<PageLocation>): void => {
    location = { ...location, search: '', ...next };
    onNavigate();
  };
  return { enqueued, navigate, stop, stopWatching };
}

describe('startPageViews', () => {
  it('records the initial page view with the referrer and the campaign of the landing URL', () => {
    const { enqueued } = setup();

    expect(enqueued).toEqual([
      {
        name: 'page_view',
        path: '/',
        entryAttribution: {
          referrer_host: 'google.com',
          utm: { source: 'newsletter' },
          from_ad_click: true,
        },
      },
    ]);
  });

  it('records one page view per route, templated with the custom rules first', () => {
    const { enqueued, navigate } = setup();

    navigate({ pathname: '/orders/42' });
    navigate({ pathname: '/blog/2026' });

    expect(enqueued.map((input) => input.path)).toEqual(['/', '/orders/:id', '/blog/:slug']);
  });

  it('records nothing when a navigation keeps the same templated path', () => {
    const { enqueued, navigate } = setup();

    navigate({ pathname: '/' });
    navigate({ pathname: '/orders/1' });
    navigate({ pathname: '/orders/2' });

    expect(enqueued.map((input) => input.path)).toEqual(['/', '/orders/:id']);
  });

  it('never offers the original referrer again after the first page view', () => {
    const { enqueued, navigate } = setup();

    navigate({ pathname: '/pricing', search: '?utm_source=retargeting' });

    expect(enqueued[1]?.entryAttribution).toEqual({
      utm: { source: 'retargeting' },
      from_ad_click: false,
    });
  });

  it('stops watching the navigation when stopped', () => {
    const { stop, stopWatching } = setup();

    stop();

    expect(stopWatching).toHaveBeenCalledTimes(1);
  });
});
