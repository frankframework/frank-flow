/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';
import { ReplaySubject, Subject, Subscription } from 'rxjs';
import { File } from '../models/file.model';
import { FileService } from './file.service';
import { ToastrService } from 'ngx-toastr';
import { XmlParseError } from '../models/xml-parse-error.model';
import { FileType } from '../enums/file-type.enum';
import { SessionService } from './session.service';
import { PanZoomService } from './pan-zoom.service';
import { FrankDoc } from './frank-doc.service';
import { FileTreeItemModel } from '../models/file-tree-item.model';
import { SwitchWithoutSavingOption } from '../../header/settings/options/switch-without-saving-option';
import { SettingsService } from '../../header/settings/settings.service';
import { Settings } from '../../header/settings/settings.model';
import { NgxSmartModalService } from 'ngx-smart-modal';

@Injectable({
  providedIn: 'root',
})
export class CurrentFileService {
  private currentFile!: File;
  private currentFileSubject = new ReplaySubject<File>(1);
  private xmlToFlowStructureWorker!: Worker;
  private convertConfigurationSyntaxWorker!: Worker;

  public currentFileObservable = this.currentFileSubject.asObservable();
  public currentDirectory!: File;
  public fileSelectedInExplorer = true;

  public userSelectedNewFileObservable = new Subject<boolean>();
  private settingsSubscription!: Subscription;
  private settings!: Settings;

  constructor(
    private fileService: FileService,
    private frankDocService: FrankDoc,
    private toastr: ToastrService,
    private sessionService: SessionService,
    private panZoomService: PanZoomService,
    private settingsService: SettingsService,
    private ngxSmartModalService: NgxSmartModalService
  ) {
    this.initializeXmlToFlowStructureWorker();
    this.initializeXmlToFlowStructureWorkerEventListener();
    this.initializeConvertConfigurationSyntaxWorker();
    this.initializeConvertConfigurationSyntaxWorkerEventListener();
    this.subscribeToFrankDoc();
    this.getSettings();
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
    this.xmlToFlowStructureWorker.addEventListener(
      'message',
      (messageEvent: MessageEvent<File>): void => {
        if (messageEvent.data) {
          if (this.parsingErrorsFound(messageEvent.data)) {
            this.showParsingErrors(messageEvent.data.errors!);
          }
          this.currentFile = messageEvent.data;
          this.currentFileSubject.next(messageEvent.data);
        }
      }
    );
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
      (messageEvent: MessageEvent<File>): void => {
        if (messageEvent.data) {
          if (this.parsingErrorsFound(messageEvent.data)) {
            this.showParsingErrors(messageEvent.data.errors!);
          }
          this.updateCurrentFile(messageEvent.data);
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

  subscribeToFrankDoc(): void {
    this.frankDocService.getFrankDoc().subscribe((frankDoc) =>
      this.convertConfigurationSyntaxWorker.postMessage({
        event: 'init',
        frankDoc: frankDoc,
      })
    );
  }

  setCurrentDirectory(currentDirectory: File): void {
    this.currentDirectory = currentDirectory;
  }

  resetCurrentDirectory(): void {
    this.setCurrentDirectory({
      configurationName: '',
      path: '',
      type: FileType.FOLDER,
    } as File);
  }

  resetCurrentFile(): void {
    const emptyFile: File = {
      path: '',
      configurationName: '',
      xml: 'No file selected, please select a file in the Explorer',
      saved: true,
      firstLoad: true,
      type: FileType.EMPTY,
      adapters: [],
    };
    this.updateCurrentFile(emptyFile);
  }

  save(): void {
    if (this.fileCanBeSaved()) {
      this.fileService
        .updateFileForConfiguration(
          this.currentFile.configurationName,
          this.currentFile.path,
          this.currentFile.xml!
        )
        .then((response) =>
          response.ok ? this.saveFileSuccessfully() : response.json()
        )
        .then((body) => {
          this.saveFileFailed(body);
        });
    }
  }

  fileCanBeSaved(): boolean {
    return <boolean>(
      (this.currentFile &&
        this.currentFile.configurationName &&
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

  saveFileFailed(response: any): void {
    this.toastr.error(response.error, 'Error saving');
  }

  updateCurrentFile(file: File): void {
    this.currentFile = file;
    this.sessionService.setSessionFile(file);
    this.determineIfFileIsAConfiguration(file);
    this.clearErrorToasts();

    switch (file.type) {
      case FileType.CONFIGURATION: {
        this.xmlToFlowStructureWorker.postMessage(file);
        break;
      }
      default: {
        this.currentFileSubject.next(file);
        break;
      }
    }
  }

  determineIfFileIsAConfiguration(file: File): void {
    if (this.isFileAConfiguration(file)) {
      file.type = FileType.CONFIGURATION;
    } else if (this.isFileAnOldSyntaxConfiguration(file)) {
      file.type = FileType.OLD_SYNTAX_CONFIGURATION;
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
        file.configurationName &&
        file.path &&
        (this.currentFile.path !== file.path ||
          this.currentFile.configurationName !== file.configurationName)
      )
    );
  }

  fetchFileAndSetToCurrent(file: File): void {
    this.fileService
      .getFileFromConfiguration(
        file.configurationName,
        this.cleanUpFilePath(file.path, file.configurationName)
      )
      .then((response) =>
        response.status === 500 ? response.json() : response.text()
      )
      .then((result) => {
        result
          ? result?.error
            ? this.showFetchingErrorMessage(result.error)
            : this.setNewCurrentFile(file, result)
          : this.showFileNotFoundMessage(file);
      });
  }

  cleanUpFilePath(path: string, configuration: string): string {
    return path.replace(configuration, '');
  }

  showFileNotFoundMessage(file: File): void {
    this.resetCurrentFile();
    this.toastr.error(
      `The file ${file.path} could not be found.`,
      'File not found',
      {
        disableTimeOut: true,
      }
    );
  }

  showFetchingErrorMessage(error: string): void {
    this.resetCurrentFile();
    this.toastr.error(error, 'Error fetching file', {
      disableTimeOut: true,
    });
  }

  setNewCurrentFile(file: File, content: string): void {
    const currentFile: File = {
      type: FileType.FILE,
      configurationName: file.configurationName,
      path: file.path,
      xml: content,
      saved: true,
      flowNeedsUpdate: true,
      firstLoad: true,
      adapters: file.adapters,
    };
    this.setCurrentFile(currentFile);
    this.resetCurrentDirectory();
    this.resetPanZoom();
  }

  resetPanZoom(): void {
    this.panZoomService.reset();
  }

  deleteItem(): void {
    this.deleteFileOrFolder()
      .then((response) =>
        response.ok ? this.deleteItemSuccessfully() : response.json()
      )
      .then((body) => {
        this.deleteItemFailed(body);
      });
  }

  deleteItemSuccessfully(): void {
    const isFolder = !!this.currentDirectory.configurationName;
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

  deleteItemFailed(response: any): void {
    const isFolder = this.currentDirectory.configurationName;
    this.toastr.error(
      `${response.error}`,
      `Error removing ${isFolder ? 'Folder' : 'File'}`
    );
  }

  deleteFileOrFolder(): Promise<Response> {
    return this.currentDirectory.configurationName
      ? this.fileService.removeDirectoryForConfiguration(
          this.currentDirectory.configurationName,
          this.currentDirectory.path
        )
      : this.fileService.removeFileForConfiguration(
          this.currentFile.configurationName,
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

  refreshFile(): void {
    this.updateCurrentFile(this.currentFile);
  }

  handleFileClick(item: FileTreeItemModel): void {
    const file: File | undefined = this.transformFileTreeItemModelToFile(item);
    if (file) {
      if (
        this.currentFile.path === file.path &&
        this.currentFile.configuration === file.configuration
      ) {
        return;
      }
      this.currentFileSubject.next(file);
    }

    if (file) {
      if (this.filesAreEqual(this.currentFile, file)) {
        this.resetCurrentDirectory();
        return;
      }

      if (file.type === FileType.FILE) {
        if (this.fileNeedsToBeSaved()) {
          this.switchUnsavedChangesDecision(file);
        } else {
          this.switchToFileTreeItem(file);
        }
      } else if (file.type === FileType.FOLDER) {
        this.setCurrentDirectory(file);
      }
    }
  }

  fileNeedsToBeSaved(): boolean {
    return this.currentFile && !this.currentFile?.saved;
  }

  filesAreEqual(file1: File, file2: File): boolean {
    return (
      file1.configuration === file2.configuration && file1.path === file2.path
    );
  }

  transformFileTreeItemModelToFile(item: FileTreeItemModel): File | undefined {
    if (item.type === 'file') {
      if (item.fileType === 'configuration') {
        return {
          path: item.path,
          configurationNa: item.name,
          xml: item.xml,
          flowStructure: item.flowStructure,
          saved: item.saved,
          flowNeedsUpdate: item.flowNeedsUpdate,
          type: FileType.FILE,
          firstLoad: item.firstLoad,
        } as File;
      } else if (item.fileType === 'other') {
        return {
          path: item.path,
          configuration: item.name,
          saved: item.saved,
          type: FileType.FILE,
          firstLoad: item.firstLoad,
        } as File;
      }
    }
    return undefined;
  }

  switchUnsavedChangesDecision(file: File): void {
    switch (this.settings.switchWithoutSaving) {
      case SwitchWithoutSavingOption.ask: {
        this.ngxSmartModalService
          .getModal('saveDialog')
          .setData({ file, fileTreeComponent: this }, true)
          .open();
        break;
      }
      case SwitchWithoutSavingOption.save: {
        this.save();
        this.switchToFileTreeItem(file);
        break;
      }
      case SwitchWithoutSavingOption.discard: {
        this.switchToFileTreeItem(file);
        break;
      }
    }
  }

  getSettings(): void {
    this.settingsSubscription =
      this.settingsService.settingsObservable.subscribe(
        (settings) => (this.settings = settings)
      );
  }
}
