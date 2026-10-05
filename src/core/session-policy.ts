export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface SessionState {
  readonly id: string;
  readonly lastActivityAt: number;
  readonly userId?: string;
  readonly entryRecorded?: true;
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
  const { id, lastActivityAt, userId, entryRecorded } = value;
  return {
    id,
    lastActivityAt,
    ...(typeof userId === 'string' ? { userId } : {}),
    ...(entryRecorded === true ? { entryRecorded } : {}),
  };
}

export function recordEntry(session: SessionState): SessionState {
  return { ...session, entryRecorded: true };
}

export function serializeSession(session: SessionState): string {
  return JSON.stringify(session);
}
