import {
  AfterViewInit,
  Component,
  ElementRef,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
} from '@fortawesome/free-solid-svg-icons';
import { CurrentFileService } from '../shared/services/current-file.service';
import { Subscription } from 'rxjs';
import { File } from '../shared/models/file.model';

type canvasDirection = 'height' | 'width';
type CanvasSize = { x: number; y: number };

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements AfterViewInit {
  private readonly canvasExpansionSize = 500;

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
  private currentFile!: File;

  constructor(
    private renderer: Renderer2,
    private library: FaIconLibrary,
    private currentFileService: CurrentFileService
  ) {
    this.library.addIcons(faArrowDown, faArrowUp, faArrowRight, faArrowLeft);
  }

  ngAfterViewInit(): void {
    this.setCanvasElement();
    this.setCurrentFileSubscription();
    this.setBasicCanvasSize();
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
          this.setBasicCanvasSize();
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

  calculateMinimumCanvasSize(): CanvasSize {
    let x = 0;
    let y = 0;

    this.currentFile?.flowStructure?.nodes?.forEach((node, key) => {
      x = this.comparePositions(x, node.positions.x ?? 0);
      y = this.comparePositions(y, node.positions.y ?? 0);
    });

    return { x, y };
  }

  comparePositions(highestPosition: number, currentPosition: number): number {
    return currentPosition > highestPosition
      ? currentPosition
      : highestPosition;
  }
}
