import { OPT_OUT_KEY, OPT_OUT_VALUE } from '../src/core/privacy.js';
import {
  type Batch,
  identify,
  init,
  optIn,
  optOut,
  reset,
  track,
  trackRequest,
} from '../src/index.js';

const PLAYGROUND_KEY = `pyxis_pk_${'P'.repeat(32)}`;
const PLAYGROUND_ENDPOINT = 'https://api.pyxis.example.com';
const GPC_PARAMETER = 'gpc';
const GPC_ON = '1';
const JSON_INDENT = 2;

function required<Found extends HTMLElement>(id: string, kind: new () => Found): Found {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) {
    throw new Error(`The playground page has no #${id}.`);
  }
  return found;
}

const batchList = required('batches', HTMLOListElement);
const status = required('status', HTMLParagraphElement);
const optOutBox = required('opt-out', HTMLInputElement);
const gpcToggle = required('gpc-toggle', HTMLAnchorElement);

let shown = 0;

function showBatch(batch: Batch): void {
  shown += 1;
  const item = document.createElement('li');
  const heading = document.createElement('h3');
  heading.textContent = `Batch ${String(shown)}: ${String(batch.events.length)} events`;
  const body = document.createElement('pre');
  body.textContent = JSON.stringify(batch, null, JSON_INDENT);
  item.append(heading, body);
  batchList.prepend(item);
  status.textContent = `${String(shown)} ${shown === 1 ? 'batch' : 'batches'} shown, newest first.`;
}

function simulateGlobalPrivacyControl(): boolean {
  const on = new URLSearchParams(location.search).get(GPC_PARAMETER) === GPC_ON;
  if (on) {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    gpcToggle.href = '?';
    gpcToggle.textContent = 'Reload with Global Privacy Control off';
    status.textContent = 'Global Privacy Control is on: the tracker queues and sends nothing.';
  }
  return on;
}

const ACTIONS: Readonly<Record<string, () => void>> = {
  track: () => {
    track('cta_clicked', { cta: 'start_trial', location: 'pricing' });
  },
  identify: () => {
    identify('u_demo_42');
  },
  reset: () => {
    reset();
  },
  'request-ok': () => {
    trackRequest({ method: 'POST', url: '/v1/orders', status: 201, durationMs: 142 });
  },
  'request-failed': () => {
    trackRequest({
      method: 'POST',
      url: '/v1/orders',
      status: 409,
      durationMs: 97,
      errorCode: 'order_number_in_use',
    });
  },
};

simulateGlobalPrivacyControl();
optOutBox.checked = localStorage.getItem(OPT_OUT_KEY) === OPT_OUT_VALUE;
init({
  key: PLAYGROUND_KEY,
  endpoint: PLAYGROUND_ENDPOINT,
  pathRules: ['/orders/:id'],
  debug: { dryRun: true, onBatch: showBatch },
});

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-path]')) {
  button.addEventListener('click', () => {
    history.pushState({}, '', button.dataset.path);
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
  button.addEventListener('click', () => {
    ACTIONS[button.dataset.action ?? '']?.();
  });
}

optOutBox.addEventListener('change', () => {
  if (optOutBox.checked) {
    optOut();
  } else {
    optIn();
  }
});
