import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './header.component';
import { SharedModule } from '../shared/components/shared.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ModeComponent } from './modes/mode.component';
import { SettingsComponent } from './settings/settings.component';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { FormsModule } from '@angular/forms';
import { jqxTreeModule } from 'jqwidgets-ng/jqxtree';
import { jqxDropDownButtonModule } from 'jqwidgets-ng/jqxdropdownbutton';

@NgModule({
  declarations: [HeaderComponent, ModeComponent, SettingsComponent],
  exports: [HeaderComponent],
  imports: [
    CommonModule,
    SharedModule,
    FontAwesomeModule,
    NgxSmartModalModule,
    FormsModule,
    jqxTreeModule,
    jqxDropDownButtonModule,
  ],
})
export class HeaderModule {}
