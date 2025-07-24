import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodToTs } from '../src/index.js';
import { printNodeTest } from './utils.js';

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

describe('PrimitiveSchema', () => {
  it('outputs correct typescript', () => {
    const { node } = zodToTs(PrimitiveSchema, 'User');

    expect(printNodeTest(node)).toMatchInlineSnapshot(`
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
});
