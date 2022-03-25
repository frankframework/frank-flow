import { Injectable } from '@angular/core';
import { CurrentFileService } from './current-file.service';
import { File } from '../../shared/models/file.model';
import { FlowStructure } from '../models/flow-structure.model';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import { FlowStructureService } from './flow-structure.service';

@Injectable({
  providedIn: 'root',
})
export class FlowNamespaceService {
  public monacoEditorComponent?: MonacoEditorComponent;
  private currentFile!: File;
  private flowStructure!: FlowStructure;

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
        if (currentFile.flowStructure) {
          this.flowStructure = currentFile.flowStructure;
        }
      },
    });
  }

  handleNameSpace() {
    if (!this.checkNameSpace()) {
      return;
    }
    this.setNameSpace();
  }

  checkNameSpace(): boolean {
    if (this.flowStructure.configuration !== undefined) {
      for (const [attributeKey] of Object.entries(
        this.flowStructure.configuration?.attributes
      )) {
        if (attributeKey === 'xmlns:flow') {
          return false;
        }
      }
    }
    return true;
  }

  setNameSpace() {
    const configuration = this.flowStructure.configuration;

    if (configuration) {
      this.flowStructureService.setFlowSetting('xmlns:flow', 'urn:frank-flow');
    }
  }
}
