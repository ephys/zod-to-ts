import ts from 'typescript';
import {
  $ZodArrayDef,
  $ZodEnumDef,
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
  // TODO: output as type vs interface

  /**
   * The list of other Zod schemas that should be replaced by identifiers instead of inlining their typing.
   *
   * Never applies to the main schema being printed.
   */
  identifiers?: readonly $ZodType[] | undefined;
}

export function zodToTs(schema: $ZodType, options?: ZodToTsOptions): ts.Node {
  let node: ts.TypeNode = zodToTsNode(schema, schema, options);

  const identifier = getSchemaIdentifier(schema);

  if (identifier) {
    return createTypeAlias(node, identifier, getSchemaDescription(schema));
  }

  return node;
}

function zodToTsNode(
  root: $ZodType,
  currentSchema: $ZodType,
  options: ZodToTsOptions | undefined,
): ts.TypeNode {
  if (currentSchema !== root && options?.identifiers) {
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
      // it is impossible to determine what the lazy value is referring to
      // so we force the user to declare it
      // if (!getTypeType) {
      //   return createTypeReferenceFromString(identifier);
      // }

      break;
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

        const type = zodToTsNode(root, nextZodNode, options);

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

      const type = zodToTsNode(root, arrayDef.element, options);

      return f.createArrayTypeNode(type);
    }

    case 'union': {
      const unionDef = def as $ZodUnionDef;
      const types: ts.TypeNode[] = unionDef.options.map((option) =>
        zodToTsNode(root, option, options),
      );

      return f.createUnionTypeNode(types);
    }

    // case 'ZodEffects': {
    // 	// ignore any effects, they won't factor into the types
    // 	const node = zodToTsNode(zod.def.schema, ...otherArguments) as ts.TypeNode
    // 	return node
    // }

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

      const innerType = zodToTsNode(root, optionalDef.innerType, options);

      return f.createUnionTypeNode([
        innerType,
        f.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
      ]);
    }

    case 'nullable': {
      const nullableDef = def as $ZodNullableDef;

      const innerType = zodToTsNode(root, nullableDef.innerType, options);

      return f.createUnionTypeNode([
        innerType,
        f.createLiteralTypeNode(f.createNull()),
      ]);
    }

    case 'tuple': {
      const tupleDef = def as $ZodTupleDef;
      const types = tupleDef.items.map((option) =>
        zodToTsNode(root, option, options),
      );

      return f.createTupleTypeNode(types);
    }
    //
    // 	case 'record': {
    // 		// z.record(z.number()) -> { [x: string]: number }
    // 		const valueType = zodToTsNode(zod.def.valueType, ...otherArguments)
    //
    // 		const node = f.createTypeLiteralNode([f.createIndexSignature(
    // 			undefined,
    // 			[f.createParameterDeclaration(
    // 				undefined,
    // 				undefined,
    // 				f.createIdentifier('x'),
    // 				undefined,
    // 				f.createKeywordTypeNode(SyntaxKind.StringKeyword),
    // 			)],
    // 			valueType,
    // 		)])
    //
    // 		return node
    // 	}
    //
    // 	case 'map': {
    // 		// z.map(z.string()) -> Map<string>
    // 		const valueType = zodToTsNode(zod.def.valueType, ...otherArguments)
    // 		const keyType = zodToTsNode(zod.def.keyType, ...otherArguments)
    //
    // 		const node = f.createTypeReferenceNode(
    // 			f.createIdentifier('Map'),
    // 			[
    // 				keyType,
    // 				valueType,
    // 			],
    // 		)
    //
    // 		return node
    // 	}
    //
    // 	case 'set': {
    // 		// z.set(z.string()) -> Set<string>
    // 		const type = zodToTsNode(zod.def.valueType, ...otherArguments)
    //
    // 		const node = f.createTypeReferenceNode(
    // 			f.createIdentifier('Set'),
    // 			[type],
    // 		)
    // 		return node
    // 	}
    //
    // 	case 'intersection': {
    // 		// z.number().and(z.string()) -> number & string
    // 		const left = zodToTsNode(zod.def.left, ...otherArguments)
    // 		const right = zodToTsNode(zod.def.right, ...otherArguments)
    // 		const node = f.createIntersectionTypeNode([left, right])
    // 		return node
    // 	}
    //
    // 	case 'promise': {
    // 		// z.promise(z.string()) -> Promise<string>
    // 		const type = zodToTsNode(zod.def.type, ...otherArguments)
    //
    // 		const node = f.createTypeReferenceNode(
    // 			f.createIdentifier('Promise'),
    // 			[type],
    // 		)
    //
    // 		return node
    // 	}
    //
    // 	case 'default': {
    // 		// z.string().optional().default('hi') -> string
    // 		const type = zodToTsNode(zod.def.innerType, ...otherArguments) as ts.TypeNode
    //
    // 		const filteredNodes: ts.Node[] = []
    //
    // 		type.forEachChild((node) => {
    // 			if (!([SyntaxKind.UndefinedKeyword].includes(node.kind))) {
    // 				filteredNodes.push(node)
    // 			}
    // 		})
    //
    // 		// @ts-expect-error needed to set children
    // 		type.types = filteredNodes
    //
    // 		return type
    // 	}

    case 'pipe': {
      const pipeDef = def as $ZodPipeDef;

      return zodToTsNode(root, pipeDef.in, options);
    }
  }

  // !TODO: handle all cases
  throw new Error(`Unsupported Zod type: ${def.type}`);
}
