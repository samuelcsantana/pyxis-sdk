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

const wordWithLeadingDigits = fc.stringMatching(/^\d{1,3}[a-z]{1,10}$/);

const longWord = fc.stringMatching(/^[a-z]{200,320}$/);

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

const longPathSegment = fc.oneof(
  { weight: 4, arbitrary: segment },
  {
    weight: 2,
    arbitrary: wordWithLeadingDigits.map((text): Segment => ({ text, identifier: false })),
  },
  { weight: 1, arbitrary: longWord.map((text): Segment => ({ text, identifier: false })) },
);

const trailingSlashes = fc.constantFrom('', '/', '//');

const anyText = fc.string({ unit: 'grapheme', maxLength: 12 });

const anyPath = fc.oneof(
  fc
    .array(fc.oneof(word, identifier, anyText), { maxLength: MAX_SHORT_PATH_SEGMENTS })
    .map((texts) => `/${texts.join('/')}`),
  fc
    .array(fc.oneof(word, wordWithLeadingDigits, identifier, anyText), {
      maxLength: MAX_LONG_PATH_SEGMENTS,
      size: 'max',
    })
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

  it(`cuts a path longer than ${String(MAX_PATH_LENGTH)} characters after its last whole segment, or sends /${ID_PLACEHOLDER} when not even the first one fits`, () => {
    fc.assert(
      fc.property(
        fc.array(longPathSegment, { minLength: 1, maxLength: MAX_LONG_PATH_SEGMENTS, size: 'max' }),
        (segments) => {
          const path = `/${segments.map(({ text }) => text).join('/')}`;
          const templated = segments.map(({ text, identifier: isIdentifier }) =>
            isIdentifier ? ID_PLACEHOLDER : text,
          );
          const wholePrefixes = templated.map(
            (_, index) => `/${templated.slice(0, index + 1).join('/')}`,
          );
          const expected =
            wholePrefixes.filter((prefix) => prefix.length <= MAX_PATH_LENGTH).at(-1) ??
            `/${ID_PLACEHOLDER}`;

          expect(templatePath(path, [])).toBe(expected);
        },
      ),
    );
  });

  it('changes nothing when it templates its own result again, as the API does, whatever the length', () => {
    fc.assert(
      fc.property(anyPath, (path) => {
        const once = templatePath(path, []);

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
