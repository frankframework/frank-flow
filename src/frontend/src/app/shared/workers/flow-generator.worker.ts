/// <reference lib="webworker" />

import * as saxes from 'saxes';
import { AttributeEventForOptions, TagForOptions } from 'saxes';
import { FlowStructure } from '../models/flowStructure.model';
import { FlowStructureNode } from '../models/flowStructureNode.model';

const MONACO_COLUMN_OFFSET = 1;

const parser = new saxes.SaxesParser();

let flowStructure: FlowStructure;
let unclosedPipes: string[] = [];

addEventListener('message', ({ data }) => {
  if (typeof data === 'string') {
    flowStructure = new FlowStructure();
    parser.write(data).close();
  }
});

parser.on('end', () => postMessage(flowStructure));

parser.on('opentag', (tag: TagForOptions<{}>) => {
  const currentNode = new FlowStructureNode(
    parser.line,
    parser.column + MONACO_COLUMN_OFFSET,
    tag.name
  );

  if (currentNode.type.match(/Pipe$/g)) {
    if (!tag.isSelfClosing) {
      unclosedPipes.push(tag.attributes['name']);
    }
    currentNode.forwards = [];
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type === 'Forward') {
    flowStructure.nodes
      .find(
        (pipe: FlowStructureNode) =>
          pipe.name === unclosedPipes[unclosedPipes.length - 1]
      )
      ?.forwards?.push(currentNode);
  } else if (currentNode.type.match(/Listener$/g)) {
    console.log(currentNode);
    flowStructure.nodes.push(currentNode);
    console.log(flowStructure);
  } else if (currentNode.type.match(/Exit$/g)) {
    flowStructure.nodes.push(currentNode);
  }
});

parser.on('closetag', (tag: TagForOptions<{}>) => {
  unclosedPipes.pop();
});

parser.on('attribute', (attribute: AttributeEventForOptions<{}>) => {
  const lastNode = flowStructure.nodes[flowStructure.nodes.length - 1];
  if (!lastNode) {
    return;
  }
  console.log(flowStructure, flowStructure.nodes, flowStructure.nodes.length);

  const startColumn =
    parser.column - (attribute.name + attribute.value).length - 2;

  if (attribute.name === 'firstPipe') {
    flowStructure.firstPipe = attribute.value;
  } else {
    const newAttribute = {
      value: attribute.value,
      line: parser.line,
      endColumn: parser.column + MONACO_COLUMN_OFFSET,
      startColumn,
    };

    lastNode.attributes = {
      ...lastNode.attributes,
      [attribute.name]: newAttribute,
    };

    if (lastNode.type == 'DirectoryListener') {
      console.log(lastNode.attributes);
    }
  }
});
