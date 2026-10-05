import { beforeEach, describe, expect, it, vi } from 'vitest';
import { identify, init, optIn, optOut, reset, track } from './index.js';

describe('the public surface before the tracker exists', () => {
  const fetchSpy = vi.fn();
  const sendBeaconSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeaconSpy, configurable: true });
  });

  function callEverything(): unknown[] {
    return [
      init({ key: 'pk_live_00000000000000000000000000000000', endpoint: 'https://api.example.com' }),
      track('calculator_result_shown', { calculator: 'ifood', used_plan_preset: true }),
      identify('user_42'),
      reset(),
      optOut(),
      optIn(),
    ];
  }

  it('returns nothing from any function', () => {
    expect(callEverything()).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  it('sends nothing over the network', () => {
    callEverything();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendBeaconSpy).not.toHaveBeenCalled();
  });

  it('touches no storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    callEverything();

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('leaves the History API alone', () => {
    const pushState = history.pushState;
    const replaceState = history.replaceState;

    callEverything();

    expect(history.pushState).toBe(pushState);
    expect(history.replaceState).toBe(replaceState);
  });
});
