# zod-to-ts

generate TypeScript types from your [Zod](https://github.com/colinhacks/zod) schema

## Installation

```
npm install @ephys/zod-to-ts zod@^4 typescript
```

## `printZodAsTs`

`printZodAsTs` is used to generate the TypeScript types from your Zod schemas, as a string.

```ts
import { z } from 'zod';
import { printZodAsTs } from '@ephys/zod-to-ts';

// define your Zod schema
const UserSchema = z.object({
  username: z.string(),
  age: z.number(),
});

// pass schema and name of type/identifier
const typings = printZodAsTs({ schemas: [UserSchema] });
```

result:

```ts
{
  username: string;
  age: number;
}
```

---

If [you specify an identifier](https://zod.dev/metadata?id=meta), it will be used as the type name:

```ts
import { z } from 'zod';
import { printZodAsTs } from '@ephys/zod-to-ts';

// define your Zod schema
const UserSchema = z
  .object({
    username: z.string(),
    age: z.number(),
  })
  .meta({ id: 'User' });

// pass schema and name of type/identifier
const typings = printZodAsTs({ schemas: [UserSchema] });
```

result:

```ts
type User = {
  username: string;
  age: number;
};
```

---

You can specify multiple schemas at once. In this case, you must specify the identifiers for each schema in the array:

```ts
import { z } from 'zod';
import { printZodAsTs } from '@ephys/zod-to-ts';

const UserSchema = z
  .object({
    username: z.string(),
    age: z.number(),
  })
  .meta({ id: 'User' });

const PostSchema = z
  .object({
    title: z.string(),
    content: z.string(),
    author: UserSchema,
  })
  .meta({ id: 'Post' });

const typings = printZodAsTs({
  schemas: [UserSchema, PostSchema],
});
```

result:

```ts
type User = {
  username: string;
  age: number;
};

type Post = {
  title: string;
  content: string;
  author: User;
};
```

### Overriding Types

If you want to replace the generated TypeScript type with a custom one, you can use the `overwriteTsOutput` option.

```ts
import { z } from 'zod';
import { printZodAsTs } from '@ephys/zod-to-ts';

const DateSchema = z.instanceof(Date);

const UserSchema = z
  .object({
    username: z.string(),
    bornAt: DateSchema,
  })
  .meta({ id: 'User' });

const typings = printZodAsTs({
  schemas: [UserSchema],
  overwriteTsOutput(zodType, factory, modifiers) {
    if (schema === DateSchema) {
      return factory.createTypeReferenceNode('Date', undefined);
    }

    // if you do not return anything, the default behavior will be used
  },
});
```

Result:

```ts
type User = {
  username: string;
  bornAt: Date;
};
```

You can also return another schema, which will be the one converted to TypeScript:

```ts
import { z } from 'zod';
import { printZodAsTs } from '@ephys/zod-to-ts';

const Name = z.string();
const UpperCaseName = Name.transform((name) => name.toUpperCase());

const UserSchema = z
  .object({
    username: UpperCaseName,
  })
  .meta({ id: 'User' });

const typings = printZodAsTs({
  schemas: [UserSchema],
  overwriteTsOutput(zodType, factory, modifiers) {
    // transforms cannot be converted to TypeScript types directly,
    // so we can return the original schema to be converted instead
    if (schema === UpperCaseName) {
      return Name;
    }

    // if you do not return anything, the default schema will be used
  },
});
```

Result:

```ts
type User = {
  username: string;
};
```

Some zod types cannot be converted to TypeScript types directly, such as `z.instanceof(Date)`.

[TypeScript AST Viewer](https://ts-ast-viewer.com/) can help a lot with this if you are having trouble referencing something. It even provides copy-pastable code!

### Circular References

If you have circular references in your Zod schemas, you must break the loop by adding the schemas that are part of the cycle to the `schemas` array and name them.

This won't work. It will throw an error because "UserSchema" will not be deduplicated:

```ts
import { z } from 'zod';
import { printZodAsTs } from '@ephys/zod-to-ts';

const UserSchema = z.object({
  username: z.string(),
  friends: z.array(z.lazy(() => UserSchema)), // circular reference
});

const FamilySchema = z.object({
  familyName: z.string(),
  members: z.array(UserSchema),
});

const typings = printZodAsTs({
  schemas: [FamilySchema],
});
```

But this will work:

```ts
import { z } from 'zod';
import { printZodAsTs } from '@ephys/zod-to-ts';

const UserSchema = z
  .object({
    username: z.string(),
    friends: z.array(z.lazy(() => UserSchema)), // circular reference
  })
  .meta({ id: 'User' });

const FamilySchema = z
  .object({
    familyName: z.string(),
    members: z.array(UserSchema),
  })
  .meta({ id: 'Family' });

const typings = printZodAsTs({
  schemas: [FamilySchema, UserSchema],
});
```

result:

```ts
type User = {
  username: string;
  friends: User[]; // circular reference
};

type Family = {
  familyName: string;
  members: User[];
};
```

## `convertZodToTs` and `printNode`

If you want to convert Zod schemas to TypeScript AST nodes instead of strings, you can use `convertZodToTs`.
You can then use `printNode` to convert the AST nodes to strings.
