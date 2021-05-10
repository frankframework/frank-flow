import {
  AfterViewInit,
  Component,
  HostBinding,
  HostListener,
  Input,
  Pipe,
} from '@angular/core';
import { Node } from './nodes/node.model';
import { EndpointOptions, jsPlumbInstance } from 'jsplumb';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
})
export class NodeComponent implements AfterViewInit {
  private dropOptions = {
    tolerance: 'touch',
    hoverClass: 'dropHover',
    activeClass: 'dragActive',
  };

  private dragOptions = {
    containment: 'canvas',
    stop: (e: any) => {
      if (e.el.classList[0] === 'color--info') {
        this.flowStructureService.editListenerPositions(
          e.el.id,
          e.pos[0],
          e.pos[1]
        );
      } else if (e.el.classList[0] === 'color--danger') {
        this.flowStructureService.editExitPositions(
          e.el.id,
          e.pos[0],
          e.pos[1]
        );
      } else {
        this.flowStructureService.editPipePositions(
          e.el.id,
          e.pos[0],
          e.pos[1]
        );
      }
    },
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

  @Input() node!: Node;
  @Input() jsPlumbInstance!: jsPlumbInstance;
  @Input() generating!: boolean;
  @HostBinding('class') public cssClass: any;
  @HostBinding('style') public style: any;

  @HostListener('dblclick') onDoubleClick(): void {
    this.openOptions();
  }

  constructor(
    public ngxSmartModalService: NgxSmartModalService,
    public flowStructureService: FlowStructureService
  ) {}

  ngAfterViewInit(): void {
    const id = this.node.getId();

    this.jsPlumbInstance.addEndpoint(
      id,
      {
        anchor: 'Bottom',
        uuid: id + '_bottom',
        maxConnections: -1,
      },
      this.bottomEndpointOptions
    );

    this.jsPlumbInstance.addEndpoint(
      id,
      { anchor: 'Top', uuid: id + '_top', maxConnections: -1 },
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
