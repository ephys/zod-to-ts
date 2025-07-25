import ts from 'typescript';
import type { $ZodRegistry, $ZodType, JSONSchemaMeta } from 'zod/v4/core';
import { globalRegistry, safeParse } from 'zod/v4/core';
import type { ZodToTsOptions } from './zod-to-ts.js';
import { zodToNode } from './zod-to-ts.js';

const { factory: f, SyntaxKind, ScriptKind, ScriptTarget, EmitHint } = ts;

export interface TsSchemaMeta
  extends Pick<JSONSchemaMeta, 'id' | 'description'> {}

export type TsZodRegistry = $ZodRegistry<TsSchemaMeta>;

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
  const { schemas, overwriteTsOutput, registry } = options;

  const nodes: ts.Node[] = [];

  if (isArray(schemas)) {
    const zodToTsOptions: Required<ZodToTsOptions> = {
      identifiers: schemas,
      overwriteTsOutput,
      registry,
    };

    for (const schema of schemas) {
      if (
        schemas.length > 1 &&
        !getSchemaIdentifier(schema, options.registry ?? globalRegistry)
      ) {
        throw new Error(
          'When multiple schemas are provided, each schema in the array must have a unique identifier set in its metadata using the `meta` method.',
        );
      }

      nodes.push(zodToNode(schema, zodToTsOptions));
    }
  } else {
    const zodToTsOptions: Required<ZodToTsOptions> = {
      identifiers: [schemas],
      overwriteTsOutput,
      registry,
    };

    // If a single schema is provided, we do not assign an identifier.
    nodes.push(zodToNode(schemas, zodToTsOptions));
  }

  return nodes;
}

export interface PrintZodAsTsOptions
  extends ConvertZodToTsOptions,
    ts.PrinterOptions {}

export function printZodAsTs({
  schemas,
  registry,
  overwriteTsOutput,
  ...printerOptions
}: PrintZodAsTsOptions): string {
  const convertZodToTsOptions: Required<ConvertZodToTsOptions> = {
    overwriteTsOutput,
    registry,
    schemas,
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

export function getSchemaDescription(
  schema: $ZodType,
  registry: TsZodRegistry,
): string | undefined {
  return registry.get(schema)?.description;
}

export function getSchemaIdentifier(
  schema: $ZodType,
  registry: TsZodRegistry,
): string | undefined {
  const id = registry.get(schema)?.id;

  if (id) {
    return id;
  }

  const parent = schema._zod.parent;
  if (parent) {
    return getSchemaIdentifier(parent, registry);
  }

  return undefined;
}

export function isSchemaOptional(schema: $ZodType) {
  return safeParse(schema, undefined).success;
}

export function isSchemaNullable(schema: $ZodType) {
  return safeParse(schema, null).success;
}
