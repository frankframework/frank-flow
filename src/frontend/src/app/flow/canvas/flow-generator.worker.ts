/// <reference lib="webworker" />
import { Parser } from 'xml2js';

let parser = new Parser();

addEventListener('message', ({ data }) => {
  let parsedXml;

  parser.parseString(data, function (_err: any, result: any) {
    parsedXml = data;
  });

  postMessage(parsedXml);
});
