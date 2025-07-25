import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

const DateSchema = z.instanceof(Date);

describe('z.instanceof()', () => {
  it('outputs correct typescript', () => {
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
