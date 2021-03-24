import { Component, OnInit, HostBinding, HostListener } from '@angular/core';
import { NodeService } from './node/node.service';
import { PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements OnInit {
  nodes = [];

  connections = [];
  private panZoomConfigOptions: PanZoomConfigOptions = {
    zoomLevels: 10,
    zoomStepDuration: 10.2,
    freeMouseWheelFactor: 0.01,
    zoomToFitZoomLevelFactor: 0.5,
    dragMouseButton: 'left',
  };
  panzoomConfig: PanZoomConfig = new PanZoomConfig(this.panZoomConfigOptions);

  constructor(private nodeService: NodeService) {}

  ngOnInit(): void {
    this.fillFromJson();
  }

  fillFromJson(): void {
    const json = `{"nodes":[
    {"id":"Transform","name":"Transform","top":177,"left":146},
    {"id":"FixedResultPipe","name":"FixedResultPipe","top":302,"left":130},
    {"id":"JavaListener","name":"JavaListener","top":41,"left":158}],
    "connections":[
    {"uuids":["Transform_bottom","FixedResultPipe_top"]},
    {"uuids":["JavaListener_bottom","Transform_top"]}
    ]}`;
    const data = JSON.parse(json);

    this.nodes = data.nodes;
    this.connections = data.connections;
  }
}
