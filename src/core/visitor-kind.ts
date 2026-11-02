export const PERIOD_KEY = 'pyxis:period';

export type VisitorKind = 'first_visit' | 'first_this_month' | 'first_today' | 'again_today';

export interface VisitorPeriod {
  readonly day_ends_at: string;
  readonly month_ends_at: string;
}

export type PeriodAnswer = VisitorPeriod | 'off';

const UTC_INSTANT = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{3})?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function instantOf(text: string): number {
  return UTC_INSTANT.test(text) ? Date.parse(text) : Number.NaN;
}

export function parseVisitorPeriod(value: unknown): VisitorPeriod | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { day_ends_at: dayEndsAt, month_ends_at: monthEndsAt } = value;
  if (typeof dayEndsAt !== 'string' || typeof monthEndsAt !== 'string') {
    return undefined;
  }
  return instantOf(dayEndsAt) <= instantOf(monthEndsAt)
    ? { day_ends_at: dayEndsAt, month_ends_at: monthEndsAt }
    : undefined;
}

export function parseStoredPeriod(raw: string | null): VisitorPeriod | undefined {
  return raw === null ? undefined : parseVisitorPeriod(parseJson(raw));
}

export function serializePeriod(period: VisitorPeriod): string {
  return JSON.stringify({ day_ends_at: period.day_ends_at, month_ends_at: period.month_ends_at });
}

export function periodAnswerOf(body: string): PeriodAnswer | undefined {
  const answer = parseJson(body);
  if (!isRecord(answer) || typeof answer.accepted !== 'number') {
    return undefined;
  }
  return answer.visitor_period === undefined ? 'off' : parseVisitorPeriod(answer.visitor_period);
}

export function visitorKindOf(period: VisitorPeriod | undefined, now: number): VisitorKind {
  if (period === undefined) {
    return 'first_visit';
  }
  if (now >= Date.parse(period.month_ends_at)) {
    return 'first_this_month';
  }
  return now >= Date.parse(period.day_ends_at) ? 'first_today' : 'again_today';
}
