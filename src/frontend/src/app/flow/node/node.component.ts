import { AfterViewInit, Component, Input, HostBinding } from '@angular/core';
import { Node } from './node';
import { EndpointOptions, jsPlumbInstance } from 'jsplumb';
import { NgxSmartModalService } from 'ngx-smart-modal';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
})
export class NodeComponent implements AfterViewInit {
  @Input() node!: Node;
  @Input() jsPlumbInstance!: jsPlumbInstance;
  @HostBinding('class') public cssClass: any;

  constructor(public ngxSmartModalService: NgxSmartModalService) {}

  private dropOptions = {
    tolerance: 'touch',
    hoverClass: 'dropHover',
    activeClass: 'dragActive',
  };

  private dragOptions = {
    containment: 'canvas',
  };

  private bottomEndpointOptions: EndpointOptions = {
    endpoint: ['Dot', { radius: 7 }],
    paintStyle: { fill: '#99cb3a' },
    isSource: true,
    scope: 'jsPlumb_DefaultScope',
    connectorStyle: { stroke: '#99cb3a', strokeWidth: 3 },
    connector: ['Bezier', { curviness: 63 }],
    maxConnections: 30,
    isTarget: false,
    connectorOverlays: [['Arrow', { location: 1 }]],
    dropOptions: this.dropOptions,
  };

  private topEndpointOptions: EndpointOptions = {
    endpoint: ['Dot', { radius: 4 }],
    paintStyle: { fill: '#ffcb3a' },
    isSource: false,
    scope: 'jsPlumb_DefaultScope',
    maxConnections: 1,
    isTarget: true,
    dropOptions: this.dropOptions,
  };

  ngAfterViewInit(): void {
    const { id } = this.node;

    this.jsPlumbInstance.addEndpoint(
      id,
      {
        anchor: 'Bottom',
        uuid: id + '_bottom',
        maxConnections: 1,
      },
      this.bottomEndpointOptions
    );

    this.jsPlumbInstance.addEndpoint(
      id,
      { anchor: 'Top', uuid: id + '_top', maxConnections: 1 },
      this.topEndpointOptions
    );

    this.jsPlumbInstance.draggable(id, this.dragOptions);
  }

  openOptions(): void {
    this.ngxSmartModalService
      .getModal('optionsModal')
      .setData(this.node, true)
      .open();
  }
}
