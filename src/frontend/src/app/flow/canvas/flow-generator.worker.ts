/// <reference lib="webworker" />

import { Builder, Parser } from 'xml2js';
import { File } from '../../shared/models/file.model';
import { FileType } from '../../shared/enums/file-type.enum';

const parser = new Parser();

addEventListener('message', ({ data }) => {
  const file = data as File;

  if (file.type === FileType.XML && file.data) {
    parser.parseString(file.data, (err: any, result: any) => {
      file.type = FileType.JSON;
      file.data = result;

      if (err) {
        console.error(err);
      }
    });
  } else if (file.type === FileType.JSON && file.data) {
    const builder = new Builder();
    const xml = builder.buildObject(file.data);

    file.data = xml;
    file.type = FileType.XML;
  }

  postMessage(file);
});
