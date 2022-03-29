import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button/button.component';
import { ToggleComponent } from './toggle/toggle.component';
import { FormsModule } from '@angular/forms';
import { FileTreeComponent } from './file-tree/file-tree.component';
import { jqxTreeModule } from 'jqwidgets-ng/jqxtree';
import { SaveDialogComponent } from './save-dialog/save-dialog.component';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { AddDialogComponent } from './add-dialog/add-dialog.component';
import { EditDialogComponent } from './edit-dialog/edit-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';

@NgModule({
  declarations: [
    ButtonComponent,
    ToggleComponent,
    FileTreeComponent,
    SaveDialogComponent,
    AddDialogComponent,
    EditDialogComponent,
    ConfirmDialogComponent,
  ],
  exports: [
    ButtonComponent,
    ToggleComponent,
    FileTreeComponent,
    SaveDialogComponent,
    AddDialogComponent,
    EditDialogComponent,
    ConfirmDialogComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    jqxTreeModule,
    NgxSmartModalModule.forChild(),
  ],
})
export class SharedModule {}
