import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchNavigation } from './navigation.js';

describe('watchNavigation', () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
    window.history.replaceState(null, '', '/');
  });

  it('reports pushState after the URL has changed', () => {
    const seen: string[] = [];
    stop = watchNavigation(() => seen.push(window.location.pathname), window);

    window.history.pushState({ step: 1 }, '', '/pricing');

    expect(seen).toEqual(['/pricing']);
    expect(window.history.state).toEqual({ step: 1 });
  });

  it('reports replaceState after the URL has changed', () => {
    const seen: string[] = [];
    stop = watchNavigation(() => seen.push(window.location.pathname), window);

    window.history.replaceState(null, '', '/checkout');

    expect(seen).toEqual(['/checkout']);
  });

  it('reports popstate', () => {
    const onNavigate = vi.fn();
    stop = watchNavigation(onNavigate, window);

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('stops reporting and keeps the History API working once disposed', () => {
    const onNavigate = vi.fn();
    watchNavigation(onNavigate, window)();

    window.history.pushState(null, '', '/after');
    window.history.replaceState(null, '', '/after-again');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/after-again');
  });
});
