export interface ActivatedLink {
  readonly href: string;
  readonly hasDownloadAttribute: boolean;
}

export interface SubmittedFormAttributes {
  readonly id: string | null;
  readonly name: string | null;
}

export interface DocumentEventHandlers {
  readonly onLink?: (link: ActivatedLink) => void;
  readonly onForm?: (form: SubmittedFormAttributes) => void;
}

export interface ListenableDocument {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean): void;
  removeEventListener(type: string, listener: (event: Event) => void, capture: boolean): void;
}

const LINK_SELECTOR = 'a[href], area[href]';
const MIDDLE_BUTTON = 1;
const CAPTURE = true;

export function activatedLinkOf(target: EventTarget | null): ActivatedLink | undefined {
  const link = target instanceof Element ? target.closest(LINK_SELECTOR) : null;
  return link === null
    ? undefined
    : {
        href: String(link.getAttribute('href')),
        hasDownloadAttribute: link.hasAttribute('download'),
      };
}

export function submittedFormOf(target: EventTarget | null): SubmittedFormAttributes | undefined {
  return target instanceof HTMLFormElement
    ? { id: target.getAttribute('id'), name: target.getAttribute('name') }
    : undefined;
}

function opensTheLink(event: Event): boolean {
  return event.type === 'click' || (event as MouseEvent).button === MIDDLE_BUTTON;
}

export function listenToDocument(
  doc: ListenableDocument,
  handlers: DocumentEventHandlers,
): () => void {
  const listeners: (readonly [string, (event: Event) => void])[] = [];
  const { onLink, onForm } = handlers;
  if (onLink !== undefined) {
    const onActivation = (event: Event): void => {
      const link = opensTheLink(event) ? activatedLinkOf(event.target) : undefined;
      if (link !== undefined) {
        onLink(link);
      }
    };
    listeners.push(['click', onActivation], ['auxclick', onActivation]);
  }
  if (onForm !== undefined) {
    listeners.push([
      'submit',
      (event: Event): void => {
        const form = submittedFormOf(event.target);
        if (form !== undefined) {
          onForm(form);
        }
      },
    ]);
  }
  for (const [type, listener] of listeners) {
    doc.addEventListener(type, listener, CAPTURE);
  }
  return () => {
    for (const [type, listener] of listeners) {
      doc.removeEventListener(type, listener, CAPTURE);
    }
  };
}
