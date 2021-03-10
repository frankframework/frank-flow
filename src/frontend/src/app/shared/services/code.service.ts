/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { File } from '../models/file.model';
import { FileType } from '../enums/file-type.enum';

@Injectable({
  providedIn: 'root',
})
export class CodeService {
  editor!: monaco.editor.IStandaloneCodeEditor;
  curFile = new Subject<File>();
  curFileObservable = this.curFile.asObservable();

  code = `<Configuration name="dd">
  <Adapter name="ddAdapter"> 
    <Receiver name="ddReceiver"> 
      <JavaListener name="ddListener" serviceName="ddService"  x="681" y="24" />
    </Receiver>
    <Pipeline firstPipe="ddPipe">
      <FixedResultPipe name="ddPipe" returnString="Hello World" x="100" y="50">
        <Forward name="success" path="EXIT"/> 
      </FixedResultPipe>
      <DelayPipe name="otherPipe" returnString="Hello World" x="100" y="250">
        <Forward name="success" path="EXIT"/> 
      </DelayPipe> 
      <XmlSwitchPipe name="switchXML" x="100" y="450">
        <Forward name="success" path="EXIT"/>
        <Forward name="error" path="err"/>
      </XmlSwitchPipe>
      <Exit path="EXIT" state="success" x="223" y="625"/> 
    </Pipeline> 
  </Adapter>
</Configuration>
`;

  constructor() {}

  setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    const defaultFile = new File();

    defaultFile.name = 'Default config';
    defaultFile.type = FileType.XML;
    defaultFile.data = this.code;

    this.setCurrentFile(defaultFile);
  }

  setCurrentFile(file: File): void {
    this.curFile.next(file);
  }
}
