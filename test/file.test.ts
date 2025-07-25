import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

describe('z.file()', () => {
  it('outputs correct typescript', () => {
    expect(printZodAsTs({ schemas: z.file() })).toMatchInlineSnapshot(`
      "File"
    `);
  });
});
