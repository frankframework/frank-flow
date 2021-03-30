import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button/button.component';
import { ToggleComponent } from './toggle/toggle.component';
import { FormsModule } from '@angular/forms';
import { FileTreeComponent } from './file-tree/file-tree.component';
import { jqxTreeModule } from 'jqwidgets-ng/jqxtree';

@NgModule({
  declarations: [ButtonComponent, ToggleComponent, FileTreeComponent],
  exports: [ButtonComponent, ToggleComponent, FileTreeComponent],
  imports: [CommonModule, FormsModule, jqxTreeModule],
})
export class SharedModule {}
