import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorComponent } from './editor.component';
import { FormsModule } from '@angular/forms';
import { TreeviewModule } from 'ngx-treeview';
import { ExplorerComponent } from './explorer/explorer.component';
import { MonacoEditorComponent } from './monaco-editor/monaco-editor.component';

@NgModule({
  declarations: [EditorComponent, ExplorerComponent, MonacoEditorComponent],
  exports: [EditorComponent],
  imports: [CommonModule, FormsModule, TreeviewModule],
})
export class EditorModule {}
