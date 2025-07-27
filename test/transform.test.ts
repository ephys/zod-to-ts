import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

const TransformSchema = z.string().transform(() => 10);

describe('z.transform()', () => {
  it('is not supported', () => {
    expect(() => printZodAsTs({ schemas: TransformSchema })).toThrowError(
      `Transforms cannot be automatically converted to TypeScript, as we cannot statically determine the type. If you need to use transforms, please use the \`overwriteTsOutput\` option to provide a custom TypeScript output for this schema.

Path:`,
    );
  });

  it('can be worked around using overwriteTsOutput', () => {
    expect(
      printZodAsTs({
        schemas: TransformSchema,
        overwriteTsOutput(schema, factory) {
          if (schema === TransformSchema) {
            return factory.createLiteralTypeNode(
              factory.createNumericLiteral(10),
            );
          }
        },
      }),
    ).toEqual('10');
  });
});
