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

  constructor(
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService
  ) {
    this.getflowStructure();
  }

  getflowStructure(): void {
    this.currentFileService.currentFileObservable.subscribe({
      next: (currentFile: File): void => {
        this.currentFile = currentFile;
      },
    });
  }

  handleNameSpace() {
    if (this.checkNameSpace()) {
      return;
    }
    this.setNameSpace();
  }

  checkNameSpace(): boolean {
    return !!this.currentFile.flowStructure?.configuration?.attributes[
      'xmlns:flow'
    ];
  }

  setNameSpace() {
    this.flowStructureService.setFlowSetting('xmlns:flow', 'urn:frank-flow');
  }
}
