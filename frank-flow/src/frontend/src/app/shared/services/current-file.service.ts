/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { File } from '../models/file.model';
import { FileService } from './file.service';
import { ToastrService } from 'ngx-toastr';
import { FlowGenerationData } from '../models/flow-generation-data.model';
import { XmlParseError } from '../models/xml-parse-error.model';
import { FileType } from '../enums/file-type.enum';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root',
})
export class CurrentFileService {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private currentFile!: File;
  private currentFileSubject = new ReplaySubject<File>(1);
  public currentFileObservable = this.currentFileSubject.asObservable();
  private xmlToFlowStructureWorker!: Worker;

  private structure: any = {};

  currentDirectory!: File;
  files!: any;

  constructor(
    private fileService: FileService,
    private toastr: ToastrService,
    private sessionService: SessionService
  ) {
    this.initializeXmlToFlowStructureWorker();
    this.initializeXmlToFlowStructureWorkerEventListener();
  }

  initializeXmlToFlowStructureWorker(): void {
    if (Worker) {
      this.xmlToFlowStructureWorker = new Worker(
        new URL(
          '../../shared/workers/xml-to-flow-structure.worker',
          import.meta.url
        ),
        {
          name: 'xml-to-flow-structure.worker',
          type: 'module',
        }
      );
    }
  }

  initializeXmlToFlowStructureWorkerEventListener(): void {
    this.xmlToFlowStructureWorker.onmessage = ({ data }) => {
      this.clearErrorToasts();
      if (data) {
        if (this.parsingErrorsFound(data)) {
          this.currentFile.errors = data.errors;
          this.showParsingErrors(data.errors);
        } else {
          this.currentFile.errors = [];
          this.currentFile.flowStructure = data.structure;
        }
        this.currentFileSubject.next(this.currentFile);
      }
    };
  }

  clearErrorToasts(): void {
    this.toastr.toasts.forEach((toast) => {
      if (
        toast.toastRef.componentInstance.toastClasses.includes('toast-error')
      ) {
        toast.toastRef.manualClose();
      }
    });
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

  setCurrentDirectory(currentDirectory: File): void {
    this.currentDirectory = currentDirectory;
  }

  resetCurrentDirectory(): void {
    this.setCurrentDirectory({
      configuration: '',
      path: '',
      type: FileType.FOLDER,
    });
  }

  save(): void {
    if (this.fileCanBeSaved()) {
      this.fileService
        .updateFileForConfiguration(
          this.currentFile.configuration,
          this.currentFile.path,
          this.currentFile.xml!
        )
        .then((response) => {
          response.ok ? this.saveFileSuccessfully() : this.saveFileFailed();
        });
    }
  }

  fileCanBeSaved(): boolean {
    return <boolean>(
      (this.currentFile &&
        this.currentFile.configuration &&
        this.currentFile.path &&
        this.currentFile.xml &&
        !this.currentFile.saved)
    );
  }

  saveFileSuccessfully(): void {
    this.toastr.success(
      `The file ${this.currentFile.path} has been saved.`,
      'File saved!'
    );
    this.currentFile.saved = true;
    this.currentFile.flowNeedsUpdate = false;
    this.updateCurrentFile(this.currentFile);
  }

  saveFileFailed(): void {
    this.toastr.error(
      `The file ${this.currentFile.path} couldn't be saved.`,
      'Error saving'
    );
  }

  updateCurrentFile(file: File): void {
    this.currentFile = file;
    this.sessionService.setSessionFile(file);
    this.xmlToFlowStructureWorker.postMessage(file.xml);
  }

  switchToFileTreeItem(fileTreeItem: File): void {
    if (this.canSwitchFile(fileTreeItem)) {
      this.fileService
        .getFileFromConfiguration(fileTreeItem.configuration, fileTreeItem.path)
        .then((file) => {
          if (file != null) {
            this.setCurrentFile({
              path: fileTreeItem.path,
              xml: file,
              saved: true,
              configuration: fileTreeItem.configuration,
              flowNeedsUpdate: true,
            } as File);
          }
        })
        .catch((error) => {
          console.error(error);
          this.toastr.error(error, `File can't be fetched`);
        });
    }
  }

  canSwitchFile(file: File): boolean {
    return (
      this.currentFile === undefined ||
      !!(
        this.currentFile &&
        file.configuration &&
        file.path &&
        (this.currentFile.path !== file.path ||
          this.currentFile.configuration !== file.configuration)
      )
    );
  }

  setCurrentFile(file: File): void {
    this.currentFileSubject.next(file);
    this.updateCurrentFile(file);
  }
}
