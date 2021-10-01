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
import { FlowGenerationData } from '../models/flow-generation-data.model';
import { XmlParseError } from '../models/xml-parse-error.model';

@Injectable({
  providedIn: 'root',
})
export class CurrentFileService {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private currentFile!: File;
  private currentFileSubject = new Subject<File>();
  public currentFileObservable = this.currentFileSubject.asObservable();
  private flowGenerator!: Worker;

  private structure: any = {};
  public structureSubject: Subject<any> = new Subject<any>();
  public errorSubject: Subject<string[]> = new Subject<string[]>();

  currentDirectory!: File;
  files!: any;

  constructor(private fileService: FileService, private toastr: ToastrService) {
    this.initializeXmlToFlowStructureWorker();
    this.initializeXmlToFlowStructureWorkerEventListener();
    this.getFiles();
  }

  initializeXmlToFlowStructureWorker(): void {
    if (Worker) {
      this.flowGenerator = new Worker(
        new URL('../../shared/workers/flow-generator.worker', import.meta.url),
        {
          name: 'flow-generator',
          type: 'module',
        }
      );
    }
  }

  initializeXmlToFlowStructureWorkerEventListener(): void {
    this.flowGenerator.onmessage = ({ data }) => {
      this.toastr.clear();
      if (data) {
        this.errorSubject.next(data.errors);
        if (this.parsingErrorsFound(data)) {
          this.showParsingErrors(data.errors);
        } else {
          this.currentFile.flowStructure = data.structure;
          this.currentFileSubject.next(this.currentFile);
        }
      }
    };
  }

  parsingErrorsFound(data: FlowGenerationData): boolean {
    return data.errors.length > 0;
  }

  showParsingErrors(errors: string[]): void {
    const parsedErrors = this.groupSimilarErrors(errors);
    parsedErrors.forEach((error: XmlParseError) => {
      this.toastr.error(
        error.getTemplateString(),
        'Parsing error found in XML',
        {
          disableTimeOut: true,
        }
      );
    });
  }

  groupSimilarErrors(errors: string[]): XmlParseError[] {
    const groupedErrors: XmlParseError[] = [];
    errors.forEach((errorMessage, index) => {
      const lastError = groupedErrors[groupedErrors.length - 1];
      const error = this.parseErrorMessage(errorMessage);
      if (this.errorMessageEqualToLast(error, lastError)) {
        if (this.errorColumnFollowsLast(error, lastError)) {
          lastError.endColumn = error.startColumn;
        } else if (this.errorLineFollowsLast(error, lastError)) {
          lastError.endLine = error.startLine;
        }
      } else {
        groupedErrors.push(error);
      }
    });
    return groupedErrors;
  }

  errorMessageEqualToLast(
    error: XmlParseError,
    lastError: XmlParseError
  ): boolean {
    return lastError && lastError.message === error.message;
  }

  errorColumnFollowsLast(
    error: XmlParseError,
    lastError: XmlParseError
  ): boolean {
    return (
      lastError.endLine === error.startLine &&
      lastError.endColumn + 1 === error.startColumn
    );
  }

  errorLineFollowsLast(
    error: XmlParseError,
    lastError: XmlParseError
  ): boolean {
    return lastError.endLine + 1 === error.startLine && error.startColumn === 1;
  }

  parseErrorMessage(error: string): XmlParseError {
    const [startLine, startColumn, message] = error
      .split(/([0-9]+):([0-9]+):\s(.+)/)
      .filter((i) => i);
    return new XmlParseError({
      startLine: +startLine,
      startColumn: +startColumn,
      message,
    });
  }

  setStructure(structure: any): void {
    this.structureSubject.next(structure);
    this.structure = structure;
  }

  getStructure(): any {
    return this.structure;
  }

  getFiles(): void {
    this.fileService.getFiles().subscribe({
      next: (files) => {
        this.files = files;
        if (this.currentFileSubject) {
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
      this.currentFileSubject.next(curFile);
    }
  }

  save(): void {
    const currentFile = this.currentFile;
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

  setCurrentFile(file: File): void {
    this.currentFileSubject.next(file);
  }

  getCurrentFile(): File | undefined {
    return this.currentFile;
  }

  switchCurrentFile(item: File): void {
    const currentFile = this.currentFile;

    if (this.canSwitchCurrentFile(currentFile, item)) {
      this.fileService
        .getFileFromConfiguration(item.configuration, item.path)
        .then((file) => {
          if (file != null) {
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
