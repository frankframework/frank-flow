import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowComponent } from './flow.component';
import { CanvasComponent } from './canvas/canvas.component';
import { PaletteModule } from './palette/palette.module';
import { NodeComponent } from './node/node.component';

@NgModule({
  declarations: [FlowComponent, CanvasComponent, NodeComponent],
  exports: [FlowComponent],
  imports: [CommonModule, PaletteModule],
})
export class FlowModule {}
