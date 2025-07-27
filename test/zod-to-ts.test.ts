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
    })
      .toThrowError(`Circular reference detected in Zod schema. To break the cycle, please assign identifiers to your schemas using the \`meta({ id: "MySchema" })\` method and add them to the \`identifiers\` (if using zodToTs) or \`schemas\` (if using the other methods) option.

Path:`);
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

  it('formats multiline comments', () => {
    const MyStringSchema = z
      .string()
      .describe(
        `A string
with multiple lines`,
      )
      .meta({ id: 'MyString' });

    const output = printZodAsTs({ schemas: MyStringSchema });

    expect(output).toEqual(`/**
 * A string
 * with multiple lines
 */
type MyString = string;`);
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

  it('provides a clear path to the part of the schema that caused an error', () => {
    const NestedSchema = z.promise(
      z.set(
        z.map(
          z.string(),
          z.tuple([
            z.intersection(
              z.string(),
              z
                .union([
                  z.string(),
                  z.record(
                    z.string(),
                    z.object({
                      myProp: z.array(z.instanceof(Date)),
                    }),
                  ),
                ])
                .meta({ id: 'MyUnion' }),
            ),
          ]),
        ),
      ),
    );

    expect(() => printZodAsTs({ schemas: NestedSchema })).toThrowError(
      `Custom Zod types cannot be automatically converted to TypeScript. Please use overwriteTsOutput to generate the typings yourself for this schema.

Path: #root (promise) → #innerType (set) → #value (map) → #value (tuple) → #option-0 (intersection) → #right (union, MyUnion) → #option-1 (record) → #value (object) → myProp (array) → #element (custom)`,
    );
  });

  it('can sort types by schema name', () => {
    const TypeA = z.string().meta({ id: 'TypeA' });
    const TypeB = z.string().meta({ id: 'TypeB' });
    const TypeC = z.string().meta({ id: 'TypeC' });

    const output = printZodAsTs({
      schemas: [TypeC, TypeA, TypeB],
      sort: {
        declarations: (a, b) => a.localeCompare(b),
      },
    });

    expect(output).toMatchInlineSnapshot(`
    "type TypeA = string;
    
    type TypeB = string;
    
    type TypeC = string;"
    `);
  });
});
