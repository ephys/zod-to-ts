import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { globalRegistry } from 'zod/v4/core';
import { printZodAsTs } from '../src/index.js';

afterEach(() => {
  globalRegistry.clear();
});

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

  it('supports exporting schemas', () => {
    const MyStringSchema = z.string().meta({ id: 'MyString' });

    const output = printZodAsTs({
      exportedSchemas: [MyStringSchema],
    });

    expect(output).toMatchInlineSnapshot(`
    "export type MyString = string;"
    `);
  });

  it('throws if trying to export a schema without an ID', () => {
    const MyStringSchema = z.string();

    expect(() =>
      printZodAsTs({
        exportedSchemas: [MyStringSchema],
      }),
    ).toThrowError(`Cannot export a Zod schema without an identifier`);
  });

  it('supports not outputing a schema but still using it as a reference', () => {
    const TypeA = z.string().meta({ id: 'TypeA' });
    const TypeB = z.object({
      a: TypeA,
    });

    const output = printZodAsTs({
      schemas: TypeB,
      hiddenSchemas: [TypeA],
    });

    expect(output).toMatchInlineSnapshot(`
    "{
    a: TypeA;
}"`);
  });
});
