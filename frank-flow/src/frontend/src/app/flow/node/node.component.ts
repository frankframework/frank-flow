import {
  AfterViewInit,
  Component,
  HostBinding,
  HostListener,
  Input,
  OnInit,
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
import {
  faPaperPlane,
  faPuzzlePiece,
  faQuestion,
  faSatelliteDish,
} from '@fortawesome/free-solid-svg-icons';
import { SettingsService } from 'src/app/header/settings/settings.service';
import { Settings } from 'src/app/header/settings/settings.model';
import { ForwardStyle } from 'src/app/header/settings/options/forward-style';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { File } from '../../shared/models/file.model';
import { FlowSettingsService } from '../../shared/services/flow-settings.service';
import { DefaultSettings } from '../../header/settings/options/default-settings.model';
import { FlowSettings } from '../../shared/models/flow-settings.model';
import { FlowNamespaceService } from 'src/app/shared/services/flow-namespace.service';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
})
export class NodeComponent implements AfterViewInit, OnInit {
  @Input() public node!: Node;
  @Input() public jsPlumbInstance!: jsPlumbInstance;
  @Input() public generating!: boolean;
  @HostBinding('style') public style?: string;
  @HostBinding('class') public cssClass?: string;

  @HostBinding('class.isActive')
  public get isActive() {
    return this.flowStructureService.selectedNode?.uid === this.node?.getId();
  }

  public get badges() {
    return this.node.getBadges() ?? [];
  }

  private defaultSettings = new DefaultSettings();
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
    paintStyle: { fill: '#fdc300' },
    isSource: false,
    scope: 'jsPlumb_DefaultScope',
    maxConnections: -1,
    isTarget: true,
    dropOptions: this.dropOptions,
  };
  private bottomEndpointOptions: EndpointOptions = {
    endpoint: ['Dot', { radius: 10 }],
    paintStyle: { fill: '#8bc34a' },
    isSource: true,
    scope: 'jsPlumb_DefaultScope',
    connectorStyle: { stroke: '#8bc34a', strokeWidth: 3 },
    maxConnections: -1,
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
  private flowSettings!: FlowSettings | undefined;
  private currentFile!: File;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private flowStructureService: FlowStructureService,
    private settingsService: SettingsService,
    private flowSettingsService: FlowSettingsService,
    private currentFileService: CurrentFileService,
    private flowNamespaceService: FlowNamespaceService,
    private library: FaIconLibrary,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.library.addIcons(
      faPaperPlane,
      faPuzzlePiece,
      faQuestion,
      faSatelliteDish
    );
  }

  @HostListener('dblclick') onDoubleClick(): void {
    this.openOptions();
  }

  @HostListener('click') onClick(): void {
    this.flowStructureService.selectNodeById(this.node.getId());
  }

  ngAfterViewInit(): void {
    this.getSettings();
    this.getFlowSettings();
    this.getCurrentFile();
    const id = this.node.getId();
    this.createConnections();
    this.createAnchors(id);
    this.createGrid();
    this.jsPlumbInstance.draggable(id, this.dragOptions);
  }

  getSettings(): void {
    this.settingsService.settingsObservable.subscribe((settings) => {
      this.settings = settings;
      this.mergeSettings();
    });
  }

  getFlowSettings(): void {
    this.flowSettingsService.flowSettingsObservable.subscribe({
      next: (flowSettings) => {
        this.flowSettings = flowSettings;
        this.mergeSettings();
      },
    });
  }

  mergeSettings(): void {
    if (!this.settings.ignoreFlowSettings) {
      this.settings = { ...this.settings, ...this.flowSettings };
    }
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe(
      (currentFile) => (this.currentFile = currentFile)
    );
  }

  createAnchors(id: string): void {
    this.nodeIsListener()
      ? this.createListenerEndpoint()
      : this.createTargetEndpoint(id);
    if (!this.nodeIsExit()) {
      this.createSourceEndpoint(id);
    }
  }

  nodeIsExit() {
    return this.cssClass?.match('shape--round color--danger');
  }

  nodeIsListener() {
    return this.cssClass === 'color--info';
  }

  createListenerEndpoint(): void {
    this.bottomEndpointOptions.connectorStyle = {
      stroke: '#00abff',
      strokeWidth: 3,
    };
    if (this.currentFile.flowStructure?.implicitFirstPipe) {
      (this.bottomEndpointOptions.connectorStyle as any).dashstyle = '2 2';
    }
    this.bottomEndpointOptions.paintStyle = { fill: '#00abff' };
  }

  createSourceEndpoint(id: string): void {
    if (!this.hasForwards()) {
      (this.bottomEndpointOptions.connectorStyle as any).dashstyle = '2 2';
    }

    for (const forward of this.node.getForwards() ?? []) {
      this.jsPlumbInstance.addEndpoint(
        id,
        this.getSourceEndPoint(id + forward.name),
        this.bottomEndpointOptions
      );
    }

    this.jsPlumbInstance.addEndpoint(
      id,
      this.getSourceEndPoint(id),
      this.bottomEndpointOptions
    );
  }

  hasForwards() {
    const forwards = this.node.getForwards();
    return forwards && forwards.length > 0;
  }

  getSourceEndPoint(uuid: string): EndpointOptions {
    console.log(uuid + '-source');
    return {
      uuid: uuid + '-source',
      maxConnections: 1,
      isSource: true,
      anchor: this.getSourceAnchor(),
    };
  }

  createTargetEndpoint(id: string): void {
    this.jsPlumbInstance.addEndpoint(
      id,
      {
        anchor: this.getTargetAnchor(),
        uuid: id + '-target',
        maxConnections: -1,
      },
      this.topEndpointOptions
    );
  }

  getSourceAnchor(): AnchorSpec {
    switch (this.settings.direction) {
      case 'vertical':
        return 'ContinuousBottom';
      default:
        return 'ContinuousRight';
    }
  }

  getTargetAnchor(): AnchorSpec {
    switch (this.settings.direction) {
      case 'vertical':
        return 'ContinuousTop';
      default:
        return 'ContinuousLeft';
    }
  }

  createConnections() {
    this.bottomEndpointOptions.connector = this.getConnectorSpecification();
  }

  getConnectorSpecification(): ConnectorSpec {
    switch (this.settings.forwardStyle) {
      case ForwardStyle.flowchart:
        return this.flowchartConnectionSpecification;
      case ForwardStyle.straight:
        return this.straightConnectionSpecification;
      default:
      case ForwardStyle.bezier:
        return this.bezierConnectionSpecification;
    }
  }

  createGrid(): void {
    this.dragOptions = {
      ...this.dragOptions,
      grid: this.getGridConfiguration(),
    } as DragOptions;
  }

  getGridConfiguration(): [number, number] {
    const gridSize = this.settings.gridSize ?? this.defaultSettings.gridSize;
    return [+gridSize, +gridSize];
  }

  handleDragStop(event: any): void {
    this.flowNamespaceService.handleNameSpace();
    if ('implicitExit' === event.el.id) {
      this.flowStructureService.addDefaultExit(event.pos[0], event.pos[1]);
    } else {
      this.flowStructureService.editNodePositions({
        nodeId: event.el.id,
        xPos: event.pos[0],
        yPos: event.pos[1],
      });
    }
  }

  nodeHasClass(event: any, className: string) {
    return event.el.classList[0] === className;
  }

  openOptions(): void {
    if (this.node.getId() === 'implicitExit') {
      this.toastr.info(
        `Make the exit explicit by dragging it, this wil add it to the configuration.`,
        `This is an implicit exit`
      );
    } else {
      this.ngxSmartModalService
        .getModal('optionsModal')
        .setData(this.node, true)
        .open();
    }
  }
}
