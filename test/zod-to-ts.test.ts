import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

describe('zod-to-ts', () => {
  it('detects circular references', () => {
    const UserSchema = z.object({
      name: z.string(),
      friends: z.array(z.lazy<any>(() => UserSchema)),
    });

    expect(() => {
      printZodAsTs({ schemas: UserSchema });
    }).toThrowError(`Circular reference detected in Zod schema`);
  });

  it('does not support comments on non-declaration outputs', () => {
    const MyStringSchema = z.string().describe('A string');

    const output = printZodAsTs({ schemas: MyStringSchema });

    expect(output).toEqual(`string`);
  });

  it('supports comments on declaration outputs', () => {
    const MyStringSchema = z
      .string()
      .describe('A string')
      .meta({ id: 'MyString' });

    const output = printZodAsTs({ schemas: MyStringSchema });

    expect(output).toMatchInlineSnapshot(`
    "/** A string */
    type MyString = string;"
    `);
  });
});
