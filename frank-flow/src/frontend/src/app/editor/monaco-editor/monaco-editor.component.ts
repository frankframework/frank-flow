/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { ModeService } from '../../header/modes/mode.service';
import { SettingsService } from '../../header/settings/settings.service';
import { Settings } from '../../header/settings/settings.model';
import { File } from '../../shared/models/file.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { Subscription } from 'rxjs';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FileType } from '../../shared/enums/file-type.enum';

let loadedMonaco = false;
let loadPromise: Promise<void>;

@Component({
  selector: 'app-monaco-editor',
  templateUrl: './monaco-editor.component.html',
  styleUrls: ['./monaco-editor.component.scss'],
})
export class MonacoEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer')
  public editorContainer!: ElementRef;

  @Output()
  public codeChange = new EventEmitter<string>();
  @Output()
  public finishedLoading: EventEmitter<boolean> = new EventEmitter<boolean>();

  private codeEditorInstance!: monaco.editor.IStandaloneCodeEditor;
  private currentFile!: File;
  private isReadOnly!: boolean;
  private currentFileSubscription!: Subscription;
  private modeSubscription!: Subscription;
  private settingsSubscription!: Subscription;

  private flowNeedsUpdate = true;
  private applyEditsUpdate = false;
  private decorations: string[] = [];
  private positionUpdate = false;
  private contentChanged = false;

  constructor(
    private monacoElement: ElementRef,
    private modeService: ModeService,
    private settingsService: SettingsService,
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService
  ) {
    this.flowStructureService.setMonacoEditorComponent(this);
  }

  ngAfterViewInit(): void {
    this.loadMonaco();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription?.unsubscribe();
    this.modeSubscription?.unsubscribe();
    this.settingsSubscription?.unsubscribe();
  }

  loadMonaco(): void {
    if (loadedMonaco) {
      loadPromise.then(() => {
        this.initializeMonaco();
      });
    } else {
      loadedMonaco = true;
      loadPromise = new Promise<void>((resolve: any) => {
        if (typeof (window as any).monaco === 'object') {
          resolve();
          return;
        }

        const onAmdLoader: any = () => {
          (window as any).require.config({ paths: { vs: 'assets/monaco/vs' } });
          (window as any).require(['vs/editor/editor.main'], () => {
            this.initializeMonaco();
            resolve();
          });
        };

        if (!(window as any).require) {
          const loaderScript: HTMLScriptElement =
            document.createElement('script');
          loaderScript.type = 'text/javascript';
          loaderScript.src = 'assets/monaco/vs/loader.js';
          loaderScript.addEventListener('load', onAmdLoader);
          document.body.append(loaderScript);
        } else {
          onAmdLoader();
        }
      });
    }
  }

  initializeMonaco(): void {
    this.initializeEditor();
    this.initializeActions();
    this.initializeOnChangeEvent();
    this.initializeOnKeyUpEvent();
    this.initializeNewFileSubscription();
    this.initializeOnDidChangeCursorPosition();
    this.initializeResizeObserver();
    this.initializeSettingsObserver();
    this.finishedLoading.emit();
  }

  initializeEditor(): void {
    this.codeEditorInstance = monaco.editor.create(
      this.editorContainer.nativeElement,
      {
        language: 'xml',
        theme: 'vs-dark',
        renderWhitespace: 'all',
        insertSpaces: false,
      }
    );
  }

  initializeActions(): void {
    this.codeEditorInstance.addAction({
      id: 'file-save-action',
      label: 'Save',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      contextMenuGroupId: 'file',
      contextMenuOrder: 3,
      run: () => this.save(),
    });
  }

  undo() {
    this.codeEditorInstance.trigger('keyboard', 'undo', '');
    this.setValueAsCurrentFile();
  }

  redo() {
    this.codeEditorInstance.trigger('keyboard', 'redo', '');
    this.setValueAsCurrentFile();
  }

  save(): void {
    this.currentFileService.save();
  }

  setValue(file: File | undefined): void {
    if (file?.xml !== undefined) {
      this.currentFile = file;
      this.codeEditorInstance.getModel()?.setValue(file.xml);
    }
  }

  applyEdits(
    editOperations: monaco.editor.IIdentifiedSingleEditOperation[],
    flowUpdate = false
  ): void {
    this.flowNeedsUpdate = flowUpdate;
    this.applyEditsUpdate = true;
    this.positionUpdate = true;

    this.codeEditorInstance
      .getModel()
      ?.pushEditOperations([], editOperations, () => []);
    this.codeEditorInstance.pushUndoStop();

    this.setValueAsCurrentFile();
  }

  initializeOnChangeEvent(): void {
    const model = this.codeEditorInstance.getModel();

    model?.onDidChangeContent(() => (this.contentChanged = true));
  }

  initializeOnKeyUpEvent(): void {
    this.codeEditorInstance?.onKeyUp(
      this.debounce(() => this.setValueAsCurrentFile(), 500)
    );
  }

  setValueAsCurrentFile(): void {
    if (this.fileNeedsUpdate()) {
      const value = this.codeEditorInstance.getModel()?.getValue();
      this.currentFile.saved = false;
      this.currentFile.xml = value;
      this.currentFile.flowNeedsUpdate = this.flowNeedsUpdate;
      this.currentFileService.updateCurrentFile(this.currentFile);
      this.contentChanged = false;
      this.flowNeedsUpdate = true;
    }
  }

  fileNeedsUpdate(): boolean {
    return this.currentFile && !this.isReadOnly && this.contentChanged;
  }

  initializeNewFileSubscription(): void {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe({
        next: (file: File) => {
          if (this.isNewlyLoadedFile(file)) {
            file.firstLoad = false;
            this.setValue(file);
            this.checkIfReadOnly(file);
            this.currentFile = file;
          }
        },
      });
  }

  isNewlyLoadedFile(file: File): boolean {
    return !!file.firstLoad;
  }

  checkIfReadOnly(file: File): void {
    this.isReadOnly = file.type === FileType.EMPTY;
    this.codeEditorInstance.updateOptions({ readOnly: this.isReadOnly });
  }

  initializeOnDidChangeCursorPosition(): void {
    this.codeEditorInstance.onDidChangeCursorPosition(
      this.debounce(() => {
        if (!this.positionUpdate) {
          this.highlightNode();
        }
        this.positionUpdate = false;
      }, 500)
    );
  }

  highlightNode(): void {
    const position = this.codeEditorInstance.getPosition();
    if (position && this.positionIsNotDefault(position)) {
      this.flowStructureService.selectNodeByPosition(position);
    }
  }

  positionIsNotDefault(position: monaco.Position): boolean {
    return position.lineNumber !== 1 || position.column !== 1;
  }

  highlightText(range: monaco.IRange): void {
    this.decorations = this.codeEditorInstance.deltaDecorations(
      this.decorations,
      [
        {
          range,
          options: {
            inlineClassName: 'monaco-editor__line--highlighted',
          },
        },
      ]
    );
  }

  setPosition(position: monaco.IPosition): void {
    this.positionUpdate = true;
    this.codeEditorInstance.setPosition(position);
  }

  debounce(function_: any, wait: number): any {
    let timeout: ReturnType<typeof setTimeout> | null;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(
        () => Reflect.apply(function_, this, arguments),
        wait
      );
    };
  }

  initializeResizeObserver(): void {
    this.modeSubscription = this.modeService.getMode().subscribe({
      next: () => {
        this.onResize();
      },
    });
  }

  onResize(): void {
    const parentElement = this.editorContainer.nativeElement;
    if (parentElement) {
      setTimeout(() =>
        this.codeEditorInstance.layout({
          height: parentElement.offsetHeight,
          width: parentElement.offsetWidth,
        })
      );
    }
  }

  initializeSettingsObserver(): void {
    this.settingsSubscription =
      this.settingsService.settingsObservable.subscribe({
        next: (settings) => {
          this.onThemeChange(settings);
          this.onResize();
          this.onSettingsChange(settings);
        },
      });
  }

  onThemeChange(settings: Settings): void {
    this.codeEditorInstance.updateOptions({
      theme: settings.darkMode ? 'vs-dark' : 'vs-light',
    });
  }

  onSettingsChange(settings: Settings): void {
    this.codeEditorInstance.updateOptions({
      renderWhitespace: settings.showWhitespaces ? 'all' : 'none',
      insertSpaces: settings.insetSpaces,
    });
  }
}
