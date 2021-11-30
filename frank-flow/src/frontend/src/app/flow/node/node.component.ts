import {
  AfterViewInit,
  Component,
  HostBinding,
  HostListener,
  Input,
} from '@angular/core';
import { Node } from './nodes/node.model';
import {
  AnchorSpec,
  ConnectorSpec,
  EndpointOptions,
  jsPlumbInstance,
} from 'jsplumb';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { faCloudDownloadAlt } from '@fortawesome/free-solid-svg-icons';
import { SettingsService } from 'src/app/header/settings/settings.service';
import { Settings } from 'src/app/header/settings/settings.model';
import { ConnectionType } from 'src/app/header/settings/options/connection-type';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
})
export class NodeComponent implements AfterViewInit {
  @Input() node!: Node;
  @Input() jsPlumbInstance!: jsPlumbInstance;
  @Input() generating!: boolean;
  @HostBinding('class') public cssClass: any;
  @HostBinding('style') public style: any;

  @HostListener('dblclick') onDoubleClick(): void {
    this.openOptions();
  }
  @HostListener('click') onClick(): void {
    this.flowStructureService.highlightPipe(
      this.node.getName(),
      this.node.getType()
    );
  }

  settings!: Settings;
  cloud = faCloudDownloadAlt;

  constructor(
    public ngxSmartModalService: NgxSmartModalService,
    public flowStructureService: FlowStructureService,
    public settingsService: SettingsService
  ) {
    this.getSettings();
  }

  ngAfterViewInit(): void {
    const id = this.node.getId();
    const topEndpointOptions = this.getTopendpointOptions();
    const bottomEndpointOptions = this.getBottomEndpointOptions();

    this.nodeIsListener()
      ? this.makeNodeListener(bottomEndpointOptions)
      : this.makeNodeTarget(topEndpointOptions, id);
    if (this.nodeIsNotExit()) {
      this.makeNodeSource(bottomEndpointOptions, id);
    }

    this.jsPlumbInstance.draggable(id, this.getDragOptions());
  }

  nodeIsNotExit() {
    return this.cssClass !== 'shape--round color--danger';
  }

  nodeIsListener() {
    return this.cssClass === 'shape--oval color--info';
  }

  makeNodeListener(bottomEndpointOptions: EndpointOptions): void {
    bottomEndpointOptions.isSource = false;
    bottomEndpointOptions.connectionsDetachable = false;
  }

  makeNodeSource(bottomEndpointOptions: EndpointOptions, id: string): void {
    this.jsPlumbInstance.addEndpoint(
      id,
      {
        anchor: this.getSourceAnchor(),
        uuid: id + '_bottom',
        maxConnections: -1,
      },
      bottomEndpointOptions
    );
  }

  makeNodeTarget(topEndpointOptions: EndpointOptions, id: string): void {
    this.jsPlumbInstance.addEndpoint(
      id,
      { anchor: this.getTargetAnchor(), uuid: id + '_top', maxConnections: -1 },
      topEndpointOptions
    );
  }

  getSourceAnchor(): AnchorSpec {
    return this.settings.verticalConnectors ? 'Bottom' : 'RightMiddle';
  }

  getTargetAnchor(): AnchorSpec {
    return this.settings.verticalConnectors ? 'Top' : 'LeftMiddle';
  }

  getTopendpointOptions(): EndpointOptions {
    return {
      endpoint: ['Dot', { radius: 7 }],
      paintStyle: { fill: '#ffcb3a' },
      isSource: false,
      scope: 'jsPlumb_DefaultScope',
      maxConnections: 1,
      isTarget: true,
      dropOptions: this.getDropOptions(),
    };
  }

  getBottomEndpointOptions(): EndpointOptions {
    return {
      endpoint: ['Dot', { radius: 10 }],
      paintStyle: { fill: '#99cb3a' },
      isSource: true,
      scope: 'jsPlumb_DefaultScope',
      connectorStyle: { stroke: '#99cb3a', strokeWidth: 3 },
      connector: this.getConnector(),
      maxConnections: 30,
      isTarget: false,
      connectorOverlays: [['Arrow', { location: 1 }]],
      dropOptions: this.getDropOptions(),
    };
  }

  getDragOptions(): any {
    return {
      tolerance: 'touch',
      hoverClass: 'dropHover',
      activeClass: 'dragActive',
    };
  }

  getDropOptions(): any {
    return {
      containment: 'canvas',
      grid: [20, 20],
      stop: (e: any) => {
        this.handleDragStop(e);
      },
    };
  }

  getConnector(): ConnectorSpec {
    switch (+this.settings.connectionType) {
      case ConnectionType.flowchart:
        return ['Flowchart', { alwaysRespectStubs: true, cornerRadius: 25 }];
      case ConnectionType.bezier:
        return [
          'Bezier',
          {
            alwaysRespectStubs: true,
            cornerRadius: 10,
            stub: [10, 50],
            midpoint: 0.0001,
          },
        ];
      default:
        return ['Straight', {}];
    }
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  handleDragStop(e: any): void {
    if (this.nodeHasClass(e, 'color--info')) {
      this.flowStructureService.editListenerPositions(
        e.el.id,
        e.pos[0],
        e.pos[1]
      );
    } else if (this.nodeHasClass(e, 'color--danger')) {
      this.flowStructureService.editExitPositions(e.el.id, e.pos[0], e.pos[1]);
    } else {
      this.flowStructureService.editPipePositions(e.el.id, e.pos[0], e.pos[1]);
    }
  }

  nodeHasClass(e: any, className: string) {
    return e.el.classList[0] === className;
  }

  openOptions(): void {
    this.ngxSmartModalService
      .getModal('optionsModal')
      .setData(this.node, true)
      .open();
  }
}
