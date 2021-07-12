import { Component } from '@angular/core';
import { NodeService } from './node/node.service';
import { PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent {
  nodes = [];
  connections = [];
  private panZoomConfigOptions: PanZoomConfigOptions = {
    zoomLevels: 10,
    zoomStepDuration: 10.2,
    freeMouseWheelFactor: 0.01,
    zoomToFitZoomLevelFactor: 0.5,
    dragMouseButton: 'left',
    keepInBounds: true,
  };
  panzoomConfig: PanZoomConfig = new PanZoomConfig(this.panZoomConfigOptions);

  constructor(private nodeService: NodeService) {}
}
