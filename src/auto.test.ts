import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPT_OUT_KEY } from './core/privacy.js';

const OPTIONS = {
  key: 'pyxis_pk_test',
  endpoint: 'https://api.pyxis.example.com',
  autoPageViews: false,
};
const ALL_ON = { outboundLinks: true, fileDownloads: true, formSubmits: true };

type Modules = readonly [typeof import('./index.js'), typeof import('./auto.js')];

let stopAuto: (() => void) | undefined;
let loadedCore: typeof import('./index.js') | undefined;

async function loadFresh(): Promise<Modules> {
  vi.resetModules();
  const core = await import('./index.js');
  const auto = await import('./auto.js');
  loadedCore = core;
  return [core, auto];
}

function sentEvents(fetchSpy: { mock: { calls: unknown[][] } }): unknown[] {
  return fetchSpy.mock.calls.flatMap(([, init]) => {
    const body = (init as RequestInit).body;
    return typeof body === 'string' ? (JSON.parse(body) as { events: unknown[] }).events : [];
  });
}

function element(selector: string): Element {
  const found = document.querySelector(selector);
  if (found === null) {
    throw new Error(`no element matches ${selector}`);
  }
  return found;
}

function clickOn(selector: string): void {
  element(selector).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function submit(selector: string): void {
  element(selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function setNavigatorValue(name: string, value: unknown): void {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

const PAGE_HTML = `
  <a id="partner" href="https://www.partner.example.org/offer?ref=pyxis&email=ana%40example.com">Partner</a>
  <a id="internal" href="/pricing">Pricing</a>
  <a id="manual" href="/files/2026110512345/manual.pdf?signature=s3cr3t">Manual</a>
  <a id="mail" href="mailto:ana@example.com">Write to us</a>
  <form id="contact" name="contact-form"><input name="email" value="ana@example.com" /></form>
`;

const realDocument = document;

function stayOnThePage(event: Event): void {
  event.preventDefault();
}

describe('automatic events', () => {
  const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));

  function sendQueued(): unknown[] {
    window.dispatchEvent(new Event('pagehide'));
    return sentEvents(fetchSpy);
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    window.history.replaceState(null, '', '/orders/42');
    realDocument.body.innerHTML = PAGE_HTML;
    window.addEventListener('click', stayOnThePage);
    window.addEventListener('submit', stayOnThePage);
  });

  afterEach(() => {
    stopAuto?.();
    stopAuto = undefined;
    loadedCore?.optOut();
    loadedCore = undefined;
    realDocument.body.innerHTML = '';
    window.removeEventListener('click', stayOnThePage);
    window.removeEventListener('submit', stayOnThePage);
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    sessionStorage.clear();
    setNavigatorValue('globalPrivacyControl', undefined);
    fetchSpy.mockClear();
  });

  it('records outbound links, downloads and forms on the templated page, with nothing personal', async () => {
    const [pyxis, auto] = await loadFresh();
    pyxis.init(OPTIONS);
    stopAuto = auto.autoEvents(ALL_ON);

    clickOn('#partner');
    clickOn('#internal');
    clickOn('#manual');
    clickOn('#mail');
    submit('#contact');
    const events = sendQueued();

    expect(events).toEqual([
      expect.objectContaining({
        name: 'outbound_link_clicked',
        path: '/orders/:id',
        properties: { domain: 'partner.example.org' },
      }),
      expect.objectContaining({
        name: 'file_downloaded',
        path: '/orders/:id',
        properties: { extension: 'pdf', file_path: '/files/:id/manual.pdf' },
      }),
      expect.objectContaining({
        name: 'form_submitted',
        path: '/orders/:id',
        properties: { form: 'contact' },
      }),
    ]);
    const text = JSON.stringify(events);
    expect(text).not.toContain('ana');
    expect(text).not.toContain('s3cr3t');
    expect(text).not.toContain('ref=');
  });

  it('records only the kinds that were switched on', async () => {
    const [pyxis, auto] = await loadFresh();
    pyxis.init(OPTIONS);
    stopAuto = auto.autoEvents({ formSubmits: true });

    clickOn('#partner');
    clickOn('#manual');
    submit('#contact');

    expect(sendQueued()).toEqual([expect.objectContaining({ name: 'form_submitted' })]);
  });

  it('listens to nothing when every kind is off, as by default', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const [pyxis, auto] = await loadFresh();
    pyxis.init(OPTIONS);
    add.mockClear();

    stopAuto = auto.autoEvents({});

    expect(add).not.toHaveBeenCalled();
  });

  it('sends nothing without a key, before init or after opting out', async () => {
    const [pyxis, auto] = await loadFresh();
    stopAuto = auto.autoEvents(ALL_ON);

    clickOn('#partner');
    pyxis.init({ ...OPTIONS, key: undefined });
    submit('#contact');

    expect(sendQueued()).toEqual([]);

    const [optedOut, optedOutAuto] = await loadFresh();
    optedOut.init(OPTIONS);
    stopAuto = optedOutAuto.autoEvents(ALL_ON);
    optedOut.optOut();
    clickOn('#partner');

    expect(sendQueued()).toEqual([]);
    expect(localStorage.getItem(OPT_OUT_KEY)).toBe('1');
  });

  it('does not even listen when the browser asks not to be tracked', async () => {
    setNavigatorValue('globalPrivacyControl', true);
    const add = vi.spyOn(document, 'addEventListener');
    const [pyxis, auto] = await loadFresh();
    pyxis.init(OPTIONS);

    stopAuto = auto.autoEvents(ALL_ON);

    expect(add).not.toHaveBeenCalled();
  });

  it('stops recording once stopped', async () => {
    const [pyxis, auto] = await loadFresh();
    pyxis.init(OPTIONS);
    auto.autoEvents(ALL_ON)();

    clickOn('#partner');
    submit('#contact');

    expect(sendQueued()).toEqual([]);
  });

  it('replaces the running listeners when called again, so no event is counted twice', async () => {
    const [pyxis, auto] = await loadFresh();
    pyxis.init(OPTIONS);
    auto.autoEvents(ALL_ON);
    stopAuto = auto.autoEvents({ outboundLinks: true });

    clickOn('#partner');
    submit('#contact');

    expect(sendQueued()).toEqual([expect.objectContaining({ name: 'outbound_link_clicked' })]);
  });

  it('never throws into the page, and reports the error only in debug mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const brokenOptions = (debug: boolean) => ({
      debug,
      get outboundLinks(): boolean {
        throw new Error('broken options');
      },
    });

    const [, quiet] = await loadFresh();
    expect(() => quiet.autoEvents(brokenOptions(false))).not.toThrow();
    expect(warn).not.toHaveBeenCalled();

    const [, verbose] = await loadFresh();
    verbose.autoEvents(brokenOptions(true));
    expect(warn).toHaveBeenCalledWith(
      '[pyxis] automatic events ignored an internal error',
      expect.any(Error),
    );
  });

  it('keeps a failure inside a click away from the page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [pyxis, auto] = await loadFresh();
    pyxis.init(OPTIONS);
    stopAuto = auto.autoEvents({ ...ALL_ON, debug: true });
    vi.spyOn(document, 'baseURI', 'get').mockImplementation(() => {
      throw new Error('broken base');
    });
    const failures = vi.fn();
    window.addEventListener('error', failures);

    clickOn('#partner');

    window.removeEventListener('error', failures);
    expect(failures).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[pyxis] automatic events ignored an internal error',
      expect.any(Error),
    );
  });

  describe('outside a browser', () => {
    beforeEach(() => {
      vi.stubGlobal('document', undefined);
    });

    it('does nothing and throws nothing', async () => {
      const [, auto] = await loadFresh();

      expect(() => {
        auto.autoEvents(ALL_ON)();
      }).not.toThrow();
    });
  });
});
