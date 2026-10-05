import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { OPT_OUT_KEY, OPT_OUT_VALUE } from './core/privacy.js';

const OPTIONS = { key: 'pyxis_pk_test', endpoint: 'https://api.pyxis.example.com' };

type PublicApi = typeof import('./index.js');

let loaded: PublicApi | undefined;

async function loadFresh(): Promise<PublicApi> {
  vi.resetModules();
  loaded = await import('./index.js');
  return loaded;
}

function sentEvents(fetchSpy: { mock: { calls: unknown[][] } }): unknown[] {
  return fetchSpy.mock.calls.flatMap(([, init]) => {
    const body = (init as RequestInit).body;
    return typeof body === 'string' ? (JSON.parse(body) as { events: unknown[] }).events : [];
  });
}

function setNavigatorValue(name: string, value: unknown): void {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

describe('the public API', () => {
  let addListener: MockInstance<Document['addEventListener']>;
  let removeListener: MockInstance<Document['removeEventListener']>;
  const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    addListener = vi.spyOn(document, 'addEventListener');
    removeListener = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    loaded?.optOut();
    loaded = undefined;
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    sessionStorage.clear();
    setNavigatorValue('globalPrivacyControl', undefined);
    setNavigatorValue('doNotTrack', null);
    setNavigatorValue('sendBeacon', undefined);
    fetchSpy.mockClear();
  });

  function listensForPageHide(): boolean {
    return addListener.mock.calls.some(([type]) => type === 'visibilitychange');
  }

  it('starts the tracker when a key and an endpoint are given', async () => {
    const pyxis = await loadFresh();

    pyxis.init(OPTIONS);

    expect(listensForPageHide()).toBe(true);
  });

  it('stays inert without a key', async () => {
    const pyxis = await loadFresh();

    pyxis.init({ ...OPTIONS, key: undefined });

    expect(listensForPageHide()).toBe(false);
  });

  it('stays inert with an endpoint that is not an http URL', async () => {
    const pyxis = await loadFresh();

    pyxis.init({ ...OPTIONS, endpoint: 'not a url' });

    expect(listensForPageHide()).toBe(false);
  });

  it('ignores a second init', async () => {
    const pyxis = await loadFresh();

    pyxis.init(OPTIONS);
    pyxis.init(OPTIONS);

    expect(addListener.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);
  });

  it.each([
    [
      'Global Privacy Control',
      () => {
        setNavigatorValue('globalPrivacyControl', true);
      },
    ],
    [
      'Do Not Track',
      () => {
        setNavigatorValue('doNotTrack', '1');
      },
    ],
    [
      'an earlier opt-out',
      () => {
        localStorage.setItem(OPT_OUT_KEY, OPT_OUT_VALUE);
      },
    ],
  ])('stays inert under %s', async (_label, arrange) => {
    arrange();
    const pyxis = await loadFresh();

    pyxis.init(OPTIONS);

    expect(listensForPageHide()).toBe(false);
  });

  it('records the initial page view and sends it when the page hides', async () => {
    const pyxis = await loadFresh();
    pyxis.init(OPTIONS);

    window.dispatchEvent(new Event('pagehide'));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sentEvents(fetchSpy)).toEqual([
      expect.objectContaining({
        name: 'page_view',
        path: '/',
        attribution: { from_ad_click: false },
      }),
    ]);
  });

  it('records a page view per route change, templated', async () => {
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, pathRules: ['/blog/:slug'] });

    window.history.pushState(null, '', '/orders/42');
    window.history.replaceState(null, '', '/orders/43');
    window.history.pushState(null, '', '/blog/hello');
    window.dispatchEvent(new Event('pagehide'));

    expect(sentEvents(fetchSpy)).toEqual([
      expect.objectContaining({ path: '/' }),
      expect.objectContaining({ path: '/orders/:id' }),
      expect.objectContaining({ path: '/blog/:slug' }),
    ]);
  });

  it('records no page view on its own when autoPageViews is false', async () => {
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false });

    window.history.pushState(null, '', '/pricing');
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('tracks a named event on the current templated path with its valid properties', async () => {
    window.history.replaceState(null, '', '/orders/42');
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false });

    pyxis.track('calculator_result_shown', { calculator: 'ifood', used_plan_preset: true });
    pyxis.track('cta_clicked');
    window.dispatchEvent(new Event('pagehide'));

    expect(sentEvents(fetchSpy)).toEqual([
      expect.objectContaining({
        name: 'calculator_result_shown',
        path: '/orders/:id',
        properties: { calculator: 'ifood', used_plan_preset: true },
      }),
      expect.not.objectContaining({ properties: expect.anything() as unknown }),
    ]);
  });

  it('drops invalid properties one by one and warns only in debug mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false, debug: {} });

    pyxis.track('plan_selected', { plan: 'pro', 'Bad Key': 1 });
    pyxis.track('plan_viewed', { 'Bad Key': 1 });
    window.dispatchEvent(new Event('pagehide'));

    expect(sentEvents(fetchSpy)).toEqual([
      expect.objectContaining({ name: 'plan_selected', properties: { plan: 'pro' } }),
      expect.not.objectContaining({ properties: expect.anything() as unknown }),
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped the property "Bad Key"'));
  });

  it.each(['page_view', 'Not Valid'])('refuses to track %j', async (name) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const quiet = await loadFresh();
    quiet.init({ ...OPTIONS, autoPageViews: false });

    quiet.track(name);
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('explains a refused event name in debug mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false, debug: {} });

    pyxis.track('page_view');
    pyxis.track('Not Valid');

    expect(warn.mock.calls).toEqual([
      ['[pyxis] track() ignored "page_view": the name is reserved for the SDK'],
      ['[pyxis] track() ignored "Not Valid": the name is not a valid event name'],
    ]);
  });

  it('identifies the visit once and refuses an id that could be personal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false, debug: {} });

    pyxis.identify('ana@example.com');
    pyxis.identify('user_42');
    pyxis.identify('user_42');
    pyxis.track('plan_selected');
    window.dispatchEvent(new Event('pagehide'));

    expect(sentEvents(fetchSpy)).toEqual([
      expect.objectContaining({ name: 'identify', user_id: 'user_42' }),
      expect.objectContaining({ name: 'plan_selected', user_id: 'user_42' }),
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('never pass an email'));
  });

  it('starts an anonymous visit after reset', async () => {
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false });

    pyxis.identify('user_42');
    pyxis.reset();
    pyxis.track('page_seen');
    window.dispatchEvent(new Event('pagehide'));

    const events = sentEvents(fetchSpy) as { name: string; user_id?: string }[];
    expect(events.map(({ name, user_id }) => [name, user_id])).toEqual([
      ['identify', 'user_42'],
      ['page_seen', undefined],
    ]);
  });

  it('tracks an HTTP request as an api_request with a templated route', async () => {
    window.history.replaceState(null, '', '/orders/7');
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false });

    pyxis.trackRequest({
      method: 'POST',
      url: 'https://api.example.com/orders/42/items?coupon=X',
      status: 422,
      durationMs: 87,
      errorCode: 'order.invalid_total',
    });
    window.dispatchEvent(new Event('pagehide'));

    expect(sentEvents(fetchSpy)).toEqual([
      expect.objectContaining({
        name: 'api_request',
        path: '/orders/:id',
        properties: {
          method: 'POST',
          route: '/orders/:id/items',
          status: 422,
          duration_ms: 87,
          error_code: 'order.invalid_total',
        },
      }),
    ]);
  });

  it('ignores an invalid request and drops an invalid error code, explaining both in debug mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pyxis = await loadFresh();
    pyxis.init({ ...OPTIONS, autoPageViews: false, debug: {} });

    pyxis.trackRequest({ method: 'GET', url: '/orders', status: 200, durationMs: 12.5 });
    pyxis.trackRequest({
      method: 'GET',
      url: '/orders',
      status: 200,
      durationMs: 12,
      errorCode: 'Bad Code',
    });
    window.dispatchEvent(new Event('pagehide'));

    expect(sentEvents(fetchSpy)).toEqual([
      expect.objectContaining({
        name: 'api_request',
        properties: { method: 'GET', route: '/orders', status: 200, duration_ms: 12 },
      }),
    ]);
    expect(warn.mock.calls).toEqual([
      ['[pyxis] trackRequest() ignored a request with an invalid duration'],
      ['[pyxis] trackRequest() dropped an errorCode outside [a-z0-9_.]{1,64}'],
    ]);
  });

  it('keeps track, identify and reset silent before init and without a key', async () => {
    const pyxis = await loadFresh();

    pyxis.track('cta_clicked');
    pyxis.identify('user_42');
    pyxis.reset();
    pyxis.trackRequest({ method: 'GET', url: '/', status: 200, durationMs: 1 });
    pyxis.init({ ...OPTIONS, key: undefined });
    pyxis.trackRequest({ method: 'GET', url: '/', status: 200, durationMs: 1 });
    pyxis.track('cta_clicked');
    pyxis.identify('user_42');
    pyxis.reset();
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stops recording page views after opting out', async () => {
    const pyxis = await loadFresh();
    pyxis.init(OPTIONS);

    pyxis.optOut();
    window.history.pushState(null, '', '/pricing');
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opts out: remembers the choice and stops the running tracker', async () => {
    const pyxis = await loadFresh();
    pyxis.init(OPTIONS);

    pyxis.optOut();

    expect(localStorage.getItem(OPT_OUT_KEY)).toBe(OPT_OUT_VALUE);
    expect(removeListener.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(true);
  });

  it('opts out before init too', async () => {
    const pyxis = await loadFresh();

    pyxis.optOut();
    pyxis.init(OPTIONS);

    expect(listensForPageHide()).toBe(false);
  });

  it('opts back in by removing the marker', async () => {
    localStorage.setItem(OPT_OUT_KEY, OPT_OUT_VALUE);
    const pyxis = await loadFresh();

    pyxis.optIn();

    expect(localStorage.getItem(OPT_OUT_KEY)).toBeNull();
  });

  it('never throws into the page, and reports the error only in debug mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const brokenOptions = (debug?: object) => ({
      key: 'pyxis_pk_test',
      debug,
      get endpoint(): string {
        throw new Error('broken options');
      },
    });

    const quiet = await loadFresh();
    expect(() => {
      quiet.init(brokenOptions());
    }).not.toThrow();
    expect(warn).not.toHaveBeenCalled();

    const verbose = await loadFresh();
    verbose.init(brokenOptions({}));
    expect(warn).toHaveBeenCalledWith('[pyxis] ignored an internal error', expect.any(Error));
  });

  describe('outside a browser', () => {
    beforeEach(() => {
      vi.stubGlobal('document', undefined);
    });

    it('does nothing and throws nothing', async () => {
      const pyxis = await loadFresh();

      expect(() => {
        pyxis.init(OPTIONS);
        pyxis.optOut();
        pyxis.optIn();
      }).not.toThrow();
      expect(localStorage.getItem(OPT_OUT_KEY)).toBeNull();
    });
  });
});
