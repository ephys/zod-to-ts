import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

const OptionalStringSchema = z.string().optional();

const ObjectWithOptionals = z.object({
  optional: OptionalStringSchema,
  required: z.string(),
  transform: z
    .number()
    .optional()
    .transform((number_) => number_),
  or: z.number().optional().or(z.string()),
  tuple: z
    .tuple([
      z.string().optional(),
      z.number(),
      z.object({
        optional: z.string().optional(),
        required: z.string(),
      }),
    ])
    .optional(),
});

describe('z.optional()', () => {
  it('outputs correct typescript', () => {
    expect(
      printZodAsTs({ schemas: OptionalStringSchema }),
    ).toMatchInlineSnapshot('"string | undefined"');
  });

  it('should output `?:` and undefined union for optional properties', () => {
    expect(printZodAsTs({ schemas: ObjectWithOptionals }))
      .toMatchInlineSnapshot(`
			"{
			    optional?: string | undefined;
			    required: string;
			    transform?: number | undefined;
			    or?: (number | undefined) | string;
			    tuple?: [
			        string | undefined,
			        number,
			        {
			            optional?: string | undefined;
			            required: string;
			        }
			    ] | undefined;
			}"
		`);
  });
});

const NullableUsernameSchema = z.object({
  username: z.string().nullable(),
});

describe('z.nullable()', () => {
  it('outputs correct typescript', () => {
    expect(printZodAsTs({ schemas: NullableUsernameSchema }))
      .toMatchInlineSnapshot(`
			"{
			    username: string | null;
			}"
		`);
  });
});
