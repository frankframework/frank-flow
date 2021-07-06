/// <reference lib="webworker" />

import * as saxes from 'saxes';
import { AttributeEventForOptions, TagForOptions } from 'saxes';
import { FlowNodeAttributes } from '../models/flowNodeAttributes.model';
import { FlowStructure } from '../models/flowStructure.model';
import { FlowStructureNode } from '../models/flowStructureNode.model';

const MONACO_COLUMN_OFFSET = 1;

const parser = new saxes.SaxesParser();

let flowStructure: FlowStructure;
let unclosedPipes: string[] = [];
let bufferAttributes: FlowNodeAttributes;

addEventListener('message', ({ data }) => {
  if (typeof data === 'string') {
    flowStructure = new FlowStructure();
    parser.write(data).close();
  }
});

parser.on('end', () =>
  postMessage(new FlowStructure(flowStructure.nodes, flowStructure.firstPipe))
);

parser.on('opentag', (tag: TagForOptions<{}>) => {
  const currentNode = new FlowStructureNode(
    parser.line,
    parser.column + MONACO_COLUMN_OFFSET,
    tag.name,
    bufferAttributes
  );
  bufferAttributes = {};

  if (currentNode.type.match(/Pipe$/g)) {
    if (!tag.isSelfClosing) {
      unclosedPipes.push(currentNode.name);
    }
    currentNode.forwards = [];
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type === 'Forward') {
    flowStructure.nodes
      .find((pipe: FlowStructureNode) => {
        return pipe.name === unclosedPipes[unclosedPipes.length - 1];
      })
      ?.forwards?.push(currentNode);
  } else if (currentNode.type.match(/Listener$/g)) {
    flowStructure.nodes.push(currentNode);
  } else if (currentNode.type.match(/Exit$/g)) {
    flowStructure.nodes.push(currentNode);
  }
});

parser.on('closetag', (tag: TagForOptions<{}>) => {
  if (tag.attributes['name'] === unclosedPipes[unclosedPipes.length - 1]) {
    unclosedPipes.pop();
  }
});

parser.on('attribute', (attribute: AttributeEventForOptions<{}>) => {
  const startColumn =
    parser.column - (attribute.name + attribute.value).length - 2; // Quote and equals sign

  if (attribute.name === 'firstPipe') {
    flowStructure.firstPipe = attribute.value;
  } else {
    const newAttribute = {
      value: attribute.value,
      line: parser.line,
      endColumn: parser.column + MONACO_COLUMN_OFFSET,
      startColumn,
    };

    bufferAttributes = { ...bufferAttributes, [attribute.name]: newAttribute };
  }
});
