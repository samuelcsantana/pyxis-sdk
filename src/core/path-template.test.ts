import { describe, expect, it } from 'vitest';
import { MAX_PATH_LENGTH, templatePath } from './path-template.js';

const PATH_TEMPLATE_CASES: readonly (readonly [string, string])[] = [
  ['/', '/'],
  ['/pricing', '/pricing'],
  ['/pricing/', '/pricing'],
  ['/pricing//', '/pricing'],
  ['//', '/'],
  ['/orders/42', '/orders/:id'],
  ['/orders/42/items/7', '/orders/:id/items/:id'],
  ['/orders/9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c', '/orders/:id'],
  ['/orders/12345678-1234-4234-8234-123456789012/edit', '/orders/:id/edit'],
  ['/clients/123.456.789-09', '/clients/:id'],
  ['/call/(11)98765-4321', '/call/:id'],
  ['/invoice-12345678901', '/:id'],
  ['/users/ana@example.com', '/users/:id'],
  ['/users/ana%40example.com', '/users/:id'],
  ['/users/ana%40Example.com/settings', '/users/:id/settings'],
  ['/blog/2026/black-friday', '/blog/:id/black-friday'],
  ['/v2/plans', '/v2/plans'],
  ['/orders/:id', '/orders/:id'],
];

describe('templatePath with the default rules', () => {
  it.each(PATH_TEMPLATE_CASES)('turns %j into %j, exactly like the API', (path, expected) => {
    expect(templatePath(path, [])).toBe(expected);
  });

  it('turns /vendas/9f1c… into /vendas/:id', () => {
    expect(templatePath('/vendas/9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c', [])).toBe('/vendas/:id');
  });

  it('turns /u/joao@x.com into /u/:id', () => {
    expect(templatePath('/u/joao@x.com', [])).toBe('/u/:id');
  });

  it('handles a path made of thousands of slashes in linear time', () => {
    const slashes = '/'.repeat(50_000);

    expect(templatePath(`${slashes}x${slashes}`, [])).toBe(`${slashes}x`.slice(0, MAX_PATH_LENGTH));
  });

  it(`cuts a path at ${String(MAX_PATH_LENGTH)} characters`, () => {
    expect(templatePath(`/${'a'.repeat(300)}`, [])).toHaveLength(MAX_PATH_LENGTH);
  });
});

describe('templatePath with custom rules', () => {
  const rules = ['/blog/:slug', '/vendas/:id/recibo/', '/teams/:team/members/:member'];

  it('applies the first rule with the same segments and wins over the defaults', () => {
    expect(templatePath('/blog/2026', rules)).toBe('/blog/:slug');
  });

  it('matches literal segments exactly and named segments with anything', () => {
    expect(templatePath('/teams/acme/members/ana', rules)).toBe('/teams/:team/members/:member');
  });

  it('ignores trailing slashes on both the path and the rule', () => {
    expect(templatePath('/vendas/42/recibo/', rules)).toBe('/vendas/:id/recibo');
  });

  it.each([
    ['a different segment count', '/blog/2026/10'],
    ['a different literal segment', '/news/hello'],
  ])('falls back to the defaults on %s', (_, path) => {
    expect(templatePath(path, rules)).toBe(templatePath(path, []));
  });
});
