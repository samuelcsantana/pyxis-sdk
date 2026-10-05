import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gzippedSize, reportSize, SIZE_BUDGET_BYTES } from './check-size.mts';

describe('gzippedSize', () => {
  it('measures the gzipped bytes, smaller than the raw size for repetitive code', () => {
    const raw = new TextEncoder().encode('export const a = 1;'.repeat(200));

    const size = gzippedSize(raw);

    assert.ok(size > 0);
    assert.ok(size < raw.length);
  });
});

describe('reportSize', () => {
  it('accepts a bundle exactly at the budget', () => {
    assert.deepEqual(reportSize('dist/index.js', 3072, 3072), {
      withinBudget: true,
      message: 'dist/index.js: 3072 bytes gzipped, budget 3072 bytes, within budget',
    });
  });

  it('rejects a bundle one byte over the budget', () => {
    const report = reportSize('dist/index.js', 3073, 3072);

    assert.equal(report.withinBudget, false);
    assert.match(report.message, /OVER BUDGET$/);
  });

  it('sets the budget at 3 KB', () => {
    assert.equal(SIZE_BUDGET_BYTES, 3072);
  });
});
