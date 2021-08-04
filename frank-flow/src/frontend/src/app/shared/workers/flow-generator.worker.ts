/// <reference lib="webworker" />

import * as saxes from 'saxes';
import { AttributeEventForOptions, TagForOptions } from 'saxes';
import { FlowNodeAttributes } from '../models/flowNodeAttributes.model';
import { FlowStructure } from '../models/flowStructure.model';
import { FlowStructureNode } from '../models/flowStructureNode.model';

const MONACO_COLUMN_OFFSET = 1;
const QUOTE_AND_EQUALS = 2;

let parser = new saxes.SaxesParser();

let flowStructure: FlowStructure;
let unclosedPipes: string[] = [];
let bufferAttributes: FlowNodeAttributes;
let pipeline: FlowStructureNode;
let endLine: number;

addEventListener('message', ({ data }) => {
  if (typeof data === 'string') {
    flowStructure = new FlowStructure();
    parserWrite(data);
  }
});

const parserWrite = (data: string) => {
  try {
    parser.write(data).close();
  } catch (e) {
    console.error(e);
  }
};

parser.on('error', (error) => {
  console.error(error);
});

parser.on('end', () => {
  const newFlowStructure = new FlowStructure(
    flowStructure.nodes,
    flowStructure.firstPipe
  );
  newFlowStructure.pipeline = pipeline;
  postMessage(newFlowStructure);
});

parser.on('opentag', (tag: TagForOptions<{}>) => {
  const currentNode = new FlowStructureNode(
    parser.line,
    endLine,
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
  } else if (currentNode.type === 'Pipeline') {
    pipeline = currentNode;
  }
});

parser.on('closetag', (tag: TagForOptions<{}>) => {
  endLine = parser.line;
  if (tag.attributes['name'] === unclosedPipes[unclosedPipes.length - 1]) {
    let closingTag = unclosedPipes.pop();

    let pipe = flowStructure.nodes.find((pipe: FlowStructureNode) => {
      return pipe.name === closingTag;
    });

    if (pipe) {
      pipe.endLine = parser.line;
    }
  }
});

parser.on('attribute', (attribute: AttributeEventForOptions<{}>) => {
  const startColumn =
    parser.column -
    (attribute.name + attribute.value).length -
    QUOTE_AND_EQUALS;

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
