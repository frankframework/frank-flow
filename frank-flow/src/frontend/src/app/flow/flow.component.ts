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
import { LayoutService } from '../shared/services/layout.service';
import { Node } from './node/nodes/node.model';
import { Subscription } from 'rxjs';
import { FileType } from '../shared/enums/file-type.enum';
import { FlowStructureService } from '../shared/services/flow-structure.service';
import { PanZoomService } from '../shared/services/pan-zoom.service';
import { SettingsService } from '../header/settings/settings.service';
import { Settings } from '../header/settings/settings.model';

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

  private canvasElement?: HTMLElement;
  private currentFile!: File;
  private nodes!: Map<string, Node>;
  private currentFileSubscription!: Subscription;
  private layoutSubscription!: Subscription;

  public fileIsLoading!: boolean;
  public fileIsConfiguration!: boolean;
  public fileIsOldSyntaxConfiguration!: boolean;
  public fileIsEmpty!: boolean;
  public panZoomConfig = this.panZoomService.panZoomConfig;
  public settings!: Settings;

  constructor(
    private renderer: Renderer2,
    private library: FaIconLibrary,
    private currentFileService: CurrentFileService,
    private layoutService: LayoutService,
    private flowStructureService: FlowStructureService,
    private panZoomService: PanZoomService,
    private settingsService: SettingsService
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

  @HostListener('window:keydown', ['$event'])
  onKeyUp(kbdEvent: KeyboardEvent): void {
    this.handleKeyboardUpEvent(kbdEvent);
  }

  ngOnInit(): void {
    this.showCanvasOrMessage();
    this.setCurrentFileSubscription();
    this.setNodesSubscription();
    this.subscribeToSettings();
  }

  ngAfterViewInit(): void {
    this.setCanvasElement();
    this.setBasicCanvasSize();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.layoutSubscription.unsubscribe();
  }

  setCanvasElement(): void {
    this.canvasElement =
      this.nodeContainerRef.nativeElement.querySelectorAll('.canvas')[0];
  }

  setCurrentFileSubscription(): void {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe({
        next: (currentFile: File) => {
          this.currentFile = currentFile;
          this.showCanvasOrMessage();
          this.setBasicCanvasSize();
        },
      });
  }

  setNodesSubscription(): void {
    this.layoutSubscription = this.layoutService.nodesObservable.subscribe({
      next: (nodes: Map<string, Node>) => {
        this.nodes = nodes;
        this.setBasicCanvasSize();
      },
    });
  }

  subscribeToSettings(): void {
    this.settingsService.settingsObservable.subscribe(
      (settings) => (this.settings = settings)
    );
  }

  showCanvasOrMessage(): void {
    this.fileIsLoading = this.currentFile?.xml === undefined;
    this.fileIsConfiguration =
      this.currentFile?.type === FileType.CONFIGURATION;
    this.fileIsOldSyntaxConfiguration =
      this.currentFile?.type === FileType.OLD_SYNTAX_CONFIGURATION;
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
    for (const node of this.currentFile?.currentAdapter?.flowStructure?.nodes ??
      []) {
      positions.x = this.comparePositions(positions.x, node.positions.x);
      positions.y = this.comparePositions(positions.y, node.positions.y);
    }
  }

  getMinimumCanvasSizeForGraphService(positions: CanvasSize): void {
    for (const [_, node] of this.nodes?.entries() ?? []) {
      positions.x = this.comparePositions(positions.x, node.getLeft() ?? 0);
      positions.y = this.comparePositions(positions.y, node.getTop() ?? 0);
    }
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

  convertConfiguration() {
    this.currentFileService.convertOldConfigurationSyntax();
  }
}
