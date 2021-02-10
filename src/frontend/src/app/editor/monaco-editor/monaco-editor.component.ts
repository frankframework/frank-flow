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
import { editor } from 'monaco-editor';
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;

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

  codeEditorInstance!: IStandaloneCodeEditor;
  resizeInterval!: number;

  constructor(private monacoElement: ElementRef) {}

  ngOnChanges(): void {
    if (this.codeEditorInstance) {
      this.codeEditorInstance.setValue(this.code);
    }
  }

  ngAfterViewInit(): void {
    if (loadedMonaco) {
      // Wait until monaco editor is available
      loadPromise.then(() => {
        this.initMonaco();
      });
    } else {
      loadedMonaco = true;
      loadPromise = new Promise<void>((resolve: any) => {
        if (typeof (window as any).monaco === 'object') {
          resolve();
          return;
        }
        const onAmdLoader: any = () => {
          // Load monaco
          (window as any).require.config({ paths: { vs: 'assets/monaco/vs' } });

          (window as any).require(['vs/editor/editor.main'], () => {
            this.initMonaco();
            resolve();
          });
        };

        // Load AMD loader if necessary
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

  ngOnDestroy(): void {
    clearInterval(this.resizeInterval);
  }

  initMonaco(): void {
    this.codeEditorInstance = editor.create(
      this.editorContainer.nativeElement,
      {
        value: this.code,
        language: 'xml',
        theme: 'vs-dark',
      }
    );

    this.resizeInterval = setInterval(() => this.onResize(), 100);

    const model = this.codeEditorInstance.getModel();
    if (model) {
      model.onDidChangeContent((e) => {
        this.codeChange.emit(this.codeEditorInstance.getValue());
      });
    }
  }

  onResize(): void {
    const parentElement = this.monacoElement.nativeElement.parentElement;
    if (parentElement) {
      this.codeEditorInstance.layout({
        height: parentElement.offsetHeight,
        width:
          parentElement.offsetWidth - parentElement.children[0].offsetWidth,
      });
    }
  }
}
