import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const SIZE_BUDGET_BYTES = 6 * 1024;
export const AUTO_EVENTS_BUDGET_BYTES = 2 * 1024;

export interface Bundle {
  readonly file: string;
  readonly budget: number;
}

export const BUNDLES: readonly Bundle[] = [
  { file: 'dist/index.js', budget: SIZE_BUDGET_BYTES },
  { file: 'dist/pyxis.global.js', budget: SIZE_BUDGET_BYTES },
  { file: 'dist/auto.js', budget: AUTO_EVENTS_BUDGET_BYTES },
];

export interface SizeReport {
  readonly withinBudget: boolean;
  readonly message: string;
}

export function gzippedSize(content: Uint8Array): number {
  return gzipSync(content, { level: 9 }).length;
}

export function reportSize(file: string, size: number, budget: number): SizeReport {
  const withinBudget = size <= budget;
  const verdict = withinBudget ? 'within budget' : 'OVER BUDGET';
  return {
    withinBudget,
    message: `${file}: ${String(size)} bytes gzipped, budget ${String(budget)} bytes, ${verdict}`,
  };
}

export function reportBundles(
  bundles: readonly Bundle[],
  read: (file: string) => Uint8Array,
): readonly SizeReport[] {
  return bundles.map(({ file, budget }) => reportSize(file, gzippedSize(read(file)), budget));
}

export function allWithinBudget(reports: readonly SizeReport[]): boolean {
  return reports.every((report) => report.withinBudget);
}

function main(): void {
  const reports = reportBundles(BUNDLES, (file) => readFileSync(file));
  for (const report of reports) {
    console.log(report.message);
  }
  if (!allWithinBudget(reports)) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
