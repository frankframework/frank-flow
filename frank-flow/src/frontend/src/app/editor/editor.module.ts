import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorComponent } from './editor.component';
import { FormsModule } from '@angular/forms';
import { ExplorerComponent } from './explorer/explorer.component';
import { MonacoEditorComponent } from './monaco-editor/monaco-editor.component';
import { SharedModule } from '../shared/components/shared.module';

@NgModule({
  declarations: [EditorComponent, ExplorerComponent, MonacoEditorComponent],
  exports: [EditorComponent],
  imports: [CommonModule, FormsModule, SharedModule],
})
export class EditorModule {}
