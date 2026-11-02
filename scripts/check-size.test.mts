import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allWithinBudget,
  BUNDLE_FILES,
  gzippedSize,
  reportBundles,
  reportSize,
  SIZE_BUDGET_BYTES,
} from './check-size.mts';

const SMALL_BUNDLE = new TextEncoder().encode('export const a = 1;');
const LARGE_BUNDLE = Uint8Array.from({ length: 512 }, (_, index) => (index * 7919) % 251);

function readFrom(contents: Readonly<Record<string, Uint8Array>>) {
  return (file: string): Uint8Array => {
    const content = contents[file];
    if (content === undefined) {
      throw new Error(`no such file: ${file}`);
    }
    return content;
  };
}

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

  it('sets the budget at 6 KB', () => {
    assert.equal(SIZE_BUDGET_BYTES, 6144);
  });
});

describe('reportBundles', () => {
  it('checks the module build and the classic script build', () => {
    assert.deepEqual(BUNDLE_FILES, ['dist/index.js', 'dist/pyxis.global.js']);
  });

  it('reports every file, in order, each measured from its own content', () => {
    const budget = gzippedSize(SMALL_BUNDLE);
    const read = readFrom({ 'small.js': SMALL_BUNDLE, 'large.js': LARGE_BUNDLE });

    const reports = reportBundles(['small.js', 'large.js'], read, budget);

    assert.deepEqual(reports, [
      reportSize('small.js', budget, budget),
      reportSize('large.js', gzippedSize(LARGE_BUNDLE), budget),
    ]);
    assert.deepEqual(
      reports.map((report) => report.withinBudget),
      [true, false],
    );
  });
});

describe('allWithinBudget', () => {
  const within = reportSize('a.js', 10, 10);
  const over = reportSize('b.js', 11, 10);

  it('passes when every file is within the budget', () => {
    assert.equal(allWithinBudget([within, within]), true);
  });

  it('fails when one file is over the budget, even if the other is within', () => {
    assert.equal(allWithinBudget([within, over]), false);
    assert.equal(allWithinBudget([over, within]), false);
  });

  it('fails when every file is over the budget', () => {
    assert.equal(allWithinBudget([over, over]), false);
  });
});
