import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = 'site';
const PORT = Number(process.env.PLAYGROUND_PORT ?? '4173');
const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

export function contentTypeOf(path: string): string {
  return CONTENT_TYPES[extname(path)] ?? 'application/octet-stream';
}

export function fileFor(url: string): string {
  const path = new URL(url, 'http://localhost').pathname;
  const relative = normalize(path === '/' ? '/index.html' : path).replace(/^([/\\])+/, '');
  return join(ROOT, relative.startsWith('..') ? 'index.html' : relative);
}

createServer((request, response) => {
  const file = fileFor(request.url ?? '/');
  readFile(file).then(
    (body) => {
      response.writeHead(STATUS_OK, { 'content-type': contentTypeOf(file) });
      response.end(body);
    },
    () => {
      response.writeHead(STATUS_NOT_FOUND);
      response.end();
    },
  );
}).listen(PORT);
