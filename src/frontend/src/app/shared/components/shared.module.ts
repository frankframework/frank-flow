import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button/button.component';
import { ToggleComponent } from './toggle/toggle.component';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [ButtonComponent, ToggleComponent],
  exports: [ButtonComponent, ToggleComponent],
  imports: [CommonModule, FormsModule],
})
export class SharedModule {}
