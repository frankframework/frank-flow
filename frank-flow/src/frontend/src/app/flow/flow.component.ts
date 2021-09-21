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
import { CodeService } from '../shared/services/code.service';
import { Subscription } from 'rxjs';
import { File } from '../shared/models/file.model';
import { GraphService } from '../shared/services/graph.service';

type canvasDirection = 'height' | 'width';
type minimumPositions = { x: number; y: number };

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements AfterViewInit {
  private readonly canvasExpansionSize = 500;
  private readonly monacoUpdateQueueInterval = 520;
  private readonly nodeBufferSpace = 300;

  @ViewChild('nodeContainer', { read: ElementRef })
  private nodeContainerRef!: ElementRef;
  private canvasElement?: HTMLElement;
  private panZoomConfigOptions: PanZoomConfigOptions = {
    zoomLevels: 10,
    zoomStepDuration: 0.2,
    freeMouseWheelFactor: 0.01,
    zoomToFitZoomLevelFactor: 0.5,
    dragMouseButton: 'left',
    zoomOnDoubleClick: false,
  };

  public currentFileSubscription!: Subscription;
  public panzoomConfig: PanZoomConfig = new PanZoomConfig(
    this.panZoomConfigOptions
  );

  constructor(
    private renderer: Renderer2,
    private library: FaIconLibrary,
    private codeService: CodeService,
    private graphService: GraphService
  ) {
    this.library.addIcons(faArrowDown, faArrowUp, faArrowRight, faArrowLeft);
  }

  ngAfterViewInit(): void {
    this.setCanvasElement();
    this.setCurrentFileSubscribtion();
  }

  setCanvasElement(): void {
    this.canvasElement = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
  }

  setCurrentFileSubscribtion(): void {
    this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
      {
        next: (file: File) => {
          setTimeout(() => {
            this.setBasicCanvasSize();
          }, this.monacoUpdateQueueInterval);
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
    const minimumPositions = this.calculateMinimumCanvasSize();

    this.renderCanvas('width', minimumPositions.x + this.nodeBufferSpace);
    this.renderCanvas('height', minimumPositions.y + this.nodeBufferSpace);
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
    this.renderer.setStyle(this.canvasElement, direction, value + 'px');
  }

  canChangeCanvasSize(
    direction: canvasDirection,
    expansionValue: number
  ): boolean {
    const minimumPositions = this.calculateMinimumCanvasSize();
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

  calculateMinimumCanvasSize(): minimumPositions {
    let x = 0;
    let y = 0;

    this.graphService.nodeMap.forEach((node, key) => {
      x = this.comparePositions(x, node.getLeft() ?? 0);
      y = this.comparePositions(y, node.getTop() ?? 0);
    });

    return { x, y };
  }

  comparePositions(highestPosition: number, currentPosition: number): number {
    return currentPosition > highestPosition
      ? currentPosition
      : highestPosition;
  }
}
