import ts from 'typescript';
import type { $ZodType } from 'zod/v4/core';
import { util } from 'zod/v4/core';
import { zodToTs } from './index.js';
import { GetType, GetTypeFunction, ZodToTsOptions } from './types.js';

const { factory: f, SyntaxKind, ScriptKind, ScriptTarget, EmitHint } = ts;

export const maybeIdentifierToTypeReference = (
  identifier: ts.Identifier | ts.TypeNode,
) => {
  if (ts.isIdentifier(identifier)) {
    return f.createTypeReferenceNode(identifier);
  }

  return identifier;
};

export const createTypeReferenceFromString = (identifier: string) =>
  f.createTypeReferenceNode(f.createIdentifier(identifier));

export const createUnknownKeywordNode = () =>
  f.createKeywordTypeNode(SyntaxKind.UnknownKeyword);

export const createTypeAlias = (
  node: ts.TypeNode,
  identifier: string,
  comment?: string,
) => {
  const typeAlias = f.createTypeAliasDeclaration(
    undefined,
    f.createIdentifier(identifier),
    undefined,
    node,
  );

  if (comment) {
    addJsDocComment(typeAlias, comment);
  }

  return typeAlias;
};

export const printNode = (
  node: ts.Node,
  printerOptions?: ts.PrinterOptions,
) => {
  const sourceFile = ts.createSourceFile(
    'print.ts',
    '',
    ScriptTarget.Latest,
    false,
    ScriptKind.TS,
  );
  const printer = ts.createPrinter(printerOptions);

  return printer.printNode(EmitHint.Unspecified, node, sourceFile);
};

interface PrintZodToTsOptions extends ZodToTsOptions, ts.PrinterOptions {
  /**
   * A map of Schema Name -> Zod Schema.
   *
   * The schema name will be used as the identifier.
   *
   * If a single schema is provided, it can be provided as a single Zod schema instead of a record.
   * In that case, it will not be assigned an identifier and will be printed as a type literal.
   */
  schemas: Record<string, $ZodType> | $ZodType;
}

export function convertZodToTs(
  options: PrintZodToTsOptions,
): readonly ts.TypeNode[] {
  const { schemas, nativeEnums, ...printerOptions } = options;

  const nodes: ts.TypeNode[] = [];

  const zodToTsOptions: Required<ZodToTsOptions> = { nativeEnums };

  if (util.isPlainObject(schemas)) {
    for (const schemaIdentifier of Object.keys(schemas)) {
      nodes.push(
        zodToTs(schemas[schemaIdentifier], schemaIdentifier, zodToTsOptions)
          .node,
      );
    }
  } else {
    // If a single schema is provided, we do not assign an identifier.
    nodes.push(zodToTs(schemas, undefined, zodToTsOptions).node);
  }

  return nodes;
}

export function printZodAsTs(options: PrintZodToTsOptions): string {
  return convertZodToTs(options)
    .map((node) => printNode(node, options))
    .join('\n\n');
}

export const withGetType = <T extends $ZodType & GetType>(
  schema: T,
  getType: GetTypeFunction,
): T => {
  schema._def.getType = getType;

  return schema;
};

const identifierRE = /^[$A-Z_a-z][\w$]*$/;

export const getIdentifierOrStringLiteral = (string_: string) => {
  if (identifierRE.test(string_)) {
    return f.createIdentifier(string_);
  }

  return f.createStringLiteral(string_);
};

export const addJsDocComment = (node: ts.Node, text: string) => {
  ts.addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    `* ${text} `,
    true,
  );
};
