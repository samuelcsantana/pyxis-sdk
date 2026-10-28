import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ID_PLACEHOLDER, MAX_PATH_LENGTH, templatePath } from './path-template.js';

interface Segment {
  readonly text: string;
  readonly identifier: boolean;
}

const MAX_SHORT_PATH_SEGMENTS = 14;
const MAX_LONG_PATH_SEGMENTS = 120;

const word = fc.stringMatching(/^[a-z][a-z-]{0,15}$/);

const emailAddress = fc.emailAddress().filter((address) => !address.includes('/'));

const identifier = fc.oneof(
  fc.uuid(),
  fc.uuid().map((uuid) => uuid.toUpperCase()),
  fc.stringMatching(/^\d{1,20}$/),
  fc.stringMatching(/^[a-z]{0,5}(\d[.()-]?){10,14}$/),
  emailAddress,
  emailAddress.map((address) => address.replaceAll('@', '%40')),
);

const segment = fc.oneof(
  word.map((text): Segment => ({ text, identifier: false })),
  identifier.map((text): Segment => ({ text, identifier: true })),
);

const trailingSlashes = fc.constantFrom('', '/', '//');

const anyText = fc.string({ unit: 'grapheme', maxLength: 12 });

const anyPath = fc.oneof(
  fc
    .array(fc.oneof(word, identifier, anyText), { maxLength: MAX_SHORT_PATH_SEGMENTS })
    .map((texts) => `/${texts.join('/')}`),
  fc.string({ unit: 'grapheme', maxLength: 80 }),
);

const longPath = fc
  .array(word, { maxLength: MAX_LONG_PATH_SEGMENTS })
  .map((words) => `/${words.join('/')}`);

const paramName = fc.stringMatching(/^:[a-z]{1,8}$/);

const ruleSegment = fc.oneof(
  word.map((text) => ({ rule: text, path: fc.constant(text) })),
  paramName.map((name) => ({
    rule: name,
    path: fc
      .string({ unit: 'grapheme', minLength: 1, maxLength: 20 })
      .map((text) => text.replaceAll('/', '-')),
  })),
);

const ruleWithMatchingPath = fc
  .array(ruleSegment, { minLength: 1, maxLength: 8 })
  .chain((segments) =>
    fc.tuple(...segments.map(({ path }) => path)).map((texts) => ({
      rule: `/${segments.map(({ rule }) => rule).join('/')}`,
      path: `/${texts.join('/')}`,
    })),
  );

describe('templatePath properties', () => {
  it(`replaces every identifier-shaped segment with ${ID_PLACEHOLDER} and keeps every other segment`, () => {
    fc.assert(
      fc.property(
        fc.array(segment, { maxLength: MAX_SHORT_PATH_SEGMENTS }),
        trailingSlashes,
        (segments, trailing) => {
          const path = `/${segments.map(({ text }) => text).join('/')}${trailing}`;
          const expected = `/${segments
            .map(({ text, identifier: isIdentifier }) => (isIdentifier ? ID_PLACEHOLDER : text))
            .join('/')}`;

          expect(templatePath(path, [])).toBe(expected);
        },
      ),
    );
  });

  it('changes nothing when it templates its own result again, as long as nothing was cut', () => {
    fc.assert(
      fc.property(anyPath, (path) => {
        const once = templatePath(path, []);
        fc.pre(once.length < MAX_PATH_LENGTH);

        expect(templatePath(once, [])).toBe(once);
      }),
    );
  });

  it('turns a path into the first rule with the same segments, whatever fills its parameters', () => {
    fc.assert(
      fc.property(ruleWithMatchingPath, ({ rule, path }) => {
        expect(templatePath(path, [rule])).toBe(rule);
      }),
    );
  });

  it(`never returns more than ${String(MAX_PATH_LENGTH)} characters, whatever the path and the rules`, () => {
    fc.assert(
      fc.property(fc.oneof(anyPath, longPath), fc.boolean(), (path, pathIsARule) => {
        const rules = pathIsARule ? [path] : [];

        expect(templatePath(path, rules).length).toBeLessThanOrEqual(MAX_PATH_LENGTH);
      }),
    );
  });
});
