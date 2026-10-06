import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

const SOURCE = 'playground';
const OUTPUT = 'site';
const STATIC_FILES = ['index.html', 'playground.css'] as const;

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });
await build({
  entryPoints: [`${SOURCE}/playground.ts`],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: `${OUTPUT}/playground.js`,
});
for (const file of STATIC_FILES) {
  copyFileSync(`${SOURCE}/${file}`, `${OUTPUT}/${file}`);
}
