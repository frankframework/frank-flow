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
  DragOptions,
  DropOptions,
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
  @Input() public node!: Node;
  @Input() public jsPlumbInstance!: jsPlumbInstance;
  @Input() public generating!: boolean;
  @HostBinding('style') public style?: string;
  @HostBinding('class') public cssClass?: string;
  @HostBinding('class.isActive')
  public get isActive() {
    return this.flowStructureService.selectedNode?.uid === this.node?.getId();
  }

  public readonly cloud = faCloudDownloadAlt;

  private readonly bezierConnectionSpecification: ConnectorSpec = [
    'Bezier',
    {
      alwaysRespectStubs: true,
      cornerRadius: 10,
      stub: [10, 50],
      midpoint: 0.0001,
    },
  ];
  private readonly flowchartConnectionSpecification: ConnectorSpec = [
    'Flowchart',
    { alwaysRespectStubs: true, cornerRadius: 25 },
  ];
  private readonly straightConnectionSpecification: ConnectorSpec = [
    'Straight',
    {},
  ];
  private readonly dropOptions: DropOptions = {
    tolerance: 'touch',
    hoverClass: 'dropHover',
    activeClass: 'dragActive',
  } as DropOptions;
  private readonly topEndpointOptions: EndpointOptions = {
    endpoint: ['Dot', { radius: 7 }],
    paintStyle: { fill: '#ffcb3a' },
    isSource: false,
    scope: 'jsPlumb_DefaultScope',
    maxConnections: 1,
    isTarget: true,
    dropOptions: this.dropOptions,
  };
  private bottomEndpointOptions: EndpointOptions = {
    endpoint: ['Dot', { radius: 10 }],
    paintStyle: { fill: '#99cb3a' },
    isSource: true,
    scope: 'jsPlumb_DefaultScope',
    connectorStyle: { stroke: '#99cb3a', strokeWidth: 3 },
    maxConnections: 30,
    isTarget: false,
    connectorOverlays: [['Arrow', { location: 1 }]],
    dropOptions: this.dropOptions,
  };
  private dragOptions: DragOptions = {
    containment: 'canvas',
    stop: (event: any) => {
      this.handleDragStop(event);
    },
  } as DragOptions;
  private settings!: Settings;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private flowStructureService: FlowStructureService,
    private settingsService: SettingsService
  ) {
    this.getSettings();
  }

  @HostListener('dblclick') onDoubleClick(): void {
    this.openOptions();
  }

  @HostListener('click') onClick(): void {
    this.flowStructureService.selectNodeById(this.node.getId());
  }

  getSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe((settings) => (this.settings = settings));
  }

  ngAfterViewInit(): void {
    const id = this.node.getId();
    this.createConnections();
    this.createAnchors(id);
    this.createGrid();
    this.jsPlumbInstance.draggable(id, this.dragOptions);
  }

  createAnchors(id: string): void {
    this.nodeIsListener() ? this.makeNodeListener() : this.makeNodeTarget(id);
    if (!this.nodeIsExit()) {
      this.makeNodeSource(id);
    }
  }

  nodeIsExit() {
    return this.cssClass === 'shape--round color--danger';
  }

  nodeIsListener() {
    return this.cssClass === 'shape--oval color--info';
  }

  makeNodeListener(): void {
    this.bottomEndpointOptions.isSource = false;
    this.bottomEndpointOptions.connectionsDetachable = false;
  }

  makeNodeSource(id: string): void {
    this.jsPlumbInstance.addEndpoint(
      id,
      {
        anchor: this.getSourceAnchor(),
        uuid: id + '_bottom',
        maxConnections: -1,
      },
      this.bottomEndpointOptions
    );
  }

  makeNodeTarget(id: string): void {
    this.jsPlumbInstance.addEndpoint(
      id,
      { anchor: this.getTargetAnchor(), uuid: id + '_top', maxConnections: -1 },
      this.topEndpointOptions
    );
  }

  getSourceAnchor(): AnchorSpec {
    return this.settings.verticalConnectors ? 'Bottom' : 'RightMiddle';
  }

  getTargetAnchor(): AnchorSpec {
    return this.settings.verticalConnectors ? 'Top' : 'LeftMiddle';
  }

  createConnections() {
    this.bottomEndpointOptions.connector = this.getConnectorSpecification();
  }

  getConnectorSpecification(): ConnectorSpec {
    switch (+this.settings.connectionType) {
      case ConnectionType.flowchart:
        return this.flowchartConnectionSpecification;
      case ConnectionType.bezier:
        return this.bezierConnectionSpecification;
      case ConnectionType.straight:
        return this.straightConnectionSpecification;
      default:
        throw new Error(
          'An error occurred when trying to set the connection type'
        );
    }
  }

  createGrid(): void {
    this.dragOptions = {
      ...this.dragOptions,
      grid: this.getGridConfiguration(),
    } as DragOptions;
  }

  getGridConfiguration(): [number, number] {
    return [+this.settings.gridConfiguration, +this.settings.gridConfiguration];
  }

  handleDragStop(event: any): void {
    this.flowStructureService.editNodePositions({
      nodeId: event.el.id,
      xPos: event.pos[0],
      yPos: event.pos[1],
    });
  }

  nodeHasClass(event: any, className: string) {
    return event.el.classList[0] === className;
  }

  openOptions(): void {
    this.ngxSmartModalService
      .getModal('optionsModal')
      .setData(this.node, true)
      .open();
  }
}
