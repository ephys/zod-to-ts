import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { printZodAsTs } from '../src/index.js';

type User = {
  mother: User;
};

describe('z.lazy() referencing root type', () => {
  it('outputs correct typescript', () => {
    const UserSchema: z.ZodSchema<User> = z
      .object({
        mother: z.lazy(() => UserSchema),
      })
      .meta({ id: 'User' });

    expect(printZodAsTs({ schemas: UserSchema })).toMatchInlineSnapshot(`
			"type User = {
			    mother: User;
			};"
		`);
  });
});
