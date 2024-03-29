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
let originalFile: File;
let xml: string;
let newXml: string;

let frankDoc: { elements: any; types: any };

let unclosedElements: string[] = [];
let newXmlOffset = 0;
let tagStartIndex: number;
let classNameAttributePosition: number;
let classNameAttribute: AttributeEventForOptions<{}>;

addEventListener('message', ({ data }) => {
  if (data.event === 'init') {
    frankDoc = data.frankDoc;
    return;
  }
  if (typeof data.xml === 'string') {
    resetAllPreviousData();
    originalFile = data;
    errors = [];
    xml = data.xml;
    newXml = xml.toString();
    parserWrite(data.xml);
  }
});

const resetAllPreviousData = () => {
  unclosedElements = [];
  newXmlOffset = 0;
  tagStartIndex = 0;
  classNameAttributePosition = 0;
  classNameAttributePosition = 0;
};

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
    firstLoad: true,
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
    const tagNameWithCapitalLetter = capitalizeFirstLetter(tag.name);
    const postFix = getPostFix(fullClassName, tagNameWithCapitalLetter);
    const fullClassNameParts = fullClassName.split('.');
    const className = fullClassNameParts[fullClassNameParts.length - 1];
    const newElementPrefix = className.replace(postFix, '');
    newElementName = newElementPrefix + tagNameWithCapitalLetter;
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

const getPostFix = (fullClassName: string, tagName: string) => {
  let postFix = '';
  for (const type of frankDoc.types) {
    if (type.members.includes(fullClassName)) {
      postFix = type.name.split('.I')[1];
      if (tagName.includes(postFix)) {
        return postFix;
      }
    }
  }
  return postFix;
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
