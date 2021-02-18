import { Component, OnInit } from '@angular/core';
import { NodeService } from './node/node.service';

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements OnInit {
  nodes = [];

  connections = [];

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
