/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { File } from '../models/file.model';
import { FileType } from '../enums/file-type.enum';
import { Originator } from '../memento/originator';
import { Caretaker } from '../memento/caretaker';
import { FileService } from './file.service';
import { ToastrService } from 'ngx-toastr';
import { Folder } from '../models/folder.model';

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
  currentDirectory!: File;
  files!: any;

  constructor(private fileService: FileService, private toastr: ToastrService) {
    this.originator = new Originator(new File());
    this.caretaker = new Caretaker(this.originator);
    this.getFiles();
  }

  getFiles(): void {
    this.fileService.getFiles().subscribe({
      next: (files) => {
        this.files = files;
        if (this.currentFile) {
          this.getFirstFile();
        }
      },
    });
  }

  getFirstFile(): void {
    if (this.files.length > 0) {
      const firstConfig = this.files[0];
      this.currentDirectory = {
        configuration: firstConfig.name,
        path: '',
      } as Folder;

      if (this.files[0].content) {
        const firstConfigFile = this.files[0].content._files.filter(
          (file: string) => file.match(/.+\.xml$/)
        )[0];
        if (firstConfigFile) {
          const firstFile = this.fileService.getFileFromConfiguration(
            firstConfig.name,
            firstConfigFile
          );
          firstFile.then((file) => {
            if (file) {
              this.setCurrentFile({
                path: firstConfigFile,
                xml: file,
                configuration: firstConfig.name,
                saved: true,
              } as File);
            }
          });
        }
      }
    }
  }

  reloadFile(): void {
    const curFile = this.getCurrentFile();

    if (curFile) {
      this.currentFile.next(curFile);
    }
  }

  undo(): File | undefined {
    this.redoAction = true;
    this.caretaker?.undo();

    this.currentFile.next(this.originator?.getState());
    return this.originator?.getState();
  }

  redo(): File | undefined {
    this.redoAction = true;
    this.caretaker?.redo();

    if (this.originator) {
      this.setCurrentFile(this.originator?.getState());
    }
    return this.originator?.getState();
  }

  save(): void {
    const currentFile = this.originator?.getState();
    if (
      currentFile &&
      currentFile.configuration &&
      currentFile.path &&
      currentFile.xml &&
      !currentFile.saved
    ) {
      this.fileService
        .updateFileForConfiguration(
          currentFile.configuration,
          currentFile.path,
          currentFile.xml
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

  switchCurrentFile(item: File): void {
    const currentFile = this.originator?.getState();

    if (this.canSwitchCurrentFile(currentFile, item)) {
      this.fileService
        .getFileFromConfiguration(item.configuration, item.path)
        .then((file) => {
          if (file != null) {
            this.clearMementoHistory();
            this.setCurrentFile({
              path: item.path,
              xml: file,
              saved: true,
              configuration: item.configuration,
            } as File);
          }
        })
        .catch((error) => {
          console.error(error);
          this.toastr.error(error, `File can't be fetched`);
        });
    }
  }

  canSwitchCurrentFile(currentFile: File | undefined, item: File): boolean {
    return !!(
      currentFile &&
      item.configuration &&
      item.path &&
      (currentFile.path !== item.path ||
        currentFile.configuration !== item.configuration)
    );
  }
}
