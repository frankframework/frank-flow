import {
  Component,
  ElementRef,
  Renderer2,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faArrowLeft,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { FlowStructureService } from '../shared/services/flow-structure.service';
import { FlowStructureNode } from '../shared/models/flowStructureNode.model';
import { CodeService } from '../shared/services/code.service';
import { Subscription } from 'rxjs';
import { File } from '../shared/models/file.model';
import { FlowStructure } from '../shared/models/flowStructure.model';

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements AfterViewInit {
  private readonly canvasExpansionSize = 500;
  private readonly monacoQueueUpdateInterval = 520;
  private readonly nodeBufferSpace = 300;

  private minimumYPosition = 0;
  private minimumXPosition = 0;
  currentFileSubscription!: Subscription;

  @ViewChild('nodeContainer', { read: ElementRef })
  nodeContainerRef!: ElementRef;

  panZoomConfigOptions: PanZoomConfigOptions = {
    zoomLevels: 10,
    zoomStepDuration: 0.2,
    freeMouseWheelFactor: 0.01,
    zoomToFitZoomLevelFactor: 0.5,
    dragMouseButton: 'left',
    zoomOnDoubleClick: false,
  };

  public panzoomConfig: PanZoomConfig = new PanZoomConfig(
    this.panZoomConfigOptions
  );

  canvasElement?: any;

  constructor(
    private renderer: Renderer2,
    private library: FaIconLibrary,
    private flowStructureService: FlowStructureService,
    private codeService: CodeService
  ) {
    this.library.addIcons(faArrowDown, faArrowUp, faArrowRight, faArrowLeft);
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];

    this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
      {
        next: (file: File) => {
          setTimeout(() => {
            this.setBasicCanvasSize();
          }, this.monacoQueueUpdateInterval);
        },
      }
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
    this.calculateMinimumCanvasSize();

    this.renderCanvas('width', this.minimumXPosition + this.nodeBufferSpace);
    this.renderCanvas('height', this.minimumYPosition + this.nodeBufferSpace);
  }

  changeCanvasSize(
    direction: 'height' | 'width',
    expansionValue: number
  ): void {
    this.calculateMinimumCanvasSize();
    if (this.canChangeCanvasSize(direction, expansionValue)) {
      this.renderCanvas(
        direction,
        this.getNewCanvasSize(direction, expansionValue)
      );
    }
  }

  renderCanvas(direction: 'height' | 'width', value: number): void {
    this.renderer.setStyle(this.canvasElement, direction, value + 'px');
  }

  canChangeCanvasSize(
    direction: 'height' | 'width',
    expansionValue: number
  ): boolean {
    if (direction === 'height') {
      return (
        this.getNewCanvasSize(direction, expansionValue) > this.minimumYPosition
      );
    } else {
      return (
        this.getNewCanvasSize(direction, expansionValue) > this.minimumXPosition
      );
    }
  }

  getNewCanvasSize(
    direction: 'height' | 'width',
    expansionValue: number
  ): number {
    return (
      (direction === 'height'
        ? this.canvasElement.offsetHeight
        : this.canvasElement.offsetWidth) + expansionValue
    );
  }

  calculateMinimumCanvasSize(): void {
    const structure = this.flowStructureService.getStructure();

    this.minimumXPosition = 0;
    this.minimumYPosition = 0;

    structure.nodes.forEach((element: FlowStructureNode) => {
      this.minimumXPosition = this.comparePositions(
        this.minimumXPosition,
        element.positions[0]
      );
      this.minimumYPosition = this.comparePositions(
        this.minimumYPosition,
        element.positions[1]
      );
    });
  }

  comparePositions(highestPosition: number, currentPosition: number): number {
    return currentPosition > highestPosition
      ? currentPosition
      : highestPosition;
  }
}
