import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/utils.js';

describe('PrimitiveSchema', () => {
  it.each([
    [z.string(), 'string'],
    [z.number(), 'number'],
    [z.boolean(), 'boolean'],
    [z.date(), 'Date'],
    [z.undefined(), 'undefined'],
    [z.null(), 'null'],
    [z.void(), 'void | undefined'],
    [z.any(), 'any'],
    [z.unknown(), 'unknown'],
    [z.never(), 'never'],
    [z.bigint(), 'bigint'],
  ])('supports $1', (schema, result) => {
    expect(
      printZodAsTs({
        schemas: schema,
      }),
    ).toEqual(result);
  });
});
