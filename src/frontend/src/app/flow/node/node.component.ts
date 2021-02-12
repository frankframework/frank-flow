import { AfterViewInit, Component, Input } from '@angular/core';
import { Node } from './node';
import { EndpointOptions, jsPlumbInstance } from 'jsplumb';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
})
export class NodeComponent implements AfterViewInit {
  @Input() node!: Node;
  @Input() jsPlumbInstance!: jsPlumbInstance;

  ngAfterViewInit(): void {
    const dropOptions = {
      tolerance: 'touch',
      hoverClass: 'dropHover',
      activeClass: 'dragActive',
    };
    const bottomEndpointOptions: EndpointOptions = {
      endpoint: ['Dot', { radius: 7 }],
      paintStyle: { fill: '#99cb3a' },
      isSource: true,
      scope: 'jsPlumb_DefaultScope',
      connectorStyle: { stroke: '#99cb3a', strokeWidth: 3 },
      connector: ['Bezier', { curviness: 63 }],
      maxConnections: 30,
      isTarget: false,
      connectorOverlays: [['Arrow', { location: 1 }]],
      dropOptions,
    };
    const topEndpointOptions: EndpointOptions = {
      endpoint: ['Dot', { radius: 4 }],
      paintStyle: { fill: '#ffcb3a' },
      isSource: false,
      scope: 'jsPlumb_DefaultScope',
      maxConnections: 1,
      isTarget: true,
      dropOptions,
    };
    const { id } = this.node;
    this.jsPlumbInstance.addEndpoint(
      id,
      {
        anchor: 'Bottom',
        uuid: id + '_bottom',
        maxConnections: 1,
      },
      bottomEndpointOptions
    );
    this.jsPlumbInstance.addEndpoint(
      id,
      { anchor: 'Top', uuid: id + '_top', maxConnections: 1 },
      topEndpointOptions
    );
    this.jsPlumbInstance.draggable(id);
  }
}
