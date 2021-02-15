import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowComponent } from './flow.component';
import { CanvasComponent } from './canvas/canvas.component';
import { PaletteModule } from './palette/palette.module';
import { NodeComponent } from './node/node.component';
import { OptionsComponent } from './options/options.component';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    FlowComponent,
    CanvasComponent,
    NodeComponent,
    OptionsComponent,
  ],
  exports: [FlowComponent],
  imports: [
    CommonModule,
    PaletteModule,
    NgxSmartModalModule.forChild(),
    SharedModule,
  ],
})
export class FlowModule {}
