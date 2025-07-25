import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

describe('z.map()', () => {
  it('outputs correct typescript', () => {
    expect(printZodAsTs({ schemas: z.map(z.string(), z.int()) }))
      .toMatchInlineSnapshot(`
			"Map<string, number>"
		`);
  });

  it('supports z.map().readonly()', () => {
    expect(printZodAsTs({ schemas: z.map(z.string(), z.int()).readonly() }))
      .toMatchInlineSnapshot(`
      "ReadonlyMap<string, number>"
    `);
  });
});
