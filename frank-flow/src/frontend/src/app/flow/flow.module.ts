import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowComponent } from './flow.component';
import { CanvasComponent } from './canvas/canvas.component';
import { PaletteModule } from './palette/palette.module';
import { NodeComponent } from './node/node.component';
import { OptionsComponent } from './options/options.component';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { SharedModule } from '../shared/components/shared.module';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxPanZoomModule } from 'ngx-panzoom';
import { ActionsComponent } from './actions/actions.component';
import { NestedElementComponent } from './options/nested-element/nested-element.component';
import { AdapterSelectorComponent } from './adapter-selector/adapter-selector.component';

@NgModule({
  declarations: [
    FlowComponent,
    CanvasComponent,
    NodeComponent,
    OptionsComponent,
    ActionsComponent,
    AdapterSelectorComponent,
    NestedElementComponent,
  ],
  exports: [FlowComponent],
  imports: [
    CommonModule,
    PaletteModule,
    NgxSmartModalModule.forChild(),
    SharedModule,
    FormsModule,
    FontAwesomeModule,
    NgxPanZoomModule,
  ],
})
export class FlowModule {}
