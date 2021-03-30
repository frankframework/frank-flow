/// <reference lib="webworker" />

import { Parser } from 'xml2js';
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
  }

  postMessage(file);
});
