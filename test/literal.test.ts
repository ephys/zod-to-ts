import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/utils.js';

describe('literals', () => {
  it.each([
    [z.literal(true), 'true'],
    [z.literal(false), 'false'],
    [z.literal('hello'), '"hello"'],
    [z.literal(42), '42'],
    [z.literal(3.14), '3.14'],
    [z.literal(12345678901234567890n), '12345678901234567890n'],
    [z.literal(null), 'null'],
    [z.literal(undefined), 'undefined'],
    [z.literal(['a', 'b', 'c']), '"a" | "b" | "c"'],
  ])('outputs $1', (schema, result) => {
    expect(
      printZodAsTs({
        schemas: schema,
      }),
    ).toEqual(result);
  });
});
