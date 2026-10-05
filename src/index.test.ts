import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { OPT_OUT_KEY, OPT_OUT_VALUE } from './core/privacy.js';

const OPTIONS = { key: 'pk_live_test', endpoint: 'https://api.pyxis.example.com' };

type PublicApi = typeof import('./index.js');

async function loadFresh(): Promise<PublicApi> {
  vi.resetModules();
  return import('./index.js');
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

  it('flushes when the page hides, sending nothing while the queue is empty', async () => {
    setNavigatorValue(
      'sendBeacon',
      vi.fn(() => true),
    );
    const pyxis = await loadFresh();
    pyxis.init(OPTIONS);

    window.dispatchEvent(new Event('pagehide'));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps track, identify and reset as no-ops for now', async () => {
    const pyxis = await loadFresh();
    pyxis.init(OPTIONS);

    pyxis.track('calculator_result_shown', { calculator: 'ifood' });
    pyxis.identify('user_42');
    pyxis.reset();
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
      key: 'pk_live_test',
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
