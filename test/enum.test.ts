import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { globalRegistry } from 'zod/v4/core';
import { printZodAsTs } from '../src/utils.js';

afterEach(() => {
  globalRegistry.clear();
});

describe('Enum', () => {
  it('supports enum refs', () => {
    const Enum = z
      .enum({
        ONE: 1,
        TWO: 2,
      })
      .meta({ id: 'Enum' });

    const Test = z
      .object({
        key: Enum.describe('Comment for key'),
      })
      .meta({ id: 'Test' });

    expect(printZodAsTs({ schemas: [Test, Enum] })).toMatchInlineSnapshot(`
			"type Test = {
			    /** Comment for key */
			    key: Enum;
			};

			type Enum = 1 | 2;"
		`);
  });

  it('supports native TS enums', () => {
    enum Color {
      Red = 0,
      Green = 1,
      Blue = 2,
    }

    const Enum = z.enum(Color);

    expect(printZodAsTs({ schemas: Enum })).toMatchInlineSnapshot(`
      "0 | 1 | 2"
    `);
  });

  it('supports native TS enums with string values', () => {
    enum Fruit {
      Apple = 'apple',
      Banana = 'banana',
      Cantaloupe = 'cantaloupe',
    }

    const Enum = z.enum(Fruit);

    expect(printZodAsTs({ schemas: Enum })).toMatchInlineSnapshot(`
      ""apple" | "banana" | "cantaloupe""
    `);
  });
});

it('handles string literal properties', () => {
  enum StringLiteral {
    'Two Words' = 'Two Words',
    '\'Quotes"' = '\'Quotes"',
    '\\"Escaped\\"' = '\\"Escaped\\"',
  }

  const Enum = z.enum(StringLiteral);

  expect(printZodAsTs({ schemas: Enum })).toMatchInlineSnapshot(`
		""Two Words" | "'Quotes\\"" | "\\\\\\"Escaped\\\\\\"""
	`);
});
