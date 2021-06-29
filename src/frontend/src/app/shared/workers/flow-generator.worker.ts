/// <reference lib="webworker" />

import * as sax from 'sax';
import { QualifiedTag } from 'sax';
import { FlowTree } from '../models/flowTree.model';
import { FlowTreeNode } from '../models/flowTreeNode.model';

const saxParser = sax.parser(true);

let attributes: any[] = [];
let closingTag: QualifiedTag | null = null;
let openPipe: string | null = null;

addEventListener('message', ({ data }) => {
  if (typeof data === 'string') {
    const tree: FlowTree = new FlowTree();

    setOpenCallback(tree);
    setAttrCallback(tree);

    saxParser.write(data).close();

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

    // TODO: refactor the if else statement with strategy pattern.
    if (newNode.type === 'Forward' && closingTag) {
      const forwardPipe = tree.pipes.find(
        (pipe: FlowTreeNode) => pipe.name === closingTag?.attributes.name + ''
      );
      forwardPipe?.forwards?.push(newNode);
    } else if (newNode.type.match(/Listener$/g)) {
      newNode.forwards = [];
      newNode.name = String(node.attributes.name);

      tree.listeners.push(newNode);
    } else if (newNode.type.match(/Pipe$/g)) {
      newNode.forwards = [];
      newNode.name = String(node.attributes.name);

      openPipe = String(node.attributes.name);
      tree.pipes.push(newNode);
    } else if (newNode.type === 'Exit') {
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
    const unclosedPipe = tree.pipes.find(
      (pipe: FlowTreeNode) => pipe.name === openPipe
    );
    if (openPipe && unclosedPipe && unclosedPipe.type === name) {
      unclosedPipe.line = saxParser.line + 1;
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
