/* eslint-disable no-useless-escape */
import { expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

it('supports string literal properties', () => {
  const schema = z.object({
    'string-literal': z.string(),
    5: z.number(),
  });

  expect(printZodAsTs({ schemas: schema })).toMatchInlineSnapshot(`
		"{
		    "5": number;
		    "string-literal": string;
		}"
	`);
});

it('supports type identifiers', () => {
  const Name = z.string().meta({ id: 'Name' });

  const Root = z
    .object({
      id: z.string(),
      name: Name,
      age: z.number(),
    })
    .meta({ id: 'Root0' });

  expect(printZodAsTs({ schemas: [Root, Name] })).toMatchInlineSnapshot(`
    "type Root0 = {
        id: string;
        name: Name;
        age: number;
    };

    type Name = string;"
  `);
});

const CommentedName = z
  .string()
  .describe('Name type')
  .meta({ id: 'CommentedName' });

it('supports comments on type identifiers', () => {
  const Root = z
    .object({
      id: z.string(),
      name: CommentedName,
      age: z.number(),
    })
    .meta({ id: 'Root' });

  expect(printZodAsTs({ schemas: [Root, CommentedName] }))
    .toMatchInlineSnapshot(`
    "type Root = {
        id: string;
        name: CommentedName;
        age: number;
    };

    /** Name type */
    type CommentedName = string;"
  `);
});

it('still recognizes the type alias if it is cloned for comment', () => {
  const Root = z
    .object({
      id: z.string(),
      name: CommentedName.describe('Name property'),
      age: z.number(),
    })
    .meta({ id: 'Root2' });

  expect(printZodAsTs({ schemas: [Root, CommentedName] }))
    .toMatchInlineSnapshot(`
    "type Root2 = {
        id: string;
        /** Name property */
        name: CommentedName;
        age: number;
    };

    /** Name type */
    type CommentedName = string;"
  `);
});

it('supports optional properties', () => {
  const PrimitiveSchema = z.object({
    username: z.string(),
    age: z.number(),
    isAdmin: z.boolean(),
    createdAt: z.date(),
    undef: z.undefined(),
    nu: z.null(),
    vo: z.void(),
    an: z.any(),
    unknow: z.unknown(),
    nev: z.never(),
    bigint: z.bigint(),
  });

  expect(printZodAsTs({ schemas: PrimitiveSchema })).toMatchInlineSnapshot(`
  		"{
  		    username: string;
  		    age: number;
  		    isAdmin: boolean;
  		    createdAt: Date;
  		    undef?: undefined;
  		    nu: null;
  		    vo?: void | undefined;
  		    an?: any;
  		    unknow?: unknown;
  		    nev: never;
  		    bigint: bigint;
  		}"
  	`);
});

it('does not unnecessary quote identifiers', () => {
  const schema = z.object({
    id: z.string(),
    name: z.string(),
    countryOfOrigin: z.string(),
  });

  expect(printZodAsTs({ schemas: schema })).toMatchInlineSnapshot(`
		"{
		    id: string;
		    name: string;
		    countryOfOrigin: string;
		}"
	`);
});

it('escapes correctly', () => {
  const schema = z.object({
    '\\': z.string(),
    '"': z.string(),
    "'": z.string(),
    '`': z.string(),
    '\n': z.number(),
    $e: z.any(),
    '4t': z.any(),
    _r: z.any(),
    '-r': z.undefined(),
  });

  expect(printZodAsTs({ schemas: schema })).toMatchInlineSnapshot(`
		"{
		    "\\\\": string;
		    "\\"": string;
		    "'": string;
		    "\`": string;
		    "\\n": number;
		    \$e?: any;
		    "4t"?: any;
		    _r?: any;
		    "-r"?: undefined;
		}"
	`);
});

it('supports zod.describe()', () => {
  const schema = z.object({
    name: z.string().describe('The name of the item'),
    price: z.number().describe('The price of the item'),
  });

  expect(printZodAsTs({ schemas: schema })).toMatchInlineSnapshot(`
		"{
		    /** The name of the item */
		    name: string;
		    /** The price of the item */
		    price: number;
		}"
	`);
});
