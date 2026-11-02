import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const BUNDLE_FILES = ['dist/index.js', 'dist/pyxis.global.js'] as const;
export const SIZE_BUDGET_BYTES = 5 * 1024;

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
  files: readonly string[],
  read: (file: string) => Uint8Array,
  budget: number,
): readonly SizeReport[] {
  return files.map((file) => reportSize(file, gzippedSize(read(file)), budget));
}

export function allWithinBudget(reports: readonly SizeReport[]): boolean {
  return reports.every((report) => report.withinBudget);
}

function main(): void {
  const reports = reportBundles(BUNDLE_FILES, (file) => readFileSync(file), SIZE_BUDGET_BYTES);
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
