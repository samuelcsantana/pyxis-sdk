import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activatedLinkOf, listenToDocument, submittedFormOf } from './dom-events.js';

function stayOnThePage(event: Event): void {
  event.preventDefault();
}

beforeEach(() => {
  window.addEventListener('click', stayOnThePage);
});

afterEach(() => {
  window.removeEventListener('click', stayOnThePage);
  document.body.innerHTML = '';
});

function mount(html: string): void {
  document.body.innerHTML = html;
}

function element(selector: string): Element {
  const found = document.querySelector(selector);
  if (found === null) {
    throw new Error(`no element matches ${selector}`);
  }
  return found;
}

function clickOn(selector: string, init: MouseEventInit = {}): void {
  element(selector).dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, ...init }),
  );
}

function auxClickOn(selector: string, button: number): void {
  element(selector).dispatchEvent(
    new MouseEvent('auxclick', { bubbles: true, cancelable: true, button }),
  );
}

function submit(selector: string): void {
  element(selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('activatedLinkOf', () => {
  it('finds the link around the clicked element and reads its raw href', () => {
    mount('<a href="/guide.pdf?x=1" download><span id="label">Guide</span></a>');

    expect(activatedLinkOf(element('#label'))).toEqual({
      href: '/guide.pdf?x=1',
      hasDownloadAttribute: true,
    });
  });

  it('reads an image map area as a link', () => {
    mount('<map name="m"><area id="area" href="https://partner.example.org/" /></map>');

    expect(activatedLinkOf(element('#area'))).toEqual({
      href: 'https://partner.example.org/',
      hasDownloadAttribute: false,
    });
  });

  it.each([
    ['an element outside any link', '<button id="target">Buy</button>'],
    ['an anchor without href', '<a id="target">Placeholder</a>'],
  ])('finds nothing for %s', (_, html) => {
    mount(html);

    expect(activatedLinkOf(element('#target'))).toBeUndefined();
  });

  it('finds nothing for a target that is not an element', () => {
    expect(activatedLinkOf(document)).toBeUndefined();
    expect(activatedLinkOf(null)).toBeUndefined();
  });
});

describe('submittedFormOf', () => {
  it('reads the id and name attributes, not the fields that shadow them', () => {
    mount(
      '<form id="signup" name="newsletter"><input name="id" value="ana@example.com" /><input name="name" value="Ana" /></form>',
    );

    expect(submittedFormOf(element('form'))).toEqual({ id: 'signup', name: 'newsletter' });
  });

  it('answers null for attributes the form does not have', () => {
    mount('<form></form>');

    expect(submittedFormOf(element('form'))).toEqual({ id: null, name: null });
  });

  it('finds nothing for a target that is not a form', () => {
    mount('<div id="box"></div>');

    expect(submittedFormOf(element('#box'))).toBeUndefined();
  });
});

describe('listenToDocument', () => {
  it('reports a link clicked with the main button or opened with the middle one', () => {
    mount('<a id="out" href="https://partner.example.org/">Partner</a>');
    const onLink = vi.fn();
    const stop = listenToDocument(document, { onLink });

    clickOn('#out');
    auxClickOn('#out', 1);

    expect(onLink).toHaveBeenCalledTimes(2);
    expect(onLink).toHaveBeenCalledWith({
      href: 'https://partner.example.org/',
      hasDownloadAttribute: false,
    });
    stop();
  });

  it('ignores the right button, which opens a menu and not the link', () => {
    mount('<a id="out" href="https://partner.example.org/">Partner</a>');
    const onLink = vi.fn();
    const stop = listenToDocument(document, { onLink });

    auxClickOn('#out', 2);

    expect(onLink).not.toHaveBeenCalled();
    stop();
  });

  it('ignores a click outside any link', () => {
    mount('<button id="buy">Buy</button>');
    const onLink = vi.fn();
    const stop = listenToDocument(document, { onLink });

    clickOn('#buy');

    expect(onLink).not.toHaveBeenCalled();
    stop();
  });

  it('sees a click even when the page stops it from bubbling or cancels it', () => {
    mount('<a id="out" href="https://partner.example.org/">Partner</a>');
    element('#out').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    const onLink = vi.fn();
    const stop = listenToDocument(document, { onLink });

    clickOn('#out');

    expect(onLink).toHaveBeenCalledTimes(1);
    stop();
  });

  it('reports a submitted form and ignores a submit event from anything else', () => {
    mount('<form id="contact"></form><div id="box"></div>');
    const onForm = vi.fn();
    const stop = listenToDocument(document, { onForm });

    submit('#contact');
    submit('#box');

    expect(onForm).toHaveBeenCalledTimes(1);
    expect(onForm).toHaveBeenCalledWith({ id: 'contact', name: null });
    stop();
  });

  it('listens only for what it was given a handler for', () => {
    const add = vi.spyOn(document, 'addEventListener');

    const stopForms = listenToDocument(document, { onForm: vi.fn() });
    expect(add.mock.calls.map(([type]) => type)).toEqual(['submit']);

    add.mockClear();
    const stopLinks = listenToDocument(document, { onLink: vi.fn() });
    expect(add.mock.calls.map(([type]) => type)).toEqual(['click', 'auxclick']);

    stopForms();
    stopLinks();
  });

  it('stops listening once stopped', () => {
    mount('<a id="out" href="https://partner.example.org/">Partner</a><form id="contact"></form>');
    const onLink = vi.fn();
    const onForm = vi.fn();
    listenToDocument(document, { onLink, onForm })();

    clickOn('#out');
    submit('#contact');

    expect(onLink).not.toHaveBeenCalled();
    expect(onForm).not.toHaveBeenCalled();
  });
});
