import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../shared/components/shared.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { ExplorerComponent } from './explorer.component';
import { CustomFileTreeComponent } from './file-tree/custom-file-tree.component';
import { FileTreeIconComponent } from './file-tree-icon/file-tree-icon.component';
import { FileTreeItemComponent } from './file-tree-item/file-tree-item.component';

@NgModule({
  declarations: [
    ExplorerComponent,
    CustomFileTreeComponent,
    FileTreeIconComponent,
    FileTreeItemComponent,
  ],
  exports: [ExplorerComponent, CustomFileTreeComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    FontAwesomeModule,
    NgxSmartModalModule,
  ],
})
export class ExplorerModule {}
