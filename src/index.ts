import ts from 'typescript';
import type {
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
} from 'zod/v4/core';
import { util } from 'zod/v4/core';
import type {
  GetType,
  GetTypeFunction,
  ResolvedZodToTsOptions,
  ZodToTsOptions,
  ZodToTsReturn,
  ZodToTsStore,
} from './types.js';
import { resolveOptions } from './types.js';
import {
  addJsDocComment,
  createTypeReferenceFromString,
  createUnknownKeywordNode,
  getIdentifierOrStringLiteral,
  maybeIdentifierToTypeReference,
} from './utils.js';

const { factory: f, SyntaxKind } = ts;

const callGetType = (
  zod: $ZodType,
  identifier: string,
  options: ResolvedZodToTsOptions,
) => {
  let type: ReturnType<GetTypeFunction> | undefined;

  const getTypeSchema = zod as GetType;
  // this must be called before accessing 'type'
  if (getTypeSchema._def.getType) {
    type = getTypeSchema._def.getType(ts, identifier, options);
  }

  return type;
};

export const zodToTs = (
  zod: $ZodType,
  identifier?: string,
  options?: ZodToTsOptions,
): ZodToTsReturn => {
  const resolvedIdentifier = identifier ?? 'Identifier';

  const resolvedOptions = resolveOptions(options);

  const store: ZodToTsStore = { nativeEnums: [] };

  const node = zodToTsNode(zod, resolvedIdentifier, store, resolvedOptions);

  return { node, store };
};

const zodToTsNode = (
  zod: $ZodType,
  identifier: string,
  store: ZodToTsStore,
  options: ResolvedZodToTsOptions,
): ts.TypeNode => {
  const def = zod._zod.def;

  const getTypeType = callGetType(zod, identifier, options);
  // special case native enum, which needs an identifier node
  if (getTypeType && def.type !== 'enum') {
    return maybeIdentifierToTypeReference(getTypeType);
  }

  const otherArguments = [identifier, store, options] as const;

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
      if (!getTypeType) {
        return createTypeReferenceFromString(identifier);
      }

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
              literalValue === true ? f.createTrue() : f.createFalse(),
            );
          }

          default: {
            return f.createLiteralTypeNode(f.createStringLiteral(literalValue));
          }
        }
      });

      if (tsTypes.length > 1) {
        return f.createUnionTypeNode(tsTypes);
      }

      return tsTypes[0];
    }

    case 'object': {
      const objectDef = def as $ZodObjectDef;

      const properties = Object.entries(objectDef.shape);

      const members: ts.TypeElement[] = properties.map(([key, value]) => {
        const nextZodNode = value as $ZodType;
        const type = zodToTsNode(nextZodNode, ...otherArguments);

        const { type: nextZodNodeTypeName } = nextZodNode._zod.def;
        const isOptional =
          nextZodNodeTypeName === 'optional' || nextZodNode.isOptional();

        const propertySignature = f.createPropertySignature(
          undefined,
          getIdentifierOrStringLiteral(key),
          isOptional ? f.createToken(SyntaxKind.QuestionToken) : undefined,
          type,
        );

        if (nextZodNode.description) {
          addJsDocComment(propertySignature, nextZodNode.description);
        }

        return propertySignature;
      });

      return f.createTypeLiteralNode(members);
    }

    case 'array': {
      const arrayDef = def as $ZodArrayDef;

      const type = zodToTsNode(arrayDef.element, ...otherArguments);

      return f.createArrayTypeNode(type);
    }

    case 'union': {
      const unionDef = def as $ZodUnionDef;
      const types: ts.TypeNode[] = unionDef.options.map((option) =>
        zodToTsNode(option, ...otherArguments),
      );

      return f.createUnionTypeNode(types);
    }

    // 	// case 'ZodEffects': {
    // 	// 	// ignore any effects, they won't factor into the types
    // 	// 	const node = zodToTsNode(zod.def.schema, ...otherArguments) as ts.TypeNode
    // 	// 	return node
    // 	// }

    case 'enum': {
      const enumDef = def as $ZodEnumDef;

      const type = getTypeType;

      if (options.nativeEnums === 'union') {
        // allow overriding with this option
        if (type) {
          return maybeIdentifierToTypeReference(type);
        }

        const types = Object.values(enumDef.entries).map((value) => {
          if (typeof value === 'number') {
            return f.createLiteralTypeNode(f.createNumericLiteral(value));
          }

          return f.createLiteralTypeNode(f.createStringLiteral(value));
        });

        return f.createUnionTypeNode(types);
      }

      // z.nativeEnum(Fruits) -> Fruits
      // can resolve Fruits into store and user can handle enums
      if (!type) {
        return createUnknownKeywordNode();
      }

      if (options.nativeEnums === 'resolve') {
        const enumMembers = Object.entries(
          enumDef.entries as Record<string, string | number>,
        ).map(([key, value]) => {
          const literal =
            typeof value === 'number'
              ? f.createNumericLiteral(value)
              : f.createStringLiteral(value);

          return f.createEnumMember(getIdentifierOrStringLiteral(key), literal);
        });

        if (ts.isIdentifier(type)) {
          store.nativeEnums.push(
            f.createEnumDeclaration(undefined, type, enumMembers),
          );
        } else {
          throw new Error(
            'getType on nativeEnum must return an identifier when nativeEnums is "resolve"',
          );
        }
      }

      return maybeIdentifierToTypeReference(type);
    }

    case 'optional': {
      const optionalDef = def as $ZodOptionalDef;

      const innerType = zodToTsNode(optionalDef.innerType, ...otherArguments);

      return f.createUnionTypeNode([
        innerType,
        f.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
      ]);
    }

    case 'nullable': {
      const nullableDef = def as $ZodNullableDef;

      const innerType = zodToTsNode(nullableDef.innerType, ...otherArguments);

      return f.createUnionTypeNode([
        innerType,
        f.createLiteralTypeNode(f.createNull()),
      ]);
    }

    case 'tuple': {
      const tupleDef = def as $ZodTupleDef;
      const types = tupleDef.items.map((option) =>
        zodToTsNode(option, ...otherArguments),
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

      return zodToTsNode(pipeDef.in, identifier, store, options);
    }
  }

  throw new Error(`Unsupported Zod type: ${def.type}`);
};

export { createTypeAlias, printNode, withGetType } from './utils.js';

export { type GetType, type ZodToTsOptions } from './types.js';
