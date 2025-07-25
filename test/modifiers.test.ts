import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { globalRegistry } from 'zod/v4/core';
import { printZodAsTs } from '../src/index.js';

afterEach(() => {
  globalRegistry.clear();
});

type User = {
  mother: User;
};

describe('z.lazy() referencing root type', () => {
  it('outputs correct typescript', () => {
    const UserSchema: z.ZodSchema<User> = z
      .object({
        mother: z.lazy(() => UserSchema),
      })
      .meta({ id: 'User' });

    expect(printZodAsTs({ schemas: UserSchema })).toMatchInlineSnapshot(`
			"type User = {
			    mother: User;
			};"
		`);
  });
});

const OptionalStringSchema = z.string().optional();

const ObjectWithOptionals = z.object({
  optional: OptionalStringSchema,
  required: z.string(),
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

  it('is not output multiple times', () => {
    expect(
      printZodAsTs({ schemas: OptionalStringSchema.optional().optional() }),
    ).toMatchInlineSnapshot('"string | undefined"');
  });

  it('should output `?:` and undefined union for optional properties', () => {
    expect(printZodAsTs({ schemas: ObjectWithOptionals }))
      .toMatchInlineSnapshot(`
			"{
			    optional?: string | undefined;
			    required: string;
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

describe('z.nonoptional()', () => {
  it('has no impact on types', () => {
    expect(
      printZodAsTs({ schemas: z.nonoptional(z.string()) }),
    ).toMatchInlineSnapshot('"string"');
  });

  it('Undoes z.optional()', () => {
    expect(
      printZodAsTs({ schemas: z.nonoptional(OptionalStringSchema) }),
    ).toMatchInlineSnapshot('"string"');
  });

  it('can undo z.optional() inside of z.lazy()', () => {
    const UserSchema: z.ZodSchema<User> = z
      .object({
        mother: z.lazy(() => UserSchema.optional()).nonoptional(),
      })
      .meta({ id: 'User' });

    expect(printZodAsTs({ schemas: UserSchema })).toMatchInlineSnapshot(`
      "type User = {
          mother: User;
      };"
    `);
  });

  it('can undo z.optional() inside of unions', () => {
    const schema = z
      .union([z.string().optional(), z.number().optional()])
      .nonoptional();

    expect(printZodAsTs({ schemas: schema })).toMatchInlineSnapshot(`
      "string | number"
    `);
  });
});

describe('z.nullable()', () => {
  it('outputs correct typescript', () => {
    expect(
      printZodAsTs({ schemas: z.string().nullable() }),
    ).toMatchInlineSnapshot(`"string | null"`);
  });

  it('is not output multiple times', () => {
    expect(
      printZodAsTs({
        schemas: z.string().nullable().optional().nullable().optional(),
      }),
    ).toMatchInlineSnapshot('"(string | null) | undefined"');
  });
});

describe('z.default()', () => {
  it('has no impact on types', () => {
    expect(printZodAsTs({ schemas: z.number().default(0) })).toEqual('number');
  });
});

describe('z.prefault()', () => {
  it('has no impact on types', () => {
    expect(printZodAsTs({ schemas: z.number().prefault(0) })).toEqual('number');
  });
});

describe('z.catch()', () => {
  it('has no impact on types', () => {
    expect(printZodAsTs({ schemas: z.number().catch(0) })).toEqual('number');
  });
});
