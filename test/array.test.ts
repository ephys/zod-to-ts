import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

const ItemsSchema = z
  .object({
    id: z.number(),
    value: z.string(),
  })
  .array();

describe('z.array()', () => {
  it('outputs correct typescript', () => {
    expect(printZodAsTs({ schemas: ItemsSchema })).toMatchInlineSnapshot(`
			"{
			    id: number;
			    value: string;
			}[]"
		`);
  });
});
