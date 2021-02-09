import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './header.component';
import { SharedModule } from '../shared/shared.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ModeComponent } from './modes/mode.component';

@NgModule({
  declarations: [HeaderComponent, ModeComponent],
  exports: [HeaderComponent],
  imports: [CommonModule, SharedModule, FontAwesomeModule],
})
export class HeaderModule {}
