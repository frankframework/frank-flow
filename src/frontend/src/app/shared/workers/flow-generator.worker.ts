/// <reference lib="webworker" />

import * as sax from 'sax';
import { QualifiedTag, SAXParser } from 'sax';

const saxParser = sax.parser(true);

let attributes: any[] = [];

addEventListener('message', ({ data }) => {
  if (typeof data === 'string') {
    /* 
    
      TODO: 
      Loop over tags and put each name as a JSON  object.
      Loop over attributes and put each attribute with line number and column at the right tag in the JSON.

    */
    const tree: any = {};

    tree.listeners = [];
    tree.pipes = {};
    tree.exits = [];

    setOpenCallback(tree);
    setAttrCallback(tree);

    saxParser.write(data).close();

    postMessage(tree);
  }
});

function setOpenCallback(tree: any): void {
  let closingTag: QualifiedTag | null = null;
  let openPipe: string | null = null;

  saxParser.onopentag = (node: QualifiedTag) => {
    const newNode: {
      line: number;
      column: number;
      type: string;
      name?: string;
      forwards?: any[];
      attributes: any[];
      path?: string;
    } = {
      line: saxParser.line + 1,
      column: saxParser.column + 1,
      type: node.name,
      name: String(node.attributes.name),
      forwards: [],
      attributes,
    };

    attributes = [];

    if (!node.isSelfClosing) {
      closingTag = node;
    }

    if (node.name === 'Forward' && closingTag) {
      delete newNode.forwards;

      tree.pipes[closingTag.attributes.name + ''].forwards.push(newNode);
    } else if (newNode.type.match(/Listener$/g)) {
      delete newNode.forwards;
      delete newNode.path;
      tree.listeners.push(newNode);
    } else if (newNode.type.match(/Pipe$/g)) {
      delete newNode.path;
      openPipe = String(node.attributes.name);
      tree.pipes[String(node.attributes.name)] = newNode;
    } else if (node.name === 'Exit') {
      delete newNode.forwards;
      delete newNode.name;

      newNode.attributes.forEach((attr) => {
        if (attr.path) {
          newNode.path = attr.path;
        }
      });
      tree.exits.push(newNode);
    }
  };

  saxParser.onclosetag = (name: string) => {
    closingTag = null;
    if (openPipe && tree.pipes[openPipe].type === name) {
      tree.pipes[openPipe].line = saxParser.line + 1;
      openPipe = null;
    }
  };
}

function setAttrCallback(tree: any): void {
  saxParser.onattribute = (attr: sax.QualifiedAttribute) => {
    const name = attr.name;
    const value = attr.value;

    const startColumn = saxParser.column - (name + value).length - 2;

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
