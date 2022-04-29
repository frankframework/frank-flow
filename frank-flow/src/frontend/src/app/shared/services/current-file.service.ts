/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { File } from '../models/file.model';
import { FileService } from './file.service';
import { ToastrService } from 'ngx-toastr';
import { XmlParseError } from '../models/xml-parse-error.model';
import { FileType } from '../enums/file-type.enum';
import { SessionService } from './session.service';
import { PanZoomService } from './pan-zoom.service';
import { FrankDocumentService } from './frank-document.service';

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
  private convertConfigurationSyntaxWorker!: Worker;

  constructor(
    private fileService: FileService,
    private frankDocumentService: FrankDocumentService,
    private toastr: ToastrService,
    private sessionService: SessionService,
    private panZoomService: PanZoomService
  ) {
    this.initializeXmlToFlowStructureWorker();
    this.initializeXmlToFlowStructureWorkerEventListener();
    this.initializeConvertConfigurationSyntaxWorker();
    this.initializeConvertConfigurationSyntaxWorkerEventListener();
    this.subscribeToFrankDocumentService();
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
    this.xmlToFlowStructureWorker.addEventListener('message', ({ data }) => {
      if (data) {
        if (this.parsingErrorsFound(data)) {
          this.showParsingErrors(data.errors);
        }
        this.currentFileSubject.next(data);
      }
    });
  }

  initializeConvertConfigurationSyntaxWorker(): void {
    if (Worker) {
      this.convertConfigurationSyntaxWorker = new Worker(
        new URL(
          '../../shared/workers/convert-configuration-syntax.worker',
          import.meta.url
        ),
        {
          name: 'convert-configuration-syntax.worker',
          type: 'module',
        }
      );
    }
  }

  initializeConvertConfigurationSyntaxWorkerEventListener(): void {
    this.convertConfigurationSyntaxWorker.addEventListener(
      'message',
      ({ data }) => {
        if (data) {
          if (this.parsingErrorsFound(data)) {
            this.showParsingErrors(data.errors);
          }
          this.updateCurrentFile(data);
        }
      }
    );
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
    for (const error of parsedErrors) {
      this.toastr.error(
        error.getTemplateString(),
        'Parsing error found in XML',
        {
          disableTimeOut: true,
        }
      );
    }
  }

  groupSimilarErrors(errors: string[]): XmlParseError[] {
    const groupedErrors: XmlParseError[] = [];
    for (const errorMessage of errors) {
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
      .filter(Boolean);
    return new XmlParseError({
      startLine: +startLine,
      startColumn: +startColumn,
      message,
    });
  }

  subscribeToFrankDocumentService(): void {
    this.frankDocumentService.getFrankDoc().subscribe((frankDocument) =>
      this.convertConfigurationSyntaxWorker.postMessage({
        event: 'init',
        frankDoc: frankDocument,
      })
    );
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
    this.clearErrorToasts();

    switch (file.type) {
      case FileType.CONFIGURATION:
        this.xmlToFlowStructureWorker.postMessage(file);
        break;
      default:
        this.currentFileSubject.next(file);
        break;
    }
  }

  determineIfFileIsAConfiguration(file: File): void {
    if (this.isFileAConfiguration(file)) {
      file.type = FileType.CONFIGURATION;
    } else if (this.isFileAnOldSyntaxConfiguration(file)) {
      file.type = FileType.OLD_SYNTAX_CONFIGURATION;
    } else {
      file.type = FileType.FILE;
    }
  }

  isFileAConfiguration(file: File): boolean {
    const containsConfiguration =
      file.xml?.includes('<Configuration') &&
      !file.xml?.includes('<!DOCTYPE Configuration');
    const containsModule = file.xml?.includes('<Module') as boolean;
    const containsAdapter = file.xml?.includes('<Adapter') as boolean;
    return containsConfiguration || containsModule || containsAdapter;
  }

  isFileAnOldSyntaxConfiguration(file: File): boolean {
    const containsConfiguration =
      file.xml?.includes('<configuration') &&
      !file.xml?.includes('<!DOCTYPE configuration');
    const containsModule = file.xml?.includes('className') as boolean;
    return containsConfiguration || containsModule;
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
    this.resetCurrentDirectory();
    this.resetPanZoom();
  }

  resetPanZoom(): void {
    this.panZoomService.reset();
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

  convertOldConfigurationSyntax(): void {
    if (this.currentFile.type === FileType.OLD_SYNTAX_CONFIGURATION) {
      this.convertConfigurationSyntaxWorker.postMessage(this.currentFile);
    }
  }
}
