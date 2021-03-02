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
import { Settings } from '../../header/settings/settings';

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
  resizeInterval!: number;

  constructor(
    private monacoElement: ElementRef,
    private modeService: ModeService,
    private settingsService: SettingsService
  ) {}

  ngAfterViewInit(): void {
    this.loadMonaco();
  }

  ngOnChanges(): void {
    if (this.codeEditorInstance) {
      this.codeEditorInstance.setValue(this.code);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.resizeInterval);
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
    this.initializeTwoWayBinding();
    this.initializeResizeObserver();
    this.initializeThemeObserver();
  }

  initializeEditor(): void {
    this.codeEditorInstance = monaco.editor.create(
      this.editorContainer.nativeElement,
      {
        value: this.code,
        language: 'xml',
        theme: 'vs-dark',
      }
    );
  }

  initializeTwoWayBinding(): void {
    const model = this.codeEditorInstance.getModel();
    if (model) {
      model.onDidChangeContent((e) => {
        this.codeChange.emit(this.codeEditorInstance.getValue());
      });
    }
  }

  initializeResizeObserver(): void {
    this.modeService.getMode().subscribe({
      next: () => {
        this.onResize();
      },
    });
  }

  onResize(): void {
    const parentElement = this.monacoElement.nativeElement.parentElement;
    if (parentElement) {
      setTimeout(() => {
        this.codeEditorInstance.layout({
          height: parentElement.offsetHeight,
          width:
            parentElement.offsetWidth - parentElement.children[0].offsetWidth,
        });
      }, 10);
    }
  }

  initializeThemeObserver(): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.onThemeChange(settings);
      },
    });
  }

  onThemeChange(settings: Settings): void {
    this.codeEditorInstance.updateOptions({
      theme: settings.darkmode ? 'vs-dark' : 'vs-light',
    });
  }
}
