/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { File } from '../models/file.model';
import { FileType } from '../enums/file-type.enum';
import { Originator } from '../memento/originator';
import { Caretaker } from '../memento/caretaker';
import { FileService } from './file.service';
import { ToastrService } from 'ngx-toastr';

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

  constructor(private fileService: FileService, private toastr: ToastrService) {
    // this.defaultFile.path = 'sergiMaakGoeieKoffie/Default config';
    // this.defaultFile.type = FileType.XML;
    // this.defaultFile.configuration = this.code;
    // this.defaultFile.saved = true;

    this.originator = new Originator(this.defaultFile);
    this.caretaker = new Caretaker(this.originator);
  }

  undo(): File | undefined {
    this.redoAction = true;
    this.caretaker?.undo();

    return this.originator?.getState();
  }

  redo(): File | undefined {
    this.redoAction = true;
    this.caretaker?.redo();

    return this.originator?.getState();
  }

  save(): void {
    const currentFile = this.originator?.getState();
    if (
      currentFile &&
      currentFile.configuration &&
      currentFile.path &&
      currentFile.data &&
      !currentFile.saved
    ) {
      this.fileService
        .updateFileForConfiguration(
          currentFile.configuration,
          currentFile.path,
          currentFile.data
        )
        .then((response) => {
          if (response) {
            this.toastr.success(
              `The file ${currentFile.path} has been saved.`,
              'File saved!'
            );
            currentFile.saved = true;
            this.setCurrentFile(currentFile);
          } else {
            this.toastr.error(
              `The file ${currentFile.path} couldn't be saved.`,
              'Error saving'
            );
          }
        });
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

  getCurrentFile(): File | undefined {
    return this.originator?.getState();
  }
}
