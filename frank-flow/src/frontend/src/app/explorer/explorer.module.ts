import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../shared/components/shared.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { ExplorerComponent } from './explorer.component';

@NgModule({
  declarations: [ExplorerComponent],
  exports: [ExplorerComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    FontAwesomeModule,
    NgxSmartModalModule,
  ],
})
export class ExplorerModule {}
