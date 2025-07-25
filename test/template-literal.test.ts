import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

describe('z.templateLiteral()', () => {
  it('outputs correct typescript', () => {
    expect(
      printZodAsTs({
        schemas: z.templateLiteral([
          'Hello',
          ' ',
          z.string(),
          '!',
          1,
          1n,
          true,
          ' ',
          false,
          ' ',
          null,
          ' ',
          undefined,
          ' ',
          z.literal(5),
        ]),
      }),
    ).toEqual(
      '`Hello ${string}!${1}${1n}${true} ${false} ${null} ${undefined} ${5}`',
    );

    expect(
      printZodAsTs({
        schemas: z.templateLiteral([z.nullable(z.literal('grassy'))]),
      }),
    ).toEqual('`${"grassy" | null}`');
  });
});
