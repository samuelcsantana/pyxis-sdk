import type { BatchEvent } from './batch.js';

export const FLUSH_EVENT_COUNT = 10;
export const FLUSH_DELAY_MS = 5000;
export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_BATCH_BYTES = 32 * 1024;
export const MAX_QUEUE_SIZE = 500;

const encoder = new TextEncoder();

export function byteLength(text: string): number {
  return encoder.encode(text).length;
}

export function shouldFlushNow(queueLength: number): boolean {
  return queueLength >= FLUSH_EVENT_COUNT;
}

export function enqueue(
  queue: readonly BatchEvent[],
  event: BatchEvent,
  capacity: number = MAX_QUEUE_SIZE,
): { readonly queue: readonly BatchEvent[]; readonly accepted: boolean } {
  return queue.length >= capacity
    ? { queue, accepted: false }
    : { queue: [...queue, event], accepted: true };
}

export interface ChunkResult {
  readonly chunks: readonly (readonly BatchEvent[])[];
  readonly oversized: readonly BatchEvent[];
}

export function chunkEvents(
  events: readonly BatchEvent[],
  serialize: (events: readonly BatchEvent[]) => string,
  maxEvents: number = MAX_EVENTS_PER_BATCH,
  maxBytes: number = MAX_BATCH_BYTES,
): ChunkResult {
  const chunks: BatchEvent[][] = [];
  const oversized: BatchEvent[] = [];
  let current: BatchEvent[] = [];
  const fits = (candidate: readonly BatchEvent[]) =>
    candidate.length <= maxEvents && byteLength(serialize(candidate)) <= maxBytes;

  for (const event of events) {
    if (!fits([event])) {
      oversized.push(event);
      continue;
    }
    const candidate = [...current, event];
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    chunks.push(current);
    current = [event];
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return { chunks, oversized };
}
