import { Injectable } from '@angular/core';
import { CurrentFileService } from './current-file.service';
import { File } from '../models/file.model';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import { FlowStructureService } from './flow-structure.service';
import { Adapter } from '../models/adapter.model';
import { CurrentAdapterService } from './current-adapter.service';

@Injectable({
  providedIn: 'root',
})
export class FlowNamespaceService {
  public monacoEditorComponent?: MonacoEditorComponent;
  private currentFile!: File;
  private currentAdapter!: Adapter;

  constructor(
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService,
    private currentAdapterService: CurrentAdapterService
  ) {
    this.getCurrentFile();
    this.getCurrentAdapter();
  }

  getCurrentAdapter(): void {
    this.currentAdapterService.currentAdapterObservable.subscribe({
      next: (adapter: Adapter): void => {
        this.currentAdapter = adapter;
      },
    });
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe({
      next: (currentFile: File): void => {
        this.currentFile = currentFile;
      },
    });
  }

  handleNameSpace() {
    if (!this.namespacePresent()) {
      this.setNameSpace();
    }
  }

  namespacePresent(): boolean {
    return !!this.currentAdapter.flowStructure?.configuration?.attributes[
      'xmlns:flow'
    ];
  }

  setNameSpace() {
    this.flowStructureService.setFlowSetting(
      'xmlns:flow',
      'urn:frank-flow',
      false
    );
  }
}
