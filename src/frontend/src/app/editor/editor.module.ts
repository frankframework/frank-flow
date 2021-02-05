import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorComponent } from './editor.component';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { FormsModule } from '@angular/forms';
import { TreeviewModule } from 'ngx-treeview';
import { ExplorerComponent } from './explorer/explorer.component';

@NgModule({
  declarations: [EditorComponent, ExplorerComponent],
  exports: [EditorComponent],
  imports: [CommonModule, MonacoEditorModule, FormsModule, TreeviewModule],
})
export class EditorModule {}
