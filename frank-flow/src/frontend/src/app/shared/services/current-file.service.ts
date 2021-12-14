/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { File } from '../models/file.model';
import { FileService } from './file.service';
import { ToastrService } from 'ngx-toastr';
import { XmlParseError } from '../models/xml-parse-error.model';
import { FileType } from '../enums/file-type.enum';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root',
})
export class CurrentFileService {
  currentDirectory!: File;
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private currentFile!: File;
  private currentFileSubject = new ReplaySubject<File>(1);
  public currentFileObservable = this.currentFileSubject.asObservable();
  private xmlToFlowStructureWorker!: Worker;

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
          this.showParsingErrors(data.errors);
        }
        this.currentFileSubject.next(data);
      }
    };
  }

  clearErrorToasts(): void {
    for (const toast of this.toastr.toasts) {
      if (
        toast.toastRef.componentInstance.toastClasses.includes('toast-error')
      ) {
        toast.toastRef.manualClose();
      }
    }
  }

  parsingErrorsFound(data: File): boolean {
    return !!(data.errors && data.errors.length > 0);
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
    for (const [index, errorMessage] of errors.entries()) {
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
    }
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
      .split(/(\d+):(\d+):\s(.+)/)
      .filter((index) => index);
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

  resetCurrentFile(): void {
    const emptyFile = {
      path: '',
      configuration: '',
      xml: 'No file selected, please select a file in the Explorer',
      saved: true,
      firstLoad: true,
      type: FileType.EMPTY,
    };
    this.updateCurrentFile(emptyFile);
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
    this.determineIfFileIsAConfiguration(file);

    if (file.type === FileType.CONFIGURATION) {
      this.xmlToFlowStructureWorker.postMessage(file);
    } else {
      this.currentFileSubject.next(file);
    }
  }

  determineIfFileIsAConfiguration(file: File): void {
    if (this.isFileAConfiguration(file)) {
      file.type = FileType.CONFIGURATION;
    }
  }

  isFileAConfiguration(file: File): boolean {
    const containsConfiguration = file.xml?.indexOf('<Configuration')! > -1;
    const containsModule = file.xml?.indexOf('<Module')! > -1;
    const containsAdapter = file.xml?.indexOf('<Adapter')! > -1;
    return containsConfiguration || containsModule || containsAdapter;
  }

  switchToFileTreeItem(fileTreeItem: File): void {
    if (this.canSwitchFile(fileTreeItem)) {
      this.fetchFileAndSetToCurrent(fileTreeItem);
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

  fetchFileAndSetToCurrent(file: File): void {
    this.fileService
      .getFileFromConfiguration(file.configuration, file.path)
      .then((result) => {
        if (result) {
          this.setNewCurrentFile(file, result);
        }
      })
      .catch((error: Error) => {
        console.error(error);
        this.toastr.error(error.message, `File can't be fetched`);
      });
  }

  setNewCurrentFile(file: File, content: string): void {
    const currentFile = {
      type: FileType.FILE,
      configuration: file.configuration,
      path: file.path,
      xml: content,
      saved: true,
      flowNeedsUpdate: true,
      firstLoad: true,
    };
    this.setCurrentFile(currentFile);
  }

  deleteFile(): void {
    this.deleteFileOrFolder().then((response) => {
      response.ok ? this.deleteFileSuccessfully() : this.deleteFileFailed();
    });
  }

  deleteFileSuccessfully(): void {
    const isFolder = !!this.currentDirectory.configuration;
    this.showDeleteSuccessfullMessage(isFolder);
    this.resetCurrentFile();
    this.resetCurrentDirectory();
    this.refreshFileTree();
  }

  showDeleteSuccessfullMessage(isFolder: boolean): void {
    this.toastr.success(
      `The ${isFolder ? 'folder' : 'file'} ${
        isFolder ? this.currentDirectory.path : this.currentFile.path
      } has been removed.`,
      `${isFolder ? 'Folder' : 'File'} removed!`
    );
  }

  deleteFileFailed(): void {
    const isFolder = this.currentDirectory.configuration;
    this.toastr.error(
      `The ${isFolder ? 'folder' : 'file'} ${
        isFolder ? this.currentDirectory.path : this.currentFile.path
      } couldn't be removed.`,
      `${isFolder ? 'Folder' : 'File'} removing`
    );
  }

  deleteFileOrFolder(): Promise<Response> {
    return this.currentDirectory.configuration
      ? this.fileService.removeDirectoryForConfiguration(
          this.currentDirectory.configuration,
          this.currentDirectory.path
        )
      : this.fileService.removeFileForConfiguration(
          this.currentFile.configuration,
          this.currentFile.path
        );
  }

  refreshFileTree(): void {
    this.fileService.fetchFiles();
  }

  setCurrentFile(file: File): void {
    this.determineIfFileIsAConfiguration(file);
    this.updateCurrentFile(file);
    this.currentFileSubject.next(file);
  }
}
