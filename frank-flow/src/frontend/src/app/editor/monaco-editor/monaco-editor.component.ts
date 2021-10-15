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

let loadedMonaco = false;
let loadPromise: Promise<void>;

@Component({
  selector: 'app-monaco-editor',
  templateUrl: './monaco-editor.component.html',
  styleUrls: ['./monaco-editor.component.scss'],
})
export class MonacoEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer') editorContainer!: ElementRef;

  @Output() codeChange = new EventEmitter<string>();

  codeEditorInstance!: monaco.editor.IStandaloneCodeEditor;
  currentFile!: File;

  currentFileSubscription!: Subscription;
  modeSubscription!: Subscription;
  settingsSubscription!: Subscription;

  private flowNeedsUpdate: boolean = true;
  private applyEditsUpdate: boolean = false;

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
    this.currentFileSubscription.unsubscribe();
    this.modeSubscription.unsubscribe();
    this.settingsSubscription.unsubscribe();
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
          const loaderScript: HTMLScriptElement = document.createElement(
            'script'
          );
          loaderScript.type = 'text/javascript';
          loaderScript.src = 'assets/monaco/vs/loader.js';
          loaderScript.addEventListener('load', onAmdLoader);
          document.body.appendChild(loaderScript);
        } else {
          onAmdLoader();
        }
      });
    }
  }

  initializeMonaco(): void {
    this.initializeEditor();
    this.initializeActions();
    this.initializeFile();
    this.initializeOnKeyUpEvent();
    this.initializeOnChangeEvent();
    this.initializeNewFileSubscription();
    this.initializeResizeObserver();
    this.initializeThemeObserver();
  }

  initializeEditor(): void {
    this.codeEditorInstance = monaco.editor.create(
      this.editorContainer.nativeElement,
      {
        language: 'xml',
        theme: 'vs-dark',
      }
    );
  }

  initializeActions(): void {
    this.codeEditorInstance.addAction({
      id: 'file-save-action',
      label: 'Save',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
      contextMenuGroupId: 'file',
      contextMenuOrder: 3,
      run: () => this.save(),
    });
  }

  save(): void {
    this.currentFileService.save();
  }

  initializeFile(): void {
    this.setValue(this.currentFileService.getCurrentFile());
  }

  setValue(file: File | undefined): void {
    if (file?.xml) {
      const position = this.codeEditorInstance.getPosition();
      this.currentFile = file;
      this.codeEditorInstance.getModel()?.setValue(file.xml);
      if (position) {
        this.codeEditorInstance.setPosition(position);
      }
    }
  }

  applyEdits(
    editOperations: monaco.editor.IIdentifiedSingleEditOperation[],
    flowUpdate: boolean = false
  ): void {
    this.flowNeedsUpdate = flowUpdate;
    this.applyEditsUpdate = true;
    this.codeEditorInstance.getModel()?.applyEdits(editOperations);
  }

  initializeOnKeyUpEvent(): void {
    this.codeEditorInstance?.onKeyUp(
      this.debounce(() => this.setValueAsCurrentFile(), 500)
    );
  }

  initializeOnChangeEvent(): void {
    this.codeEditorInstance.getModel()?.onDidChangeContent(() => {
      if (this.applyEditsUpdate) {
        this.applyEditsUpdate = false;
        this.setValueAsCurrentFile();
      }
    });
  }

  setValueAsCurrentFile(): void {
    const value = this.codeEditorInstance.getValue();

    if (this.currentFile) {
      this.currentFile.saved = false;
      this.currentFile.xml = value;
      this.currentFile.flowNeedsUpdate = this.flowNeedsUpdate;
      this.currentFileService.updateCurrentFile(this.currentFile);
    }
    this.flowNeedsUpdate = true;
  }

  initializeNewFileSubscription(): void {
    this.currentFileSubscription = this.currentFileService.currentFileObservable.subscribe(
      {
        next: (file: File) => {
          if (this.isNewlyLoadedFile(file)) {
            this.setValue(file);
            this.currentFile = file;
          }
        },
      }
    );
  }

  isNewlyLoadedFile(file: File) {
    return file.xml && !file.flowStructure;
  }

  debounce(func: any, wait: number): any {
    let timeout: ReturnType<typeof setTimeout> | null;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func.apply(this, arguments), wait);
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
    const parentElement = this.monacoElement.nativeElement.parentElement;
    if (parentElement) {
      setTimeout(() =>
        this.codeEditorInstance.layout({
          height: parentElement.offsetHeight,
          width:
            parentElement.offsetWidth - parentElement.children[0].offsetWidth,
        })
      );
    }
  }

  initializeThemeObserver(): void {
    this.settingsSubscription = this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.onThemeChange(settings);
      },
    });
  }

  onThemeChange(settings: Settings): void {
    this.codeEditorInstance.updateOptions({
      theme: settings.darkMode ? 'vs-dark' : 'vs-light',
    });
  }
}
