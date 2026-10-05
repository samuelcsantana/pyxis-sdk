import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserDependencies } from './browser-dependencies.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createBrowserDependencies', () => {
  afterEach(() => {
    sessionStorage.clear();
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
  });

  it('reads the clock, creates UUIDs and draws random numbers from the platform', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 6));
    const deps = createBrowserDependencies();

    expect(deps.now()).toBe(Date.UTC(2026, 9, 6));
    expect(deps.createId()).toMatch(UUID_V4);
    expect(deps.random()).toBeGreaterThanOrEqual(0);
    vi.useRealTimers();
  });

  it('keeps the visit in sessionStorage', () => {
    createBrowserDependencies().sessionStore.write('pyxis:session', 'visit');

    expect(sessionStorage.getItem('pyxis:session')).toBe('visit');
  });

  it('sends through fetch when the browser has it', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal('fetch', fetchSpy);

    const outcome = await createBrowserDependencies().transport.send(
      'https://x/v1/batch',
      '{}',
      false,
    );

    expect(outcome).toEqual({ kind: 'response', status: 202 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to sendBeacon when fetch does not exist', async () => {
    vi.stubGlobal('fetch', undefined);
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });

    const outcome = await createBrowserDependencies().transport.send(
      'https://x/v1/batch',
      '{}',
      true,
    );

    expect(outcome).toEqual({ kind: 'handed-off' });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
