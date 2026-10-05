import type { PropertyValue } from './batch.js';

export const RESERVED_EVENT_NAMES: readonly string[] = ['page_view', 'identify', 'api_request'];
export const MAX_PROPERTIES = 10;
export const MAX_PROPERTY_STRING_LENGTH = 100;

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const PROPERTY_KEY_PATTERN = /^[a-z0-9_]{1,40}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type NameCheck = 'ok' | 'invalid' | 'reserved';

export type DropReason = 'invalid_key' | 'invalid_value' | 'too_many';

export interface DroppedProperty {
  readonly key: string;
  readonly reason: DropReason;
}

export interface SanitizedProperties {
  readonly properties: Readonly<Record<string, PropertyValue>>;
  readonly dropped: readonly DroppedProperty[];
}

export function checkEventName(name: unknown): NameCheck {
  if (typeof name !== 'string' || !EVENT_NAME_PATTERN.test(name)) {
    return 'invalid';
  }
  return RESERVED_EVENT_NAMES.includes(name) ? 'reserved' : 'ok';
}

export function isValidUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && USER_ID_PATTERN.test(userId);
}

function isPropertyValue(value: unknown): value is PropertyValue {
  return (
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.length <= MAX_PROPERTY_STRING_LENGTH)
  );
}

export function sanitizeProperties(input: unknown): SanitizedProperties {
  const kept: Record<string, PropertyValue> = {};
  const dropped: DroppedProperty[] = [];
  const entries = typeof input === 'object' && input !== null ? Object.entries(input) : [];
  for (const [key, value] of entries) {
    if (!PROPERTY_KEY_PATTERN.test(key)) {
      dropped.push({ key, reason: 'invalid_key' });
    } else if (!isPropertyValue(value)) {
      dropped.push({ key, reason: 'invalid_value' });
    } else if (Object.keys(kept).length >= MAX_PROPERTIES) {
      dropped.push({ key, reason: 'too_many' });
    } else {
      kept[key] = value;
    }
  }
  return { properties: kept, dropped };
}
