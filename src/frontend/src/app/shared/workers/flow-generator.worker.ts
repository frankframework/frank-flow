/// <reference lib="webworker" />

import * as sax from 'sax';
import { QualifiedTag, SAXParser } from 'sax';
import { FlowTree } from '../models/flowTree.model';
import { FlowTreeNode } from '../models/flowTreeNode.model';

let saxParser = sax.parser(true);
let errorMessage = '';

let attributes: any[] = [];
let closingTag: QualifiedTag | null = null;
let openPipe: string | null = null;

addEventListener('message', ({ data }) => {
  if (typeof data === 'string') {
    saxParser = sax.parser(true);
    errorMessage = '';

    const tree: FlowTree = new FlowTree();

    setOpenCallback(tree);
    setAttrCallback(tree);

    try {
      saxParser.write(data).close();
    } catch (e: any) {
      postMessage(errorMessage);
      saxParser.close();
      return;
    }

    postMessage(tree);
  }
});

function setOpenCallback(tree: FlowTree): void {
  saxParser.onopentag = (node: QualifiedTag) => {
    const newNode = new FlowTreeNode(
      saxParser.line + 1,
      saxParser.column + 1,
      node.name,
      attributes
    );

    attributes = [];

    if (!node.isSelfClosing) {
      closingTag = node;
    }
    newNode.attributes.forEach((attr) => {
      if (attr.path) {
        newNode.path = attr.path;
      }
    });

    // TODO: refactor the if else statement with strategy pattern.
    if (newNode.type === 'Forward' && closingTag) {
      tree.pipes[closingTag.attributes.name + ''].forwards.push(newNode);
    } else if (newNode.type.match(/Listener$/g)) {
      newNode.forwards = [];
      newNode.name = String(node.attributes.name);

      tree.listeners.push(newNode);
    } else if (newNode.type.match(/Pipe$/g)) {
      newNode.forwards = [];
      newNode.name = String(node.attributes.name);

      openPipe = String(node.attributes.name);
      tree.pipes[String(node.attributes.name)] = newNode;
    } else if (newNode.type === 'Exit') {
      tree.exits.push(newNode);
    }
  };

  saxParser.onclosetag = (name: string) => {
    if (openPipe && tree.pipes[openPipe].type === name) {
      tree.pipes[openPipe].line = saxParser.line + 1;
      openPipe = null;
    }
  };

  saxParser.onerror = (e: Error) => {
    console.log('error: ', e);
    errorMessage = e.message;
  };
}

function setAttrCallback(tree: any): void {
  saxParser.onattribute = (attr: sax.QualifiedAttribute) => {
    const name = attr.name;
    const value = attr.value;
    const QUOTES = 2;

    const startColumn = saxParser.column - (name + value).length - QUOTES;

    if (name === 'firstPipe') {
      tree.firstPipe = value;
    }

    attributes.push({
      [name]: value,
      line: saxParser.line + 1,
      endColumn: saxParser.column + 1,
      startColumn,
    });
  };
}
