import type { PropertyValue } from './batch.js';
import { templatePath } from './path-template.js';

export const API_REQUEST_EVENT = 'api_request';
export const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export const MAX_ROUTE_LENGTH = 100;
export const MAX_REQUEST_DURATION_MS = 600_000;
export const MAX_HTTP_STATUS = 599;

const ERROR_CODE_PATTERN = /^[a-z0-9_.]{1,64}$/;
const URL_BASE = 'http://relative.invalid';

export type RequestMethod = (typeof REQUEST_METHODS)[number];

export interface TrackedRequest {
  readonly method: RequestMethod;
  readonly url: string;
  readonly status: number;
  readonly durationMs: number;
  readonly errorCode?: string;
}

export type RequestCheck =
  | {
      readonly ok: true;
      readonly properties: Readonly<Record<string, PropertyValue>>;
      readonly droppedErrorCode: boolean;
    }
  | { readonly ok: false; readonly reason: 'method' | 'url' | 'status' | 'duration' };

function isMethod(value: unknown): value is RequestMethod {
  return typeof value === 'string' && (REQUEST_METHODS as readonly string[]).includes(value);
}

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function routeOf(url: unknown, rules: readonly string[]): string | undefined {
  if (typeof url !== 'string') {
    return undefined;
  }
  try {
    return templatePath(new URL(url, URL_BASE).pathname, rules).slice(0, MAX_ROUTE_LENGTH);
  } catch {
    return undefined;
  }
}

export function checkTrackedRequest(
  request: TrackedRequest,
  rules: readonly string[],
): RequestCheck {
  if (!isMethod(request.method)) {
    return { ok: false, reason: 'method' };
  }
  const route = routeOf(request.url, rules);
  if (route === undefined) {
    return { ok: false, reason: 'url' };
  }
  if (!isIntegerBetween(request.status, 0, MAX_HTTP_STATUS)) {
    return { ok: false, reason: 'status' };
  }
  if (!isIntegerBetween(request.durationMs, 0, MAX_REQUEST_DURATION_MS)) {
    return { ok: false, reason: 'duration' };
  }
  const { errorCode } = request;
  const keepsErrorCode = typeof errorCode === 'string' && ERROR_CODE_PATTERN.test(errorCode);
  const base = {
    method: request.method,
    route,
    status: request.status,
    duration_ms: request.durationMs,
  };
  return {
    ok: true,
    properties: keepsErrorCode ? { ...base, error_code: errorCode } : base,
    droppedErrorCode: errorCode !== undefined && !keepsErrorCode,
  };
}
