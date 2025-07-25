import ts from 'typescript';
import type { $ZodType } from 'zod/v4/core';
import { globalRegistry, safeParse } from 'zod/v4/core';
import { zodToTs } from './index.js';
import { ZodToTsOptions } from './zod-to-ts.js';

const { factory: f, SyntaxKind, ScriptKind, ScriptTarget, EmitHint } = ts;

export function maybeIdentifierToTypeReference(
  identifier: ts.Identifier | ts.TypeNode,
) {
  if (ts.isIdentifier(identifier)) {
    return f.createTypeReferenceNode(identifier);
  }

  return identifier;
}

export function createTypeReferenceFromString(identifier: string) {
  return f.createTypeReferenceNode(f.createIdentifier(identifier));
}

export function createUnknownKeywordNode() {
  return f.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

export function createTypeAlias(
  node: ts.TypeNode,
  identifier: string,
  comment?: string,
) {
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
}

export function printNode(node: ts.Node, printerOptions?: ts.PrinterOptions) {
  const sourceFile = ts.createSourceFile(
    'print.ts',
    '',
    ScriptTarget.Latest,
    false,
    ScriptKind.TS,
  );
  const printer = ts.createPrinter(printerOptions);

  return printer.printNode(EmitHint.Unspecified, node, sourceFile);
}

function isArray(value: unknown): value is readonly any[] | any[] {
  return Array.isArray(value);
}

export interface ConvertZodToTsOptions
  extends Omit<ZodToTsOptions, 'identifiers'> {
  /**
   * The list of Zod schemas to convert to TypeScript types.
   *
   * If more than one schema is provided, each schema must have a unique identifier in its
   * metadata, which will be used as the TypeScript type name.
   * You can set the identifier using the `meta` method on the schema.
   *
   * Only schemas that are listed here will be deduplicated and replaced with identifiers,
   * while all other discovered schemas will be inlined in place.
   */
  schemas: $ZodType | readonly $ZodType[];
}

export function convertZodToTs(
  options: ConvertZodToTsOptions,
): readonly ts.Node[] {
  const { schemas, overwriteTsOutput } = options;

  const nodes: ts.Node[] = [];

  if (isArray(schemas)) {
    const zodToTsOptions: Required<ZodToTsOptions> = {
      identifiers: schemas,
      overwriteTsOutput,
    };

    for (const schema of schemas) {
      if (schemas.length > 1 && !getSchemaIdentifier(schema)) {
        throw new Error(
          'When multiple schemas are provided, each schema in the array must have a unique identifier set in its metadata using the `meta` method.',
        );
      }

      nodes.push(zodToTs(schema, zodToTsOptions));
    }
  } else {
    const zodToTsOptions: Required<ZodToTsOptions> = {
      identifiers: [schemas],
      overwriteTsOutput,
    };

    // If a single schema is provided, we do not assign an identifier.
    nodes.push(zodToTs(schemas, zodToTsOptions));
  }

  return nodes;
}

export interface PrintZodAsTsOptions
  extends ConvertZodToTsOptions,
    ts.PrinterOptions {}

export function printZodAsTs({
  schemas,
  overwriteTsOutput,
  ...printerOptions
}: PrintZodAsTsOptions): string {
  const convertZodToTsOptions: Required<ConvertZodToTsOptions> = {
    schemas,
    overwriteTsOutput,
  };

  return convertZodToTs(convertZodToTsOptions)
    .map((node) => printNode(node, printerOptions))
    .join('\n\n');
}

const identifierRE = /^[$A-Z_a-z][\w$]*$/;

export function getIdentifierOrStringLiteral(string_: string) {
  if (identifierRE.test(string_)) {
    return f.createIdentifier(string_);
  }

  return f.createStringLiteral(string_);
}

export function addJsDocComment(node: ts.Node, text: string) {
  ts.addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    `* ${text} `,
    true,
  );
}

export function getSchemaDescription(schema: $ZodType): string | undefined {
  return globalRegistry.get(schema)?.description;
}

export function getSchemaIdentifier(schema: $ZodType): string | undefined {
  const id = globalRegistry.get(schema)?.id;

  if (id) {
    return id;
  }

  const parent = schema._zod.parent;
  if (parent) {
    return getSchemaIdentifier(parent);
  }

  return undefined;
}

export function isSchemaOptional(schema: $ZodType) {
  return safeParse(schema, undefined).success;
}

export function isSchemaNullable(schema: $ZodType) {
  return safeParse(schema, null).success;
}
