import { EMPTY_ARRAY } from '@sequelize/utils';
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
  extends Omit<
    ZodToTsOptions,
    'identifiers' | 'export' | 'sortKeys' | 'hiddenIdentifiers'
  > {
  /**
   * Behaves like 'schemas', but they will also be exported as named exports.
   */
  exportedSchemas?: readonly $ZodType[] | undefined;

  /**
   * Behaves like 'schemas', but the schemas will not be included in the output.
   * This is useful when you want to replace a schema with an identifier that is imported from
   * another file instead of duplicating the schema in the output.
   */
  hiddenSchemas?: readonly $ZodType[] | undefined;

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
  schemas?: $ZodType | readonly $ZodType[] | undefined;

  sort?:
    | {
        /**
         * Used to sort the type declarations in the output.
         */
        declarations?:
          | ((this: void, a: string, b: string) => number)
          | undefined;

        /**
         * Used to sort the keys of object schemas.
         */
        keys?: ZodToTsOptions['sortKeys'];
      }
    | undefined;
}

export function convertZodToTs(
  options: ConvertZodToTsOptions,
): readonly ts.Node[] {
  const {
    schemas,
    exportedSchemas = EMPTY_ARRAY,
    hiddenSchemas = EMPTY_ARRAY,
    overwriteTsOutput,
    registry,
  } = options;

  const outputableSchemas = new Set([
    ...(!schemas ? EMPTY_ARRAY : isArray(schemas) ? schemas : [schemas]),
    ...exportedSchemas,
  ]);

  for (const schema of hiddenSchemas) {
    if (outputableSchemas.has(schema)) {
      throw new Error(
        'A schema cannot be both outputable and hidden. Please ensure that schemas in `hiddenSchemas` are not also in `schemas` or `exportedSchemas`.',
      );
    }

    if (!getSchemaIdentifier(schema, registry ?? globalRegistry)) {
      throw new Error(
        'A schema in `hiddenSchemas` must have a unique identifier set in its metadata using the `meta` method.',
      );
    }
  }

  const identifiers = [...new Set([...outputableSchemas, ...hiddenSchemas])];

  const nodes: ts.Node[] = [];

  for (const schema of outputableSchemas) {
    if (
      outputableSchemas.size > 1 &&
      !getSchemaIdentifier(schema, options.registry ?? globalRegistry)
    ) {
      throw new Error(
        'When multiple schemas are provided, each schema in the array must have a unique identifier set in its metadata using the `meta` method.',
      );
    }
  }

  const sortDeclarations = options.sort?.declarations;

  const sortedOutputableSchemas =
    sortDeclarations && outputableSchemas.size > 1
      ? [...outputableSchemas].sort((a, b) =>
          sortDeclarations(
            getSchemaIdentifier(a, options.registry)!,
            getSchemaIdentifier(b, options.registry)!,
          ),
        )
      : outputableSchemas;

  for (const schema of sortedOutputableSchemas) {
    const zodToTsOptions: Required<ZodToTsOptions> = {
      export: exportedSchemas.includes(schema),
      identifiers,
      hiddenIdentifiers: hiddenSchemas,
      overwriteTsOutput,
      registry,
      sortKeys: options.sort?.keys,
    };

    nodes.push(zodToNode(schema, zodToTsOptions));
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
  exportedSchemas,
  hiddenSchemas,
  sort,
  ...printerOptions
}: PrintZodAsTsOptions): string {
  const convertZodToTsOptions: Required<ConvertZodToTsOptions> = {
    exportedSchemas,
    hiddenSchemas,
    overwriteTsOutput,
    registry,
    schemas,
    sort,
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
  registry: TsZodRegistry | undefined,
): string | undefined {
  const id = (registry ?? globalRegistry).get(schema)?.id;

  if (id) {
    return id;
  }

  const parent = schema._zod.parent;
  if (parent) {
    return getSchemaIdentifier(parent, registry);
  }

  return undefined;
}

export function getReadablePath(
  label: string,
  schema: $ZodType,
  registry: TsZodRegistry | undefined,
) {
  // append type and schema identifier if available
  const type = schema._zod.def.type;
  const identifier = getSchemaIdentifier(schema, registry ?? globalRegistry);

  const parts: string[] = [type];
  if (identifier) {
    parts.push(identifier);
  }

  return `${label} (${parts.join(', ')})`;
}

export function isSchemaOptional(schema: $ZodType) {
  return safeParse(schema, undefined).success;
}

export function isSchemaNullable(schema: $ZodType) {
  return safeParse(schema, null).success;
}
