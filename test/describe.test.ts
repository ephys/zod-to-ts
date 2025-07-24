import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { withGetType, zodToTs } from '../src/index.js';
import { printNodeTest } from './utils.js';

describe('z.describe()', () => {
  it('supports describing schema after withGetType', () => {
    const Enum = z.nativeEnum({
      ONE: 1,
      TWO: 2,
    });

    withGetType(Enum, (ts) => ts.factory.createIdentifier('Enum'));

    const schema = z.object({
      key: Enum.describe('Comment for key'),
    });

    const { node } = zodToTs(schema);

    expect(printNodeTest(node)).toMatchInlineSnapshot(`
			"{
			    /** Comment for key */
			    key: Enum;
			}"
		`);
  });
});
