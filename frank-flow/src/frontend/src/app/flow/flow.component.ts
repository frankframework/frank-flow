import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { PanZoomAPI, PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faDotCircle,
  faHome,
  faSearchMinus,
  faSearchPlus,
} from '@fortawesome/free-solid-svg-icons';
import { CurrentFileService } from '../shared/services/current-file.service';
import { File } from '../shared/models/file.model';
import { FlowStructureNode } from '../shared/models/flow-structure-node.model';
import { GraphService } from '../shared/services/graph.service';
import { Node } from './node/nodes/node.model';
import { Subscription } from 'rxjs';
import { FileType } from '../shared/enums/file-type.enum';
import { FlowStructureService } from '../shared/services/flow-structure.service';

type canvasDirection = 'height' | 'width';
type CanvasSize = { x: number; y: number };

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly canvasExpansionSize = 500;

  @ViewChild('nodeContainer', { read: ElementRef })
  private nodeContainerRef!: ElementRef;

  @HostListener('window:keydown', ['$event'])
  onKeyUp(kbdEvent: KeyboardEvent): void {
    this.handleKeyboardUpEvent(kbdEvent);
  }

  private canvasElement?: HTMLElement;
  private panZoomConfigOptions: PanZoomConfigOptions = {
    zoomLevels: 3,
    scalePerZoomLevel: 2.0,
    zoomStepDuration: 0.2,
    freeMouseWheel: false,
    invertMouseWheel: true,
    zoomToFitZoomLevelFactor: 1,
    dragMouseButton: 'left',
    zoomButtonIncrement: 0.1,
    zoomOnDoubleClick: false,
    dynamicContentDimensions: true,
    neutralZoomLevel: 1,
    initialZoomLevel: 1,
  };

  public panzoomConfig: PanZoomConfig = new PanZoomConfig(
    this.panZoomConfigOptions
  );
  private currentFile!: File;
  private nodes!: Map<string, Node>;
  private panzoomApiSubscription!: Subscription;
  private currentFileSubscription!: Subscription;
  private graphSubscription!: Subscription;
  private panZoomAPI!: PanZoomAPI;

  public fileIsLoading!: boolean;
  public fileIsConfiguration!: boolean;
  public fileIsEmpty!: boolean;

  constructor(
    private renderer: Renderer2,
    private library: FaIconLibrary,
    private currentFileService: CurrentFileService,
    private graphService: GraphService,
    private flowStructureService: FlowStructureService
  ) {
    this.library.addIcons(
      faArrowDown,
      faArrowUp,
      faArrowRight,
      faArrowLeft,
      faSearchMinus,
      faSearchPlus,
      faHome,
      faDotCircle
    );
  }

  ngOnInit(): void {
    this.showCanvasOrMessage();
    this.setPanzoomApiSubscription();
    this.setCurrentFileSubscription();
    this.setNodesSubscription();
  }

  ngAfterViewInit(): void {
    this.setCanvasElement();
    this.setBasicCanvasSize();
  }

  ngOnDestroy(): void {
    this.panzoomApiSubscription.unsubscribe();
    this.currentFileSubscription.unsubscribe();
    this.graphSubscription.unsubscribe();
  }

  setPanzoomApiSubscription(): void {
    this.panzoomApiSubscription = this.panzoomConfig.api.subscribe(
      (api: PanZoomAPI) => (this.panZoomAPI = api)
    );
  }

  setCanvasElement(): void {
    this.canvasElement = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
  }

  setCurrentFileSubscription(): void {
    this.currentFileSubscription = this.currentFileService.currentFileObservable.subscribe(
      {
        next: (currentFile: File) => {
          this.currentFile = currentFile;
          this.showCanvasOrMessage();
          this.setBasicCanvasSize();
        },
      }
    );
  }

  setNodesSubscription(): void {
    this.graphSubscription = this.graphService.nodesObservable.subscribe({
      next: (nodes: Map<string, Node>) => {
        this.nodes = nodes;
        this.setBasicCanvasSize();
      },
    });
  }

  showCanvasOrMessage(): void {
    this.fileIsLoading = this.currentFile?.xml === undefined;
    console.log(this.currentFile);
    console.log('boolean undefined: ', this.currentFile?.xml === undefined);
    // xml: ''
    //
    this.fileIsConfiguration =
      this.currentFile?.type === FileType.CONFIGURATION;
    this.fileIsEmpty = this.currentFile?.type === FileType.EMPTY;
  }

  handleKeyboardUpEvent(kbdEvent: KeyboardEvent): void {
    if (this.saveKeyCombination(kbdEvent)) {
      kbdEvent.preventDefault();
      this.currentFileService.save();
    } else if (this.undoKeyCombination(kbdEvent)) {
      kbdEvent.preventDefault();
      this.flowStructureService.monacoEditorComponent?.undo();
    } else if (this.redoKeyCombination(kbdEvent)) {
      kbdEvent.preventDefault();
      this.flowStructureService.monacoEditorComponent?.redo();
    }
  }

  saveKeyCombination(kbdEvent: KeyboardEvent): boolean {
    return kbdEvent.ctrlKey && kbdEvent.key === 's';
  }

  undoKeyCombination(kbdEvent: KeyboardEvent): boolean {
    return kbdEvent.ctrlKey && kbdEvent.key === 'z';
  }

  redoKeyCombination(kbdEvent: KeyboardEvent): boolean {
    return (
      kbdEvent.ctrlKey &&
      (kbdEvent.key === 'y' || (kbdEvent.shiftKey && kbdEvent.key === 'Z'))
    );
  }

  decreaseRight(): void {
    this.changeCanvasSize('width', -this.canvasExpansionSize);
  }

  decreaseBottom(): void {
    this.changeCanvasSize('height', -this.canvasExpansionSize);
  }

  expandRight(): void {
    this.changeCanvasSize('width', this.canvasExpansionSize);
  }

  expandBottom(): void {
    this.changeCanvasSize('height', this.canvasExpansionSize);
  }

  setBasicCanvasSize(): void {
    const minimumPositions = this.getMinimumCanvasSize();
    const canvasSize = this.calculateIncrementedCanvasSize(minimumPositions);

    this.renderCanvas('width', canvasSize.x);
    this.renderCanvas('height', canvasSize.y);
  }

  calculateIncrementedCanvasSize(canvasSize: CanvasSize): CanvasSize {
    canvasSize.y +=
      this.canvasExpansionSize - (canvasSize.y % this.canvasExpansionSize);
    canvasSize.x +=
      this.canvasExpansionSize - (canvasSize.x % this.canvasExpansionSize);
    return canvasSize;
  }

  changeCanvasSize(direction: canvasDirection, expansionValue: number): void {
    if (this.canChangeCanvasSize(direction, expansionValue)) {
      this.renderCanvas(
        direction,
        this.getNewCanvasSize(direction, expansionValue)
      );
    }
  }

  renderCanvas(direction: canvasDirection, value: number): void {
    if (this.canvasElement) {
      this.renderer.setStyle(this.canvasElement, direction, value + 'px');
    }
  }

  canChangeCanvasSize(
    direction: canvasDirection,
    expansionValue: number
  ): boolean {
    const minimumPositions = this.getMinimumCanvasSize();
    return (
      this.getNewCanvasSize(direction, expansionValue) >
      (direction === 'height' ? minimumPositions.y : minimumPositions.x)
    );
  }

  getNewCanvasSize(direction: canvasDirection, expansionValue: number): number {
    return (
      (direction === 'height'
        ? this.canvasElement?.offsetHeight ?? 0
        : this.canvasElement?.offsetWidth ?? 0) + expansionValue
    );
  }

  getMinimumCanvasSize(): CanvasSize {
    const minimumCanvasSize = { x: 0, y: 0 };
    this.getMinimumCanvasSizeForFlowStructure(minimumCanvasSize);
    this.getMinimumCanvasSizeForGraphService(minimumCanvasSize);
    this.getMinimumCanvasSizeWithNodeBuffer(minimumCanvasSize);
    return minimumCanvasSize;
  }

  getMinimumCanvasSizeForFlowStructure(positions: CanvasSize): void {
    this.currentFile?.flowStructure?.nodes?.forEach(
      (node: FlowStructureNode) => {
        positions.x = this.comparePositions(positions.x, node.positions.x);
        positions.y = this.comparePositions(positions.y, node.positions.y);
      }
    );
  }

  getMinimumCanvasSizeForGraphService(positions: CanvasSize): void {
    this.nodes?.forEach((node, key) => {
      positions.x = this.comparePositions(positions.x, node.getLeft() ?? 0);
      positions.y = this.comparePositions(positions.y, node.getTop() ?? 0);
    });
  }

  getMinimumCanvasSizeWithNodeBuffer(positions: CanvasSize): void {
    const maxWidthOfNode = 200;
    const maxHeightOfNode = 100;
    positions.x += maxWidthOfNode;
    positions.y += maxHeightOfNode;
  }

  comparePositions(lastPosition: number, currentPosition: number): number {
    return currentPosition > lastPosition ? currentPosition : lastPosition;
  }

  zoomIn(): void {
    this.panZoomAPI.zoomIn('viewCenter');
  }

  zoomOut(): void {
    this.panZoomAPI.zoomOut('viewCenter');
  }

  zoomReset(): void {
    this.panZoomAPI.resetView();
  }

  panCenter(): void {
    this.panZoomAPI.centerContent();
  }
}
