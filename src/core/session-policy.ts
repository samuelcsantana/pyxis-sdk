export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface SessionState {
  readonly id: string;
  readonly lastActivityAt: number;
  readonly userId?: string;
}

export interface SessionTouch {
  readonly session: SessionState;
  readonly isNew: boolean;
}

export function touchSession(
  current: SessionState | undefined,
  now: number,
  newId: () => string,
): SessionTouch {
  if (current !== undefined && now - current.lastActivityAt <= SESSION_IDLE_TIMEOUT_MS) {
    return { session: { ...current, lastActivityAt: now }, isNew: false };
  }
  const session: SessionState =
    current?.userId === undefined
      ? { id: newId(), lastActivityAt: now }
      : { id: newId(), lastActivityAt: now, userId: current.userId };
  return { session, isNew: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseSession(raw: string | null): SessionState | undefined {
  if (raw === null) {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.lastActivityAt !== 'number' ||
    !Number.isFinite(value.lastActivityAt)
  ) {
    return undefined;
  }
  const { id, lastActivityAt, userId } = value;
  return typeof userId === 'string' ? { id, lastActivityAt, userId } : { id, lastActivityAt };
}

export function serializeSession(session: SessionState): string {
  return JSON.stringify(session);
}
