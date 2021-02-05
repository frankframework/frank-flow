import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowComponent } from './flow.component';
import { CanvasComponent } from './canvas/canvas.component';
import { PaletteModule } from './palette/palette.module';

@NgModule({
  declarations: [FlowComponent, CanvasComponent],
  exports: [FlowComponent],
  imports: [CommonModule, PaletteModule],
})
export class FlowModule {}
