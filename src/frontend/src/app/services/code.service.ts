/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CodeService {
  editor!: monaco.editor.IStandaloneCodeEditor;

  constructor() {}

  setEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
  }

  getEditorValue(): string {
    return this.editor.getValue();
  }
}
