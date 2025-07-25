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

  it('supports z.array().readonly()', () => {
    expect(printZodAsTs({ schemas: z.string().array().readonly() })).toEqual(
      'readonly string[]',
    );

    expect(printZodAsTs({ schemas: ItemsSchema.readonly() }))
      .toMatchInlineSnapshot(`
			"readonly {
			    id: number;
			    value: string;
			}[]"
		`);
  });
});

describe('z.tuple()', () => {
  it('outputs correct typescript', () => {
    const TupleSchema = z.tuple([z.string(), z.number()]);

    expect(printZodAsTs({ schemas: TupleSchema })).toMatchInlineSnapshot(`
      "[
          string,
          number
      ]"
    `);
  });

  it('supports z.tuple().readonly()', () => {
    const TupleSchema = z.tuple([z.string(), z.number()]).readonly();

    expect(printZodAsTs({ schemas: TupleSchema })).toMatchInlineSnapshot(`
      "readonly [
          string,
          number
      ]"
    `);
  });
});
