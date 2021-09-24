/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { ModeService } from '../../header/modes/mode.service';
import { SettingsService } from '../../header/settings/settings.service';
import { Settings } from '../../header/settings/settings.model';
import { File } from '../../shared/models/file.model';
import { CodeService } from '../../shared/services/code.service';
import { FileService } from '../../shared/services/file.service';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';

let loadedMonaco = false;
let loadPromise: Promise<void>;

@Component({
  selector: 'app-monaco-editor',
  templateUrl: './monaco-editor.component.html',
  styleUrls: ['./monaco-editor.component.scss'],
})
export class MonacoEditorComponent
  implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('editorContainer') editorContainer!: ElementRef;

  @Input() code = '';
  @Output() codeChange = new EventEmitter<string>();

  codeEditorInstance!: monaco.editor.IStandaloneCodeEditor;
  currentFile = new File();
  fileObservableUpdate = false;

  currentFileSubscription!: Subscription;
  modeSubscription!: Subscription;
  settingsSubscription!: Subscription;

  updateQueue: File[] = [];

  constructor(
    private monacoElement: ElementRef,
    private modeService: ModeService,
    private settingsService: SettingsService,
    private codeService: CodeService,
    private fileService: FileService,
    private toastr: ToastrService,
    private flowStructureService: FlowStructureService
  ) {
    this.flowStructureService.setEditorComponent(this);
  }

  ngAfterViewInit(): void {
    this.loadMonaco();
  }

  ngOnChanges(): void {
    if (this.codeEditorInstance) {
      this.codeEditorInstance.setValue(this.code);
    }
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
    this.initUpdateQueue();
    this.initializeTwoWayBinding();
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
      id: 'memento-undo-action',
      label: 'Undo',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_Z],
      contextMenuGroupId: 'memento',
      contextMenuOrder: 2,
      run: () => this.setValue(this.codeService.undo()),
    });

    this.codeEditorInstance.addAction({
      id: 'memento-redo-action',
      label: 'Redo',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_Y],
      contextMenuGroupId: 'memento',
      contextMenuOrder: 3,
      run: () => this.setValue(this.codeService.redo()),
    });
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
    this.codeService.save();
  }

  initializeFile(): void {
    this.setValue(this.codeService.getCurrentFile());
  }

  setValue(file: File | undefined): void {
    if (file?.data != null) {
      const position = this.codeEditorInstance.getPosition();
      this.currentFile = file;
      this.codeEditorInstance.getModel()?.setValue(file.data);
      if (position) {
        this.codeEditorInstance.setPosition(position);
      }
    }
  }

  applyEdit(range: monaco.IRange, text: string, flowUpdate: boolean): void {
    const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];

    const editOperation: monaco.editor.IIdentifiedSingleEditOperation = {
      range,
      text,
    };

    editOperations.push(editOperation);

    this.fileObservableUpdate = flowUpdate;
    this.codeEditorInstance.getModel()?.applyEdits(editOperations);
  }

  initializeTwoWayBinding(): void {
    const model = this.codeEditorInstance.getModel();

    if (model) {
      model.onDidChangeContent(
        this.debounce(() => {
          if (this.currentFile && !this.fileObservableUpdate) {
            this.fileObservableUpdate = true;
            this.currentFile.data = this.codeEditorInstance.getValue();
            this.currentFile.saved = false;
            this.codeService.setCurrentFile(this.currentFile);
          } else {
            this.fileObservableUpdate = false;
          }
        }, 500)
      );
    }
    this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
      {
        next: (file: File) => {
          if (file.data != null) {
            this.updateQueue.push(file);
            this.currentFile = file;
          }
        },
      }
    );
  }

  // TODO: Refactor: Only run que when there are items in it. Update que based on observer, not on interval.
  initUpdateQueue(): void {
    setInterval(() => {
      const file = this.updateQueue.shift();
      if (file && file.data != null && !this.fileObservableUpdate) {
        this.fileObservableUpdate = true;
        this.setValue(file);
      } else if (file && this.fileObservableUpdate) {
        this.fileObservableUpdate = false;
      }
    }, 510);
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
