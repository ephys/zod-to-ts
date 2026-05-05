import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

describe('z.function()', () => {
  it('supports unknown functions', () => {
    expect(printZodAsTs({ schemas: z.function() })).toMatchInlineSnapshot(
      `"(...args: unknown[]) => unknown"`,
    );
  });

  it('supports tuple inputs', () => {
    expect(
      printZodAsTs({
        schemas: z.function({
          input: z.tuple([z.string(), z.number()]),
          output: z.boolean(),
        }),
      }),
    ).toMatchInlineSnapshot(`"(arg0: string, arg1: number) => boolean"`);
  });

  it('supports array inputs', () => {
    expect(
      printZodAsTs({
        schemas: z.function({
          input: [z.string(), z.number()],
          output: z.void(),
        }),
      }),
    ).toMatchInlineSnapshot(`"(arg0: string, arg1: number) => void"`);
  });

  it('outputs correct typescript for a function with no args and typed return', () => {
    expect(
      printZodAsTs({
        schemas: z.function({
          input: z.tuple([]),
          output: z.string(),
        }),
      }),
    ).toMatchInlineSnapshot(`"() => string"`);
  });
});
