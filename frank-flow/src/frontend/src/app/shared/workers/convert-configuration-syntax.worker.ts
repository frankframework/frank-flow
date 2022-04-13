/// <reference lib="webworker" />

import {
  AttributeEventForOptions,
  SaxesParser,
  SaxesStartTagPlain,
  TagForOptions,
} from 'saxes';
import { File } from '../models/file.model';

const SAXES_INDEX_OFFSET = 1;
const QUOTE_AND_EQUALS = 2;
const TRAILING_QUOTE = 1;

const parser = new SaxesParser();

let errors: string[] = [];
let xml: string;
let newXml: string;

let frankDocument: { elements: any; types: any };
let originalFile: File;

const unclosedElements: string[] = [];
let newXmlOffset = 0;
let tagStartIndex: number;
let classNameAttributePosition: number;
let classNameAttribute: AttributeEventForOptions<{}>;

addEventListener('message', ({ data }) => {
  if (data.event === 'init') {
    frankDocument = data.frankDoc;
    return;
  }
  if (typeof data.xml === 'string') {
    originalFile = data;
    errors = [];
    xml = data.xml;
    newXml = xml.toString();
    parserWrite(data.xml);
  }
});
const parserWrite = (xml: string) => {
  try {
    parser.write(xml).close();
  } catch (error) {
    console.error(error);
    parser.close();
  }
};

parser.on('error', (error) => {
  errors.push(error.message);
});

parser.on('end', () => {
  postMessage({
    ...originalFile,
    xml: newXml,
    saved: false,
    errors: errors,
  } as File);
});

parser.on('opentagstart', (tag: SaxesStartTagPlain) => {
  tagStartIndex = parser.position;
  tagStartIndex +=
    charBeforePositionIsTabOrSpace(parser.position) ||
    charBeforePositionIsGreaterThanCharacter(parser.position)
      ? 0
      : -1;
});

const charBeforePositionIsTabOrSpace = (position: number) => {
  const tabCode = 9;
  const spaceCode = 32;
  const charBeforeParser = xml.codePointAt(position - 1);
  return charBeforeParser === tabCode || charBeforeParser === spaceCode;
};

const charBeforePositionIsGreaterThanCharacter = (position: number) => {
  const greaterThanCode = 62;
  const charBeforeParser = xml.codePointAt(position - 1);
  return charBeforeParser === greaterThanCode;
};

parser.on('opentag', (tag: TagForOptions<{}>) => {
  const fullClassName = tag.attributes.className;
  let newElementName: string;

  if (fullClassName) {
    const postFix = getPostFix(fullClassName);
    const fullClassNameParts = fullClassName.split('.');
    const className = fullClassNameParts[fullClassNameParts.length - 1];
    const newElementPrefix = className.replace(postFix, '');
    newElementName = newElementPrefix + capitalizeFirstLetter(tag.name);
    replaceStringOnPositions(
      tagStartIndex - tag.name.length,
      tagStartIndex,
      newElementName
    );

    let start =
      classNameAttributePosition -
      (classNameAttribute.name + classNameAttribute.value).length -
      QUOTE_AND_EQUALS;
    replaceStringOnPositions(
      start,
      classNameAttributePosition + TRAILING_QUOTE,
      ''
    );
  } else {
    newElementName = capitalizeFirstLetter(tag.name);
    replaceStringOnPositions(
      tagStartIndex - tag.name.length,
      tagStartIndex,
      newElementName
    );
  }

  if (!tag.isSelfClosing) {
    unclosedElements.push(newElementName);
  }
});

const getPostFix = (fullClassName: string) => {
  for (const type of frankDocument.types) {
    if (type.members.includes(fullClassName)) {
      return type.name.split('.I')[1];
    }
  }
};

const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const replaceStringOnPositions = (
  start: number,
  end: number,
  string: string
) => {
  const startString = newXml.slice(
    0,
    start + newXmlOffset - SAXES_INDEX_OFFSET
  );
  const endString = newXml.slice(
    end + newXmlOffset - SAXES_INDEX_OFFSET,
    newXml.length
  );
  newXmlOffset += string.length - (end - start);
  newXml = startString + string + endString;
};

parser.on('closetag', (tag: TagForOptions<{}>) => {
  if (!tag.isSelfClosing) {
    const newElementName = unclosedElements.pop();
    if (newElementName) {
      replaceStringOnPositions(
        parser.position - tag.name.length,
        parser.position,
        newElementName
      );
    }
  }
});

parser.on('attribute', (attribute: AttributeEventForOptions<{}>) => {
  if (attribute.name === 'className') {
    classNameAttribute = attribute;
    classNameAttributePosition = parser.position;
  }
});
