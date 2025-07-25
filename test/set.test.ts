import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

describe('z.set()', () => {
  it('outputs correct typescript', () => {
    expect(printZodAsTs({ schemas: z.set(z.string()) })).toMatchInlineSnapshot(`
			"Set<string>"
		`);
  });

  it('supports z.set().readonly()', () => {
    expect(printZodAsTs({ schemas: z.set(z.string()).readonly() }))
      .toMatchInlineSnapshot(`
      "ReadonlySet<string>"
    `);
  });
});
