import { Injectable } from '@angular/core';
import { CurrentFileService } from './current-file.service';
import { File } from '../models/file.model';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import { FlowStructureService } from './flow-structure.service';

@Injectable({
  providedIn: 'root',
})
export class FlowNamespaceService {
  public monacoEditorComponent?: MonacoEditorComponent;
  private currentFile!: File;

  constructor(
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService
  ) {
    this.getCurrentFile();
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
    return !!this.currentFile.flowStructure?.configuration?.attributes[
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
