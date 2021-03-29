/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { File } from '../models/file.model';
import { FileType } from '../enums/file-type.enum';
import { Originator } from '../memento/originator';
import { Caretaker } from '../memento/caretaker';
import { FileService } from './file.service';
import { ToastrService } from 'ngx-toastr';
import { first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CodeService {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private currentFile = new Subject<File>();
  public curFileObservable = this.currentFile.asObservable();
  private originator?: Originator;
  private caretaker?: Caretaker;
  private redoAction = false;

  constructor(private fileService: FileService, private toastr: ToastrService) {
    this.originator = new Originator(new File());
    this.caretaker = new Caretaker(this.originator);
    this.getFirstFile();
  }

  getFirstFile(): void {
    const subscription = this.fileService.getFiles().subscribe({
      next: (files) => {
        console.log(files);

        if (files.length > 0) {
          const firstConfig = files[0];
          const firstConfigFile = files[0].content._files.filter(
            (file: string) => file.match(/.+\.xml$/)
          )[0];
          const firstFile = this.fileService.getFileFromConfiguration(
            firstConfig.name,
            firstConfigFile
          );
          firstFile.then((file) => {
            if (file) {
              this.setCurrentFile({
                path: firstConfigFile,
                type: FileType.XML,
                configuration: firstConfig.name,
                data: file,
                saved: true,
              });
            }
          });
          subscription.unsubscribe();
        }
      },
    });
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

  clearMementoHistory(): void {
    this.caretaker?.clearMementoList();
  }

  setCurrentFile(file: File): void {
    if (!this.redoAction) {
      this.caretaker?.clearRedoList();
    }
    this.redoAction = false;

    this.originator?.setState(file);
    this.caretaker?.save();

    this.currentFile.next(file);
  }

  getCurrentFile(): File | undefined {
    return this.originator?.getState();
  }
}
