/// <reference lib="webworker" />

import { Builder, Parser } from 'xml2js';
import { File } from '../../shared/models/file.model';
import { FileType } from '../../shared/enums/file-type.enum';
import * as sax from 'sax';
import { QualifiedTag, SAXParser } from 'sax';

const saxParser = sax.parser(true);

let attributes: any[] = [];

addEventListener('message', ({ data }) => {
  const file = data as File;

  if (file.type === FileType.XML && file.data) {
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

    saxParser.write(file.data).close();

    postMessage(tree);

    // parser.parseString(file.data, (err: any, result: any) => {
    //   file.type = FileType.JSON;
    //   file.data = result;

    //   if (err) {
    //     console.error(err);
    //   }
    // });
  }
  //  else if (file.type === FileType.JSON && file.data) {
  //   const builder = new Builder();
  //   const xml = builder.buildObject(file.data);

  //   file.data = xml;
  //   file.saved = false;
  //   file.type = FileType.XML;
  // }
});

function setOpenCallback(tree: any): void {
  let closingTag: QualifiedTag | null = null;

  saxParser.onopentag = (node: QualifiedTag) => {
    // console.log(node, saxParser.line);

    const newNode: {
      line: number;
      column: number;
      type: string;
      name?: string;
      forwards?: any[];
      attributes: any[];
    } = {
      line: saxParser.line + 1,
      column: saxParser.column + 1,
      type: node.name,
      name: String(node.attributes.name),
      forwards: [],
      attributes,
    };

    attributes = [];

    // console.log(node.attributes.name);
    if (!node.isSelfClosing) {
      closingTag = node;
    }

    if (node.name === 'Forward' && closingTag) {
      delete newNode.forwards;

      // console.log('CLOSING TAG: ', closingTag)
      tree.pipes[closingTag.attributes.name + ''].forwards.push(newNode);
    } else if (newNode.type.match(/Listener$/g)) {
      delete newNode.forwards;
      tree.listeners.push(newNode);
    } else if (newNode.type.match(/Pipe$/g)) {
      tree.pipes[String(node.attributes.name)] = newNode;
    } else if (node.name === 'Exit') {
      delete newNode.forwards;
      delete newNode.name;
      tree.exits.push(newNode);
    }
  };

  saxParser.onclosetag = (name: string) => {
    // console.log('CLOSE: ', name);
    closingTag = null;
  };
}

function setAttrCallback(tree: any): void {
  let curTag = '';

  saxParser.onattribute = (attr: sax.QualifiedAttribute) => {
    // console.log(attr, attrParser.line, attrParser.column);

    const name = attr.name;
    const value = attr.value;

    const startColumn = saxParser.column - (name + value).length - 2;

    if (name === 'name') {
      curTag = value;
    } else if (name === 'firstPipe') {
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
