import {
  AfterViewInit,
  Component,
  HostBinding,
  HostListener,
  Input,
} from '@angular/core';
import { Node } from './nodes/node.model';
import { EndpointOptions, jsPlumbInstance } from 'jsplumb';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { faCloudDownloadAlt } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
})
export class NodeComponent implements AfterViewInit {
  cloud = faCloudDownloadAlt;
  @Input() node!: Node;
  @Input() jsPlumbInstance!: jsPlumbInstance;
  @Input() generating!: boolean;
  @HostBinding('class') public cssClass: any;
  @HostBinding('style') public style: any;
  private dropOptions = {
    tolerance: 'touch',
    hoverClass: 'dropHover',
    activeClass: 'dragActive',
  };
  private dragOptions = {
    containment: 'canvas',
    grid: [20, 20],
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
    endpoint: ['Dot', { radius: 10 }],
    paintStyle: { fill: '#99cb3a' },
    isSource: true,
    scope: 'jsPlumb_DefaultScope',
    connectorStyle: { stroke: '#99cb3a', strokeWidth: 3 },
    connector: [
      'Bezier',
      {
        alwaysRespectStubs: true,
        cornerRadius: 10,
        stub: [10, 50],
        midpoint: 0.0001,
      },
    ],
    maxConnections: 30,
    isTarget: false,
    connectorOverlays: [['Arrow', { location: 1 }]],
    dropOptions: this.dropOptions,
  };
  private topEndpointOptions: EndpointOptions = {
    endpoint: ['Dot', { radius: 7 }],
    paintStyle: { fill: '#ffcb3a' },
    isSource: false,
    scope: 'jsPlumb_DefaultScope',
    maxConnections: 1,
    isTarget: true,
    dropOptions: this.dropOptions,
  };

  constructor(
    public ngxSmartModalService: NgxSmartModalService,
    public flowStructureService: FlowStructureService
  ) {}

  @HostListener('dblclick') onDoubleClick(): void {
    this.openOptions();
  }

  ngAfterViewInit(): void {
    const id = this.node.getId();

    if (this.cssClass === 'shape--oval color--info') {
      this.bottomEndpointOptions.isSource = false;
      this.bottomEndpointOptions.connectionsDetachable = false;
    } else {
      this.jsPlumbInstance.addEndpoint(
        id,
        { anchor: 'Top', uuid: id + '_top', maxConnections: -1 },
        this.topEndpointOptions
      );
    }

    if (this.cssClass !== 'shape--round color--danger') {
      this.jsPlumbInstance.addEndpoint(
        id,
        {
          anchor: 'Bottom',
          uuid: id + '_bottom',
          maxConnections: -1,
        },
        this.bottomEndpointOptions
      );
    }

    this.jsPlumbInstance.draggable(id, this.dragOptions);
  }

  openOptions(): void {
    this.ngxSmartModalService
      .getModal('optionsModal')
      .setData(this.node, true)
      .open();
  }
}
