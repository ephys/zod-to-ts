import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

describe('z.promise()', () => {
  it('outputs correct typescript', () => {
    expect(printZodAsTs({ schemas: z.promise(z.string()) }))
      .toMatchInlineSnapshot(`
			"Promise<string>"
		`);
  });
});
