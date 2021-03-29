/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { File } from '../models/file.model';
import { FileType } from '../enums/file-type.enum';
import { Originator } from '../memento/originator';
import { Caretaker } from '../memento/caretaker';
import { FileService } from './file.service';

@Injectable({
  providedIn: 'root',
})
export class CodeService {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private curFile = new Subject<File>();

  public curFileObservable = this.curFile.asObservable();

  private defaultFile = new File();

  private originator?: Originator;
  private caretaker?: Caretaker;

  private redoAction = false;

  private code = `<Configuration name="dd">
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

  constructor() {
    this.defaultFile.path = 'sergiMaakGoeieKoffie/Default config';
    this.defaultFile.type = FileType.XML;
    this.defaultFile.configuration = this.code;
    this.defaultFile.saved = true;

    this.originator = new Originator(this.defaultFile);
    this.caretaker = new Caretaker(this.originator);
  }

  setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    let file: File | undefined;

    if (!this.editor) {
      file = this.defaultFile;
    } else {
      file = this.originator?.getState();
    }

    this.editor = editor;
    this.createActions();

    if (file) {
      this.redoAction = true;
      this.setCurrentFile(file);
    }
  }

  createActions(): void {
    this.editor.addAction({
      id: 'memento-undo-action',
      label: 'Undo',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_Z],
      contextMenuGroupId: 'memento',
      contextMenuOrder: 2,
      run: () => this.undo(),
    });

    this.editor.addAction({
      id: 'memento-redo-action',
      label: 'Redo',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_Y],
      contextMenuGroupId: 'memento',
      contextMenuOrder: 3,
      run: () => this.redo(),
    });
  }

  public undo(): void {
    this.redoAction = true;
    this.caretaker?.undo();

    const value = this.originator?.getState().data;

    if (value) {
      this.editor.setValue(value);
    }
  }

  public redo(): void {
    this.redoAction = true;
    this.caretaker?.redo();

    const value = this.originator?.getState().data;

    if (value) {
      this.editor.setValue(value);
    }
  }

  setCurrentFile(file: File): void {
    if (!this.redoAction) {
      this.caretaker?.clearRedoList();
    }
    this.redoAction = false;

    this.originator?.setState(file);
    this.caretaker?.save();

    this.curFile.next(file);
  }
}
