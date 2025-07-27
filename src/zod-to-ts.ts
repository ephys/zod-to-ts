import {
  EMPTY_ARRAY,
  EMPTY_OBJECT,
  isAnyObject,
  isNumber,
  isString,
} from '@sequelize/utils';
import ts from 'typescript';
import type {
  $ZodArrayDef,
  $ZodCatchDef,
  $ZodDefaultDef,
  $ZodEnumDef,
  $ZodIntersectionDef,
  $ZodLazyDef,
  $ZodLiteralDef,
  $ZodMapDef,
  $ZodNonOptionalDef,
  $ZodNullableDef,
  $ZodObjectDef,
  $ZodOptionalDef,
  $ZodPipeDef,
  $ZodPrefaultDef,
  $ZodPromiseDef,
  $ZodReadonlyDef,
  $ZodRecordDef,
  $ZodSetDef,
  $ZodSuccessDef,
  $ZodTemplateLiteralDef,
  $ZodTupleDef,
  $ZodType,
  $ZodUnionDef,
} from 'zod/v4/core';
import { globalRegistry, util } from 'zod/v4/core';
import type { TsZodRegistry } from './utils.js';
import {
  addJsDocComment,
  createTypeReferenceFromString,
  createUnknownKeywordNode,
  getIdentifierOrStringLiteral,
  getReadablePath,
  getSchemaDescription,
  getSchemaIdentifier,
  isSchemaOptional,
} from './utils.js';

const { factory: f, SyntaxKind } = ts;

export interface ZodToTsOptions {
  /**
   * Whether the node should be exported. Requires an identifier to be set on the schema.
   */
  export?: boolean;

  /**
   * The list of other Zod schemas that should be replaced by identifiers instead of inlining their typing.
   *
   * Never applies to the main schema being printed.
   */
  identifiers?: readonly $ZodType[] | undefined;

  /**
   * Can be used to overwrite the default TypeScript output for a Zod schema.
   * This is useful for custom Zod schemas that cannot be automatically converted to TypeScript (such as `z.instanceOf`).
   *
   * You can also return another schema to replace the current one.
   * This is useful when using `z.transform`, as you can return a schema that represents the transformed type.
   *
   * Return `undefined` to use the default output.
   */
  overwriteTsOutput?:
    | ((
        input: $ZodType,
        factory: ts.NodeFactory,
        modifiers: SeenModifiers,
      ) => ts.TypeNode | $ZodType | undefined)
    | undefined;

  /**
   * The registry that contains metadata for Zod schemas.
   * Defaults to the global registry.
   */
  registry?: TsZodRegistry | undefined;

  /**
   * Used to sort the keys of object schemas.
   */
  sortKeys: ((this: void, a: string, b: string) => number) | undefined;
}

export function zodToNode(schema: $ZodType, options?: ZodToTsOptions): ts.Node {
  const node: ts.TypeNode = zodToTypeNode(
    schema,
    options,
    EMPTY_ARRAY,
    [getReadablePath('#root', schema, options?.registry)],
    EMPTY_OBJECT,
  );

  const identifier = getSchemaIdentifier(
    schema,
    options?.registry ?? globalRegistry,
  );

  if (options?.export && !identifier) {
    throw new Error(
      'Cannot export a Zod schema without an identifier. Please set an identifier using the `meta({ id: "MySchema" })` method on the schema.',
    );
  }

  if (identifier) {
    const description = getSchemaDescription(
      schema,
      options?.registry ?? globalRegistry,
    );

    const typeAlias = f.createTypeAliasDeclaration(
      options?.export
        ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
        : undefined,
      f.createIdentifier(identifier),
      undefined,
      node,
    );

    if (description) {
      addJsDocComment(typeAlias, description);
    }

    return typeAlias;
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
  readablePath: readonly string[],
  seenModifiers: SeenModifiers,
): ts.TypeNode {
  if (path.includes(currentSchema)) {
    throw new Error(
      `Circular reference detected in Zod schema. To break the cycle, please assign identifiers to your schemas using the \`meta({ id: "MySchema" })\` method and add them to the \`identifiers\` (if using zodToTs) or \`schemas\` (if using the other methods) option.

Path: ${readablePath.join(' → ')}`,
    );
  }

  if (options?.overwriteTsOutput) {
    const customType = options.overwriteTsOutput(
      currentSchema,
      f,
      seenModifiers,
    );

    if (customType) {
      // If the custom type is a Zod schema, we need to convert it to a TypeScript node.
      if ('_zod' in customType) {
        return zodToTypeOrIdentifierNode(
          customType,
          options,
          [...path, currentSchema],
          readablePath,
          seenModifiers,
        );
      }

      // TypeScript node, return it directly.
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
        readablePath,
        seenModifiers,
      );
    }

    case 'literal': {
      // z.literal('hi') -> 'hi'
      const literalDef = def as $ZodLiteralDef<util.Literal>;

      const tsTypes: ts.TypeNode[] =
        literalDef.values.map(getPrimitiveTypeNode);

      if (tsTypes.length > 1) {
        return f.createUnionTypeNode(tsTypes);
      }

      return tsTypes[0];
    }

    case 'object': {
      // z.object({ name: z.string() }) -> { name: string }
      const objectDef = def as $ZodObjectDef;

      const properties = Object.entries(objectDef.shape);
      if (options?.sortKeys) {
        properties.sort(([a], [b]) => options.sortKeys!(a, b));
      }

      const members: ts.TypeElement[] = properties.map(([key, nextZodNode]) => {
        const type = zodToTypeOrIdentifierNode(
          nextZodNode,
          options,
          [...path, currentSchema],
          [
            ...readablePath,
            getReadablePath(key, nextZodNode, options?.registry),
          ],
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
          : getSchemaDescription(
              nextZodNode,
              options?.registry ?? globalRegistry,
            );

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
        [
          ...readablePath,
          getReadablePath('#element', arrayDef.element, options?.registry),
        ],
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
      const types = tupleDef.items.map((option, i) =>
        zodToTypeOrIdentifierNode(
          option,
          options,
          [...path, currentSchema],
          [
            ...readablePath,
            getReadablePath(`#option-${i}`, option, options?.registry),
          ],
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
      const types: ts.TypeNode[] = unionDef.options.map((option, i) =>
        zodToTypeOrIdentifierNode(
          option,
          options,
          [...path, currentSchema],
          [
            ...readablePath,
            getReadablePath(`#option-${i}`, option, options?.registry),
          ],
          seenModifiers,
        ),
      );

      return f.createUnionTypeNode(types);
    }

    case 'intersection': {
      const interDef = def as $ZodIntersectionDef;

      return f.createIntersectionTypeNode([
        zodToTypeOrIdentifierNode(
          interDef.left,
          options,
          [...path, currentSchema],
          [
            ...readablePath,
            getReadablePath('#left', interDef.left, options?.registry),
          ],
          seenModifiers,
        ),
        zodToTypeOrIdentifierNode(
          interDef.right,
          options,
          [...path, currentSchema],
          [
            ...readablePath,
            getReadablePath('#right', interDef.right, options?.registry),
          ],
          seenModifiers,
        ),
      ]);
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
        readablePath,
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
        readablePath,
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
        readablePath,
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
        readablePath,
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
        pipeDef.out,
        options,
        [...path, currentSchema],
        readablePath,
        seenModifiers,
      );
    }

    case 'custom': {
      throw new Error(
        `Custom Zod types cannot be automatically converted to TypeScript. Please use overwriteTsOutput to generate the typings yourself for this schema.

Path: ${readablePath.join(' → ')}`,
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
          [
            ...readablePath,
            getReadablePath('#key', recordDef.keyType, options?.registry),
          ],
          EMPTY_OBJECT,
        ),
        zodToTypeOrIdentifierNode(
          recordDef.valueType,
          options,
          [...path, currentSchema],
          [
            ...readablePath,
            getReadablePath('#value', recordDef.valueType, options?.registry),
          ],
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

    case 'file': {
      return f.createTypeReferenceNode(f.createIdentifier('File'));
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
            [
              ...readablePath,
              getReadablePath('#key', mapDef.keyType, options?.registry),
            ],
            EMPTY_OBJECT,
          ),
          zodToTypeOrIdentifierNode(
            mapDef.valueType,
            options,
            [...path, currentSchema],
            [
              ...readablePath,
              getReadablePath('#value', mapDef.valueType, options?.registry),
            ],
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
        [
          ...readablePath,
          getReadablePath('#value', setDef.valueType, options?.registry),
        ],
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
        [
          ...readablePath,
          getReadablePath(
            '#innerType',
            promiseDef.innerType,
            options?.registry,
          ),
        ],
        EMPTY_OBJECT,
      );

      return f.createTypeReferenceNode(f.createIdentifier('Promise'), [type]);
    }

    case 'template_literal': {
      const templateDef = def as $ZodTemplateLiteralDef;
      if (templateDef.parts.length === 0) {
        return f.createKeywordTypeNode(SyntaxKind.NeverKeyword);
      }

      const [headPart, ...middleParts] = normalizeTemplateParts(
        templateDef.parts,
      );

      const head: ts.TemplateHead = f.createTemplateHead(headPart as string);
      const spans: ts.TemplateLiteralTypeSpan[] = [];

      for (let i = 0; i < middleParts.length; i += 2) {
        const part = middleParts[i];

        const typeNode =
          isAnyObject(part) && '_zod' in part
            ? zodToTypeOrIdentifierNode(
                part,
                options,
                [...path, currentSchema],
                [
                  ...readablePath,
                  getReadablePath(`#part`, part, options?.registry),
                ],
                EMPTY_OBJECT,
              )
            : getPrimitiveTypeNode(part);

        spans.push(
          f.createTemplateLiteralTypeSpan(
            typeNode,
            i === middleParts.length - 2
              ? f.createTemplateTail(middleParts[i + 1] as string)
              : f.createTemplateMiddle(middleParts[i + 1] as string),
          ),
        );
      }

      return f.createTemplateLiteralType(head, spans);
    }

    case 'transform': {
      throw new Error(
        `Transforms cannot be automatically converted to TypeScript, as we cannot statically determine the type. If you need to use transforms, please use the \`overwriteTsOutput\` option to provide a custom TypeScript output for this schema.

Path: ${readablePath.join(' → ')}`,
      );
    }

    case 'default': {
      // no-op
      const defaultDef = def as $ZodDefaultDef;

      return zodToTypeOrIdentifierNode(
        defaultDef.innerType,
        options,
        [...path, currentSchema],
        readablePath,
        seenModifiers,
      );
    }

    case 'prefault': {
      // no-op
      const prefaultDef = def as $ZodPrefaultDef;

      return zodToTypeOrIdentifierNode(
        prefaultDef.innerType,
        options,
        [...path, currentSchema],
        readablePath,
        seenModifiers,
      );
    }

    case 'success': {
      // no-op
      const catchDef = def as $ZodSuccessDef;

      return zodToTypeOrIdentifierNode(
        catchDef.innerType,
        options,
        [...path, currentSchema],
        readablePath,
        seenModifiers,
      );
    }

    case 'catch': {
      // no-op
      const catchDef = def as $ZodCatchDef;

      return zodToTypeOrIdentifierNode(
        catchDef.innerType,
        options,
        [...path, currentSchema],
        readablePath,
        seenModifiers,
      );
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
  readablePath: readonly string[],
  seenModifiers: SeenModifiers,
) {
  if (options?.identifiers) {
    const id = getSchemaIdentifier(
      currentSchema,
      options.registry ?? globalRegistry,
    );

    if (
      id &&
      options.identifiers.some(
        (identifier) =>
          getSchemaIdentifier(
            identifier,
            options.registry ?? globalRegistry,
          ) === id,
      )
    ) {
      return createTypeReferenceFromString(id);
    }
  }

  return zodToTypeNode(
    currentSchema,
    options,
    path,
    readablePath,
    seenModifiers,
  );
}

/**
 * Creating a TS template literal is a bit tricky.
 * To simplify, we first normalize the template parts
 * by combining subsequent string parts together
 * and ensuring that there is a string part
 * before and after each Zod schema part.
 *
 * We also need the resulting array to start and end with a string part.
 */
function normalizeTemplateParts<T>(parts: T[]): Array<T | string> {
  const result: Array<T | string> = [];
  let buffer = '';

  for (const part of parts) {
    if (isString(part)) {
      buffer += part;
    } else {
      if (buffer) {
        result.push(buffer);
        buffer = '';
      }

      if (result.length > 0 && !isString(result.at(-1))) {
        result.push('');
      }

      result.push(part);
    }
  }

  if (buffer) {
    result.push(buffer);
  }

  if (!isString(result[0])) {
    result.unshift('');
  }

  if (!isString(result.at(-1))) {
    result.push('');
  }

  return result;
}

function getPrimitiveTypeNode(value: util.Primitive) {
  // eslint-disable-next-line no-restricted-syntax
  switch (typeof value) {
    case 'number': {
      return f.createLiteralTypeNode(f.createNumericLiteral(value));
    }

    case 'boolean': {
      return f.createLiteralTypeNode(value ? f.createTrue() : f.createFalse());
    }

    case 'bigint': {
      return f.createLiteralTypeNode(
        f.createBigIntLiteral(`${value.toString()}n`),
      );
    }

    case 'string': {
      return f.createLiteralTypeNode(f.createStringLiteral(value));
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
}
