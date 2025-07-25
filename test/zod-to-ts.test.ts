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
});
