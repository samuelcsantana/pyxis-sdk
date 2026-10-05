export interface GlobalScope {
  readonly window?: unknown;
  readonly document?: unknown;
}

export function isBrowserLike(scope: GlobalScope): boolean {
  return scope.window !== undefined && scope.document !== undefined;
}
