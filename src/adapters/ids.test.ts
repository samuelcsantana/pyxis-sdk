import { describe, expect, it, vi } from 'vitest';
import { createUuid, uuidFromBytes } from './ids.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidFromBytes', () => {
  it('formats 16 bytes as a version 4 UUID', () => {
    expect(uuidFromBytes(new Uint8Array(16).fill(0xff))).toBe(
      'ffffffff-ffff-4fff-bfff-ffffffffffff',
    );
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('does not change the bytes it was given', () => {
    const bytes = new Uint8Array(16).fill(0xff);

    uuidFromBytes(bytes);

    expect(bytes[6]).toBe(0xff);
  });
});

describe('createUuid', () => {
  const fillWithAb = ((array: Uint8Array) =>
    array.fill(0xab)) as unknown as Crypto['getRandomValues'];

  it('uses crypto.randomUUID when the browser has it', () => {
    const randomUUID = vi.fn(() => '6f1c0000-0000-4000-8000-000000000000' as const);

    expect(createUuid({ randomUUID, getRandomValues: fillWithAb })).toBe(
      '6f1c0000-0000-4000-8000-000000000000',
    );
  });

  it('falls back to getRandomValues outside secure contexts, where randomUUID is missing', () => {
    expect(createUuid({ getRandomValues: fillWithAb })).toBe(
      'abababab-abab-4bab-abab-abababababab',
    );
  });

  it('produces a version 4 UUID from the real crypto API', () => {
    expect(createUuid(globalThis.crypto)).toMatch(UUID_V4);
  });
});
