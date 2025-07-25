import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

const DateSchema = z.instanceof(Date);

describe('z.instanceof()', () => {
  it('is not supported', () => {
    expect(() => printZodAsTs({ schemas: DateSchema })).toThrowError(
      `Custom Zod types cannot be automatically converted to TypeScript`,
    );
  });

  it('can be worked around using overwriteTsOutput', () => {
    expect(
      printZodAsTs({
        schemas: z.array(DateSchema),
        overwriteTsOutput(schema, factory) {
          if (schema === DateSchema) {
            return factory.createTypeReferenceNode('Date', undefined);
          }
        },
      }),
    ).toEqual('Date[]');
  });
});
