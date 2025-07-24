import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodToTs } from '../src/index.js';
import { printNodeTest } from './utils.js';

const ShapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), radius: z.number() }),
  z.object({ kind: z.literal('square'), x: z.number() }),
  z.object({ kind: z.literal('triangle'), x: z.number(), y: z.number() }),
]);

describe('z.discriminatedUnion()', () => {
  it('outputs correct typescript', () => {
    const { node } = zodToTs(ShapeSchema, 'Shape');

    expect(printNodeTest(node)).toMatchInlineSnapshot(`
			"{
			    kind: "circle";
			    radius: number;
			} | {
			    kind: "square";
			    x: number;
			} | {
			    kind: "triangle";
			    x: number;
			    y: number;
			}"
		`);
  });
});
