/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CodeService {
  editor!: monaco.editor.IStandaloneCodeEditor;
  curFile = new Subject<string>();
  curFileObservable = this.curFile.asObservable();

  constructor() {}

  setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    // this.curFile.next(editor.getValue());
  }

  setCurrentFile(file: string): void {
    this.curFile.next(file);
  }
}
