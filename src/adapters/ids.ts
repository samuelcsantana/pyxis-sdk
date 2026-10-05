const UUID_BYTES = 16;
const VARIANT_MASK = 0x3f;
const VARIANT_BITS = 0x80;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function uuidFromBytes(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  const variant = ((parseInt(hex.slice(16, 18), 16) & VARIANT_MASK) | VARIANT_BITS).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export function createUuid(source: Partial<Crypto> | undefined): string {
  if (typeof source?.randomUUID === 'function') {
    return source.randomUUID();
  }
  const bytes = new Uint8Array(UUID_BYTES);
  if (typeof source?.getRandomValues === 'function') {
    source.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => {
      bytes[index] = Math.floor(Math.random() * 256);
    });
  }
  return uuidFromBytes(bytes);
}
