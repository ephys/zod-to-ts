import ts from 'typescript';
import {
  $ZodArrayDef,
  $ZodEnumDef,
  $ZodLazyDef,
  $ZodLiteralDef,
  $ZodNullableDef,
  $ZodObjectDef,
  $ZodOptionalDef,
  $ZodPipeDef,
  $ZodTupleDef,
  $ZodType,
  $ZodUnionDef,
  util,
} from 'zod/v4/core';
import {
  addJsDocComment,
  createTypeAlias,
  createTypeReferenceFromString,
  createUnknownKeywordNode,
  getIdentifierOrStringLiteral,
  getSchemaDescription,
  getSchemaIdentifier,
  isSchemaOptional,
} from './utils.js';

const { factory: f, SyntaxKind } = ts;

export interface ZodToTsOptions {
  /**
   * The list of other Zod schemas that should be replaced by identifiers instead of inlining their typing.
   *
   * Never applies to the main schema being printed.
   */
  identifiers?: readonly $ZodType[] | undefined;

  /**
   * Can be used to overwrite the default TypeScript output for a Zod schema.
   * Return `undefined` to use the default output.
   */
  overwriteTsOutput?:
    | ((input: $ZodType, factory: ts.NodeFactory) => ts.TypeNode | undefined)
    | undefined;
}

export function zodToTs(schema: $ZodType, options?: ZodToTsOptions): ts.Node {
  let node: ts.TypeNode = zodToTypeNode(schema, options, []);

  const identifier = getSchemaIdentifier(schema);

  if (identifier) {
    return createTypeAlias(node, identifier, getSchemaDescription(schema));
  }

  return node;
}

function zodToTypeNode(
  currentSchema: $ZodType,
  options: ZodToTsOptions | undefined,
  /**
   * Used for loop detection.
   */
  path: readonly $ZodType[],
): ts.TypeNode {
  if (path.includes(currentSchema)) {
    throw new Error(
      'Circular reference detected in Zod schema. To break the cycle, please assign identifiers to your schemas using the `meta({ id: "MySchema" })` method and add them to the `identifiers` (if using zodToTs) or `schemas` (if using the other methods) option.',
    );
  }

  if (options?.overwriteTsOutput) {
    const customType = options.overwriteTsOutput(currentSchema, f);

    if (customType) {
      return customType;
    }
  }

  const def = currentSchema._zod.def;

  switch (def.type) {
    case 'string': {
      return f.createKeywordTypeNode(SyntaxKind.StringKeyword);
    }

    case 'number': {
      return f.createKeywordTypeNode(SyntaxKind.NumberKeyword);
    }

    case 'bigint': {
      return f.createKeywordTypeNode(SyntaxKind.BigIntKeyword);
    }

    case 'boolean': {
      return f.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
    }

    case 'date': {
      return f.createTypeReferenceNode(f.createIdentifier('Date'));
    }

    case 'undefined': {
      return f.createKeywordTypeNode(SyntaxKind.UndefinedKeyword);
    }

    case 'null': {
      return f.createLiteralTypeNode(f.createNull());
    }

    case 'void': {
      return f.createUnionTypeNode([
        f.createKeywordTypeNode(SyntaxKind.VoidKeyword),
        f.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
      ]);
    }

    case 'any': {
      return f.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    }

    case 'unknown': {
      return createUnknownKeywordNode();
    }

    case 'never': {
      return f.createKeywordTypeNode(SyntaxKind.NeverKeyword);
    }

    case 'lazy': {
      const lazyDef = def as $ZodLazyDef;

      const subType = lazyDef.getter();

      return zodToTypeOrIdentifierNode(subType, options, [
        ...path,
        currentSchema,
      ]);
    }

    case 'literal': {
      // z.literal('hi') -> 'hi'
      const literalDef = def as $ZodLiteralDef<util.Literal>;

      const tsTypes: ts.TypeNode[] = literalDef.values.map((literalValue) => {
        switch (typeof literalValue) {
          case 'number': {
            return f.createLiteralTypeNode(
              f.createNumericLiteral(literalValue),
            );
          }

          case 'boolean': {
            return f.createLiteralTypeNode(
              literalValue ? f.createTrue() : f.createFalse(),
            );
          }

          case 'bigint': {
            return f.createLiteralTypeNode(
              f.createBigIntLiteral(literalValue.toString() + 'n'),
            );
          }

          case 'string': {
            return f.createLiteralTypeNode(f.createStringLiteral(literalValue));
          }

          case 'symbol': {
            return f.createKeywordTypeNode(SyntaxKind.SymbolKeyword);
          }

          case 'object': {
            if (literalValue === null) {
              return f.createLiteralTypeNode(f.createNull());
            }

            return createUnknownKeywordNode();
          }

          case 'undefined': {
            return f.createKeywordTypeNode(SyntaxKind.UndefinedKeyword);
          }

          default: {
            return createUnknownKeywordNode();
          }
        }
      });

      if (tsTypes.length > 1) {
        return f.createUnionTypeNode(tsTypes);
      }

      return tsTypes[0];
    }

    case 'object': {
      // z.object({ name: z.string() }) -> { name: string }
      const objectDef = def as $ZodObjectDef;

      const properties = Object.entries(objectDef.shape);

      const members: ts.TypeElement[] = properties.map(([key, value]) => {
        const nextZodNode = value as $ZodType;

        const type = zodToTypeOrIdentifierNode(nextZodNode, options, [
          ...path,
          currentSchema,
        ]);

        const { type: nextZodNodeTypeName } = nextZodNode._zod.def;
        const isOptional =
          nextZodNodeTypeName === 'optional' || isSchemaOptional(nextZodNode);

        const propertySignature = f.createPropertySignature(
          undefined,
          getIdentifierOrStringLiteral(key),
          isOptional ? f.createToken(SyntaxKind.QuestionToken) : undefined,
          type,
        );

        /**
         * No need to duplicate the description if it will already be outputted
         * on the identifier.
         */
        const description = options?.identifiers?.includes(nextZodNode)
          ? undefined
          : getSchemaDescription(nextZodNode);

        if (description) {
          addJsDocComment(propertySignature, description);
        }

        return propertySignature;
      });

      return f.createTypeLiteralNode(members);
    }

    case 'array': {
      const arrayDef = def as $ZodArrayDef;

      const type = zodToTypeOrIdentifierNode(arrayDef.element, options, [
        ...path,
        currentSchema,
      ]);

      return f.createArrayTypeNode(type);
    }

    case 'union': {
      const unionDef = def as $ZodUnionDef;
      const types: ts.TypeNode[] = unionDef.options.map((option) =>
        zodToTypeOrIdentifierNode(option, options, [...path, currentSchema]),
      );

      return f.createUnionTypeNode(types);
    }

    case 'enum': {
      const enumDef = def as $ZodEnumDef;

      const types = util.getEnumValues(enumDef.entries).map((value) => {
        if (typeof value === 'number') {
          return f.createLiteralTypeNode(f.createNumericLiteral(value));
        }

        return f.createLiteralTypeNode(f.createStringLiteral(value));
      });

      return f.createUnionTypeNode(types);
    }

    case 'optional': {
      const optionalDef = def as $ZodOptionalDef;

      const innerType = zodToTypeOrIdentifierNode(
        optionalDef.innerType,
        options,
        [...path, currentSchema],
      );

      return f.createUnionTypeNode([
        innerType,
        f.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
      ]);
    }

    case 'nullable': {
      const nullableDef = def as $ZodNullableDef;

      const innerType = zodToTypeOrIdentifierNode(
        nullableDef.innerType,
        options,
        [...path, currentSchema],
      );

      return f.createUnionTypeNode([
        innerType,
        f.createLiteralTypeNode(f.createNull()),
      ]);
    }

    case 'tuple': {
      const tupleDef = def as $ZodTupleDef;
      const types = tupleDef.items.map((option) =>
        zodToTypeOrIdentifierNode(option, options, [...path, currentSchema]),
      );

      return f.createTupleTypeNode(types);
    }

    case 'pipe': {
      const pipeDef = def as $ZodPipeDef;

      return zodToTypeOrIdentifierNode(pipeDef.in, options, [
        ...path,
        currentSchema,
      ]);
    }

    case 'custom': {
      throw new Error(
        'Custom Zod types cannot be automatically converted to TypeScript. Please use overwriteTsOutput to generate the typings yourself for this schema.',
      );
    }
  }

  throw new Error(`Unsupported Zod type: ${def.type}`);
}

function zodToTypeOrIdentifierNode(
  currentSchema: $ZodType,
  options: ZodToTsOptions | undefined,
  /**
   * Used for loop detection.
   */
  path: readonly $ZodType[],
) {
  if (options?.identifiers) {
    const id = getSchemaIdentifier(currentSchema);

    if (
      id &&
      options.identifiers.find(
        (identifier) => getSchemaIdentifier(identifier) === id,
      )
    ) {
      return createTypeReferenceFromString(id);
    }
  }

  return zodToTypeNode(currentSchema, options, path);
}
