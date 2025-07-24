import ts from 'typescript';
import { printNode } from '../src/index.js';

export const printNodeTest = (node: ts.Node) =>
  printNode(node, { newLine: ts.NewLineKind.LineFeed });
