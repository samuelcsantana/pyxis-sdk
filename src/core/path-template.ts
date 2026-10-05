export const MAX_PATH_LENGTH = 256;
export const ID_PLACEHOLDER = ':id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALL_DIGITS = /^\d+$/;
const DIGIT = /\d/g;
const ENCODED_AT_SIGN = /%40/i;
const MIN_ID_DIGITS = 10;

function isIdentifier(segment: string): boolean {
  return (
    UUID_PATTERN.test(segment) ||
    ALL_DIGITS.test(segment) ||
    (segment.match(DIGIT)?.length ?? 0) >= MIN_ID_DIGITS ||
    segment.includes('@') ||
    ENCODED_AT_SIGN.test(segment)
  );
}

function withoutTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path.charAt(end - 1) === '/') {
    end -= 1;
  }
  return end === 0 ? '/' : path.slice(0, end);
}

function matchesRule(segments: readonly string[], rule: string): boolean {
  const ruleSegments = withoutTrailingSlashes(rule).split('/');
  return (
    ruleSegments.length === segments.length &&
    ruleSegments.every(
      (ruleSegment, index) => ruleSegment.startsWith(':') || ruleSegment === segments[index],
    )
  );
}

export function templatePath(path: string, rules: readonly string[]): string {
  const segments = withoutTrailingSlashes(path).split('/');
  const rule = rules.find((candidate) => matchesRule(segments, candidate));
  const templated =
    rule === undefined
      ? segments.map((segment) => (isIdentifier(segment) ? ID_PLACEHOLDER : segment)).join('/')
      : withoutTrailingSlashes(rule);
  return templated.slice(0, MAX_PATH_LENGTH);
}
