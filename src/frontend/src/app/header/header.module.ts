import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './header.component';
import { SharedModule } from '../shared/shared.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ModesComponent } from './modes/modes.component';

@NgModule({
  declarations: [HeaderComponent, ModesComponent],
  exports: [HeaderComponent],
  imports: [CommonModule, SharedModule, FontAwesomeModule],
})
export class HeaderModule {}
