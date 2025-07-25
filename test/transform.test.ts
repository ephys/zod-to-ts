import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

const TransformSchema = z.string().transform(() => 10);

describe('z.transform()', () => {
  it('is not supported', () => {
    expect(() => printZodAsTs({ schemas: TransformSchema })).toThrowError(
      `Transforms cannot be automatically converted to TypeScript`,
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
