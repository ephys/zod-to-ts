import { z } from 'zod';
import { printNode, withGetType, zodToTs } from '../src/index.js';

const Enum = z.enum({
  ONE: 1,
  TWO: 2,
});

withGetType(Enum, (ts) => ts.factory.createIdentifier('Enum'));

const schema = z.object({
  key: Enum.describe('Comment for key'),
});

const { node } = zodToTs(schema, undefined, { nativeEnums: 'resolve' });
console.log(printNode(node));
// {
//     /** Comment for key */
//     key: unknown;
// }
