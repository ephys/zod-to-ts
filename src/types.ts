import type ts from 'typescript';

export interface ZodToTsOptions {
  nativeEnums?: 'identifier' | 'resolve' | 'union' | undefined;
}

export interface ResolvedZodToTsOptions {
  nativeEnums: 'identifier' | 'resolve' | 'union';
}

export const resolveOptions = (
  raw?: ZodToTsOptions,
): ResolvedZodToTsOptions => {
  return {
    ...raw,
    nativeEnums: raw?.nativeEnums ?? 'identifier',
  };
};

export type ZodToTsStore = {
  nativeEnums: ts.EnumDeclaration[];
};

export type ZodToTsReturn = {
  node: ts.TypeNode;
  store: ZodToTsStore;
};

export type GetTypeFunction = (
  typescript: typeof ts,
  identifier: string,
  options: ResolvedZodToTsOptions,
) => ts.Identifier | ts.TypeNode;

export type GetType = { _def: { getType?: GetTypeFunction } };
