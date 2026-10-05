import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const BUNDLE_FILE = 'dist/index.js';
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

function main(): void {
  const report = reportSize(BUNDLE_FILE, gzippedSize(readFileSync(BUNDLE_FILE)), SIZE_BUDGET_BYTES);
  console.log(report.message);
  if (!report.withinBudget) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
