/// <reference lib="webworker" />
import { Parser } from 'xml2js';

const parser = new Parser();

addEventListener('message', ({ data }) => {
  let parsedXml;

  parser.parseString(data, (err: any, result: any) => {
    parsedXml = data;
  });

  postMessage(parsedXml);
});
