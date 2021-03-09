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

import { CodeService } from '../../services/code.service';

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

  constructor(
    private monacoElement: ElementRef,
    private modeService: ModeService,
    private settingsService: SettingsService,
    private codeService: CodeService
  ) {}

  ngAfterViewInit(): void {
    this.loadMonaco();
  }

  ngOnChanges(): void {
    if (this.codeEditorInstance) {
      this.codeEditorInstance.setValue(this.code);
    }
  }

  ngOnDestroy(): void {}

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
    this.code = `<Configuration name="dd">
    <Adapter name="ddAdapter"> 
      <Receiver name="ddReceiver"> 
        <JavaListener name="ddListener" serviceName="ddService"  x="681" y="24" />
      </Receiver>
      <Pipeline firstPipe="ddPipe">
        <FixedResultPipe name="ddPipe" returnString="Hello World" x="100" y="50">
          <Forward name="success" path="EXIT"/> 
        </FixedResultPipe>
        <DelayPipe name="otherPipe" returnString="Hello World" x="100" y="250">
          <Forward name="success" path="EXIT"/> 
        </DelayPipe> 
        <XmlSwitchPipe name="switchXML" x="100" y="450">
          <Forward name="success" path="EXIT"/>
          <Forward name="error" path="err"/>
        </XmlSwitchPipe>
        <Exit path="EXIT" state="success" x="223" y="625"/> 
      </Pipeline> 
    </Adapter>
  </Configuration>
  `;

    this.codeEditorInstance = monaco.editor.create(
      this.editorContainer.nativeElement,
      {
        value: this.code,
        language: 'xml',
        theme: 'vs-dark',
      }
    );
    this.codeService.setEditor(this.codeEditorInstance);
  }

  initializeTwoWayBinding(): void {
    const model = this.codeEditorInstance.getModel();
    if (model) {
      model.onDidChangeContent(
        this.debounce(
          () =>
            this.codeService.setCurrentFile(this.codeEditorInstance.getValue()),
          500
        )
      );
    }
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
    this.modeService.getMode().subscribe({
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
