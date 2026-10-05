import { describe, expect, it } from 'vitest';
import {
  parseSession,
  recordEntry,
  SESSION_IDLE_TIMEOUT_MS,
  serializeSession,
  touchSession,
} from './session-policy.js';

const newId = () => 'new-session';

describe('touchSession', () => {
  it('starts a session when there is none', () => {
    expect(touchSession(undefined, 1000, newId)).toEqual({
      session: { id: 'new-session', lastActivityAt: 1000 },
      isNew: true,
    });
  });

  it('keeps the session and moves its last activity while it is active', () => {
    const current = { id: 'visit', lastActivityAt: 1000 };

    expect(touchSession(current, 1000 + SESSION_IDLE_TIMEOUT_MS, newId)).toEqual({
      session: { id: 'visit', lastActivityAt: 1000 + SESSION_IDLE_TIMEOUT_MS },
      isNew: false,
    });
  });

  it('starts a new session after 30 minutes without activity', () => {
    const current = { id: 'visit', lastActivityAt: 1000 };

    expect(touchSession(current, 1001 + SESSION_IDLE_TIMEOUT_MS, newId)).toEqual({
      session: { id: 'new-session', lastActivityAt: 1001 + SESSION_IDLE_TIMEOUT_MS },
      isNew: true,
    });
  });

  it('carries the identified user into the renewed session of the same tab', () => {
    const current = { id: 'visit', lastActivityAt: 0, userId: 'user_42' };

    expect(touchSession(current, SESSION_IDLE_TIMEOUT_MS + 1, newId).session).toEqual({
      id: 'new-session',
      lastActivityAt: SESSION_IDLE_TIMEOUT_MS + 1,
      userId: 'user_42',
    });
  });
});

describe('recordEntry', () => {
  it('marks the entry without touching the rest of the session', () => {
    expect(recordEntry({ id: 'visit', lastActivityAt: 42, userId: 'user_42' })).toEqual({
      id: 'visit',
      lastActivityAt: 42,
      userId: 'user_42',
      entryRecorded: true,
    });
  });
});

describe('touchSession and the entry flag', () => {
  it('keeps the flag while the session lasts and forgets it on renewal', () => {
    const current = recordEntry({ id: 'visit', lastActivityAt: 0 });

    expect(touchSession(current, 1, newId).session.entryRecorded).toBe(true);
    expect(
      touchSession(current, SESSION_IDLE_TIMEOUT_MS + 1, newId).session.entryRecorded,
    ).toBeUndefined();
  });
});

describe('parseSession', () => {
  it('reads back what serializeSession wrote', () => {
    const session = { id: 'visit', lastActivityAt: 42, userId: 'user_42' };

    expect(parseSession(serializeSession(session))).toEqual(session);
  });

  it('reads a session without a user', () => {
    expect(parseSession('{"id":"visit","lastActivityAt":42}')).toEqual({
      id: 'visit',
      lastActivityAt: 42,
    });
  });

  it('reads back a session whose entry page view was recorded', () => {
    const session = recordEntry({ id: 'visit', lastActivityAt: 42 });

    expect(parseSession(serializeSession(session))).toEqual({
      id: 'visit',
      lastActivityAt: 42,
      entryRecorded: true,
    });
  });

  it('ignores an entry flag that is not true', () => {
    expect(parseSession('{"id":"visit","lastActivityAt":42,"entryRecorded":"yes"}')).toEqual({
      id: 'visit',
      lastActivityAt: 42,
    });
  });

  it('ignores a user id that is not text', () => {
    expect(parseSession('{"id":"visit","lastActivityAt":42,"userId":7}')).toEqual({
      id: 'visit',
      lastActivityAt: 42,
    });
  });

  it.each([
    ['nothing stored', null],
    ['broken JSON', '{"id":'],
    ['a value that is not an object', '"visit"'],
    ['null', 'null'],
    ['a missing id', '{"lastActivityAt":42}'],
    ['a non-numeric activity time', '{"id":"visit","lastActivityAt":"42"}'],
    ['an infinite activity time', '{"id":"visit","lastActivityAt":1e999}'],
  ])('returns nothing for %s', (_label, raw) => {
    expect(parseSession(raw)).toBeUndefined();
  });
});
