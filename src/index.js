import fs from 'fs';

import { parse } from '@babel/parser';
import traverse from 'babel-traverse';
import generate from '@babel/generator';
import {
  numericLiteral,
  nullLiteral,
  jsxIdentifier,
  jsxAttribute,
  stringLiteral,
  jsxExpressionContainer,
  jsxOpeningElement,
  jsxClosingElement,
  jsxElement,
  jsxText,
  isImportDeclaration,
  identifier,
  importDeclaration,
  importDefaultSpecifier,
} from '@babel/types';
import _ from 'lodash';

const TAG_DEFAULT_NAME = 'BuriedReport';
const SOURCE_NAME = 'buried-component-report';

// test
// console.log(
//   buriedLoader(
//     '/Users/wukangjun/work/kuhe/geebento_enterprise_order_h5/src/Pages/HomePage/index.tsx',
//     {
//       lineNumer: 122,
//       columnNumber: 8,
//     },
//     {
//       type: 'area',
//       ext: { name: 'hello' },
//     }
//   )
// );

function makeNumberExpression(value) {
  const fileLineLiteral = value ? numericLiteral(value) : nullLiteral();
  return fileLineLiteral;
}

function buildOpeningElementAttributes(inputs) {
  const attributes = [];
  Object.keys(inputs).forEach((key) => {
    const value = inputs[key];
    const id = jsxIdentifier(key);

    if (typeof value === 'string') {
      attributes.push(jsxAttribute(id, stringLiteral(value)));
    } else if (typeof value === 'number') {
      const numberExpression = makeNumberExpression(value);
      attributes.push(
        jsxAttribute(id, jsxExpressionContainer(numberExpression))
      );
    }
  });

  return attributes;
}

/**
 *
 * @param {string} filepath
 * @param {lineNumer: number, columnNumber: number} source
 * @param {type, ext} input
 *
 * @return {string} transform code
 */
export default function buriedLoader(filepath, source, inputs) {
  let content;

  try {
    content = fs.readFileSync(filepath, 'utf-8');
  } catch (error) {
    return error;
  }

  const ast = parse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const visitor = {
    JSXElement(child) {
      const openingElement = child.get('openingElement');
      const location = openingElement.node.loc;

      if (location) {
        const { line, column } = location.start;
        if (
          source &&
          line === source.lineNumer &&
          column === source.columnNumber
        ) {
          const newJsxIdentifier = jsxIdentifier(TAG_DEFAULT_NAME);
          const newJsxOpeningElement = jsxOpeningElement(
            newJsxIdentifier,
            buildOpeningElementAttributes(inputs)
          );
          const newJsxCloseingElement = jsxClosingElement(
            jsxIdentifier(TAG_DEFAULT_NAME)
          );

          const newJsxElement = jsxElement(
            newJsxOpeningElement,
            newJsxCloseingElement,
            openingElement.parent.children
          );
          openingElement.parent.children = [
            jsxText('\n '),
            newJsxElement,
            jsxText('\n '),
          ];
        }
      }
    },
    Program: {
      exit(child) {
        const body = child.get('body');
        const sourceExist = body.some(
          (b) => isImportDeclaration(b) && b.node.source.value === SOURCE_NAME
        );
        if (!sourceExist) {
          const localIdentifier = identifier(TAG_DEFAULT_NAME);
          const index = _.findLastIndex(body, (b) => isImportDeclaration(b));
          const declaration = importDeclaration(
            [importDefaultSpecifier(localIdentifier)],
            stringLiteral(SOURCE_NAME)
          );

          _.head(body).parent.body.splice(index + 1, 0, declaration);
        }
      },
    },
  };

  traverse(ast, visitor);

  return generate(ast).code;
}
