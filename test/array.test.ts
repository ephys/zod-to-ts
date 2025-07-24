import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { zodToTs } from '../src'
import { printNodeTest } from './utils'

const ItemsSchema = z.object({
	id: z.number(),
	value: z.string(),
}).array()

describe('z.array()', () => {
	it('outputs correct typescript', () => {
		const { node } = zodToTs(ItemsSchema, 'User')

		expect(printNodeTest(node)).toMatchInlineSnapshot(`
			"{
			    id: number;
			    value: string;
			}[]"
		`)
	})
})
