import { EMPTY_OBJECT, isNumber } from '@sequelize/utils';
import ts from 'typescript';
import type {
  $ZodArrayDef,
  $ZodEnumDef,
  $ZodLazyDef,
  $ZodLiteralDef,
  $ZodMapDef,
  $ZodNonOptionalDef,
  $ZodNullableDef,
  $ZodObjectDef,
  $ZodOptionalDef,
  $ZodPipeDef,
  $ZodPromiseDef,
  $ZodReadonlyDef,
  $ZodRecordDef,
  $ZodSetDef,
  $ZodTupleDef,
  $ZodType,
  $ZodUnionDef,
} from 'zod/v4/core';
import { util } from 'zod/v4/core';
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
    | ((
        input: $ZodType,
        factory: ts.NodeFactory,
        modifiers: SeenModifiers,
      ) => ts.TypeNode | undefined)
    | undefined;
}

export function zodToNode(schema: $ZodType, options?: ZodToTsOptions): ts.Node {
  const node: ts.TypeNode = zodToTypeNode(schema, options, [], EMPTY_OBJECT);

  const identifier = getSchemaIdentifier(schema);

  if (identifier) {
    return createTypeAlias(node, identifier, getSchemaDescription(schema));
  }

  return node;
}

interface SeenModifiers {
  nonOptional?: boolean;
  nullable?: boolean;
  optional?: boolean;
  readonly?: boolean;
}

export function zodToTypeNode(
  currentSchema: $ZodType,
  options: ZodToTsOptions | undefined,
  /**
   * Used for loop detection.
   */
  path: readonly $ZodType[],
  seenModifiers: SeenModifiers,
): ts.TypeNode {
  if (path.includes(currentSchema)) {
    throw new Error(
      'Circular reference detected in Zod schema. To break the cycle, please assign identifiers to your schemas using the `meta({ id: "MySchema" })` method and add them to the `identifiers` (if using zodToTs) or `schemas` (if using the other methods) option.',
    );
  }

  if (options?.overwriteTsOutput) {
    const customType = options.overwriteTsOutput(
      currentSchema,
      f,
      seenModifiers,
    );

    if (customType) {
      return customType;
    }
  }

  const def = currentSchema._zod.def;

  switch (def.type) {
    case 'string': {
      return f.createKeywordTypeNode(SyntaxKind.StringKeyword);
    }

    case 'int':
    case 'nan':
    case 'number': {
      return f.createKeywordTypeNode(SyntaxKind.NumberKeyword);
    }

    case 'bigint': {
      return f.createKeywordTypeNode(SyntaxKind.BigIntKeyword);
    }

    case 'symbol': {
      return f.createKeywordTypeNode(SyntaxKind.SymbolKeyword);
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

      return zodToTypeOrIdentifierNode(
        subType,
        options,
        [...path, currentSchema],
        seenModifiers,
      );
    }

    case 'literal': {
      // z.literal('hi') -> 'hi'
      const literalDef = def as $ZodLiteralDef<util.Literal>;

      const tsTypes: ts.TypeNode[] = literalDef.values.map((literalValue) => {
        // eslint-disable-next-line no-restricted-syntax
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
              f.createBigIntLiteral(`${literalValue.toString()}n`),
            );
          }

          case 'string': {
            return f.createLiteralTypeNode(f.createStringLiteral(literalValue));
          }

          case 'symbol': {
            return f.createKeywordTypeNode(SyntaxKind.SymbolKeyword);
          }

          case 'object': {
            return f.createLiteralTypeNode(f.createNull());
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

      const members: ts.TypeElement[] = properties.map(([key, nextZodNode]) => {
        const type = zodToTypeOrIdentifierNode(
          nextZodNode,
          options,
          [...path, currentSchema],
          EMPTY_OBJECT,
        );

        const isOptional = isSchemaOptional(nextZodNode);

        const propertySignature = f.createPropertySignature(
          seenModifiers.readonly
            ? [f.createToken(SyntaxKind.ReadonlyKeyword)]
            : undefined,
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

      const type = zodToTypeOrIdentifierNode(
        arrayDef.element,
        options,
        [...path, currentSchema],
        EMPTY_OBJECT,
      );

      const arrayNode = f.createArrayTypeNode(type);

      if (seenModifiers.readonly) {
        return f.createTypeOperatorNode(SyntaxKind.ReadonlyKeyword, arrayNode);
      }

      return arrayNode;
    }

    case 'tuple': {
      const tupleDef = def as $ZodTupleDef;
      const types = tupleDef.items.map((option) =>
        zodToTypeOrIdentifierNode(
          option,
          options,
          [...path, currentSchema],
          EMPTY_OBJECT,
        ),
      );

      const tupleNode = f.createTupleTypeNode(types);

      if (seenModifiers.readonly) {
        return f.createTypeOperatorNode(SyntaxKind.ReadonlyKeyword, tupleNode);
      }

      return tupleNode;
    }

    case 'union': {
      const unionDef = def as $ZodUnionDef;
      const types: ts.TypeNode[] = unionDef.options.map((option) =>
        zodToTypeOrIdentifierNode(
          option,
          options,
          [...path, currentSchema],
          seenModifiers,
        ),
      );

      return f.createUnionTypeNode(types);
    }

    case 'enum': {
      const enumDef = def as $ZodEnumDef;

      const types = util.getEnumValues(enumDef.entries).map((value) => {
        if (isNumber(value)) {
          return f.createLiteralTypeNode(f.createNumericLiteral(value));
        }

        return f.createLiteralTypeNode(f.createStringLiteral(value));
      });

      return f.createUnionTypeNode(types);
    }

    case 'nonoptional': {
      return zodToTypeOrIdentifierNode(
        (def as $ZodNonOptionalDef).innerType,
        options,
        [...path, currentSchema],
        {
          ...seenModifiers,
          nonOptional: !seenModifiers.optional,
        },
      );
    }

    case 'optional': {
      const optionalDef = def as $ZodOptionalDef;

      const innerType = zodToTypeOrIdentifierNode(
        optionalDef.innerType,
        options,
        [...path, currentSchema],
        {
          ...seenModifiers,
          optional: !seenModifiers.nonOptional,
        },
      );

      // only the first top-level optional or non-optional modifier is taken into account. All subsequent ones must be ignored.
      if (!seenModifiers.nonOptional && !seenModifiers.optional) {
        return f.createUnionTypeNode([
          innerType,
          f.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
        ]);
      }

      return innerType;
    }

    case 'readonly': {
      return zodToTypeOrIdentifierNode(
        (def as $ZodReadonlyDef).innerType,
        options,
        [...path, currentSchema],
        {
          ...seenModifiers,
          readonly: true,
        },
      );
    }

    case 'nullable': {
      const nullableDef = def as $ZodNullableDef;

      const innerType = zodToTypeOrIdentifierNode(
        nullableDef.innerType,
        options,
        [...path, currentSchema],
        {
          ...seenModifiers,
          nullable: true,
        },
      );

      // only the first top-level nullable modifier is taken into account. All subsequent ones must be ignored.
      if (!seenModifiers.nullable) {
        return f.createUnionTypeNode([
          innerType,
          f.createLiteralTypeNode(f.createNull()),
        ]);
      }

      return innerType;
    }

    case 'pipe': {
      const pipeDef = def as $ZodPipeDef;

      return zodToTypeOrIdentifierNode(
        pipeDef.in,
        options,
        [...path, currentSchema],
        seenModifiers,
      );
    }

    case 'custom': {
      throw new Error(
        'Custom Zod types cannot be automatically converted to TypeScript. Please use overwriteTsOutput to generate the typings yourself for this schema.',
      );
    }

    case 'record': {
      // z.record(z.string()) -> Record<string, unknown>
      const recordDef = def as $ZodRecordDef;

      const node = f.createTypeReferenceNode(f.createIdentifier('Record'), [
        zodToTypeOrIdentifierNode(
          recordDef.keyType,
          options,
          [...path, currentSchema],
          EMPTY_OBJECT,
        ),
        zodToTypeOrIdentifierNode(
          recordDef.valueType,
          options,
          [...path, currentSchema],
          EMPTY_OBJECT,
        ),
      ]);

      if (seenModifiers.readonly) {
        return f.createTypeReferenceNode(f.createIdentifier('Readonly'), [
          node,
        ]);
      }

      return node;
    }

    case 'map': {
      // z.map(z.string()) -> Map<string>
      const mapDef = def as $ZodMapDef;

      return f.createTypeReferenceNode(
        f.createIdentifier(seenModifiers.readonly ? 'ReadonlyMap' : 'Map'),
        [
          zodToTypeOrIdentifierNode(
            mapDef.keyType,
            options,
            [...path, currentSchema],
            EMPTY_OBJECT,
          ),
          zodToTypeOrIdentifierNode(
            mapDef.valueType,
            options,
            [...path, currentSchema],
            EMPTY_OBJECT,
          ),
        ],
      );
    }

    case 'set': {
      // z.set(z.string()) -> Set<string>
      const setDef = def as $ZodSetDef;

      const type = zodToTypeOrIdentifierNode(
        setDef.valueType,
        options,
        [...path, currentSchema],
        EMPTY_OBJECT,
      );

      return f.createTypeReferenceNode(
        f.createIdentifier(seenModifiers.readonly ? 'ReadonlySet' : 'Set'),
        [type],
      );
    }

    case 'promise': {
      // z.promise(z.string()) -> Promise<string>
      const promiseDef = def as $ZodPromiseDef;

      const type = zodToTypeOrIdentifierNode(
        promiseDef.innerType,
        options,
        [...path, currentSchema],
        EMPTY_OBJECT,
      );

      return f.createTypeReferenceNode(f.createIdentifier('Promise'), [type]);
    }

    case 'file': {
      throw new Error('Not implemented yet: "file" case');
    }

    case 'intersection': {
      throw new Error('Not implemented yet: "intersection" case');
    }

    case 'success': {
      throw new Error('Not implemented yet: "success" case');
    }

    case 'transform': {
      throw new Error('Not implemented yet: "transform" case');
    }

    case 'default': {
      throw new Error('Not implemented yet: "default" case');
    }

    case 'prefault': {
      throw new Error('Not implemented yet: "prefault" case');
    }

    case 'catch': {
      throw new Error('Not implemented yet: "catch" case');
    }

    case 'template_literal': {
      throw new Error('Not implemented yet: "template_literal" case');
    }
  }
}

export function zodToTypeOrIdentifierNode(
  currentSchema: $ZodType,
  options: ZodToTsOptions | undefined,
  /**
   * Used for loop detection.
   */
  path: readonly $ZodType[],
  seenModifiers: SeenModifiers,
) {
  if (options?.identifiers) {
    const id = getSchemaIdentifier(currentSchema);

    if (
      id &&
      options.identifiers.some(
        (identifier) => getSchemaIdentifier(identifier) === id,
      )
    ) {
      return createTypeReferenceFromString(id);
    }
  }

  return zodToTypeNode(currentSchema, options, path, seenModifiers);
}
