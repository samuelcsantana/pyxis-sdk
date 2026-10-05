import { afterEach, describe, expect, it, vi } from 'vitest';
import { onPageHide } from './page-lifecycle.js';

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('onPageHide', () => {
  afterEach(() => {
    setVisibility('visible');
  });

  it('calls back when the page becomes hidden', () => {
    const listener = vi.fn();
    const dispose = onPageHide(listener);

    setVisibility('hidden');

    expect(listener).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('ignores the page becoming visible again', () => {
    const listener = vi.fn();
    const dispose = onPageHide(listener);

    setVisibility('visible');

    expect(listener).not.toHaveBeenCalled();
    dispose();
  });

  it('calls back on pagehide, the last event a closing page reliably gets', () => {
    const listener = vi.fn();
    const dispose = onPageHide(listener);

    window.dispatchEvent(new Event('pagehide'));

    expect(listener).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('stops listening once disposed', () => {
    const listener = vi.fn();
    onPageHide(listener)();

    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));

    expect(listener).not.toHaveBeenCalled();
  });
});
