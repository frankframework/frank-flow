import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorComponent } from './editor.component';
import { FormsModule } from '@angular/forms';
import { ExplorerComponent } from './explorer/explorer.component';
import { MonacoEditorComponent } from './monaco-editor/monaco-editor.component';
import { SharedModule } from '../shared/components/shared.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { AddDialogComponent } from './explorer/add-dialog/add-dialog.component';

@NgModule({
  declarations: [
    AddDialogComponent,
    EditorComponent,
    ExplorerComponent,
    MonacoEditorComponent,
  ],
  exports: [EditorComponent, AddDialogComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    FontAwesomeModule,
    NgxSmartModalModule,
  ],
})
export class EditorModule {}
