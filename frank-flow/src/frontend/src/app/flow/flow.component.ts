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
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements AfterViewInit {
  private readonly canvasExpansionSize = 500;

  @ViewChild('nodeContainer', { read: ElementRef })
  nodeContainerRef!: ElementRef;
  nodes = [];
  connections = [];

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

  constructor(private renderer: Renderer2, private library: FaIconLibrary) {
    this.library.addIcons(faArrowDown, faArrowUp, faArrowRight, faArrowLeft);
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
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

  changeCanvasSize(
    direction: 'height' | 'width',
    expansionValue: number
  ): void {
    this.renderer.setStyle(
      this.canvasElement,
      direction,
      (direction == 'height'
        ? this.canvasElement.offsetHeight
        : this.canvasElement.offsetWidth) +
        expansionValue +
        'px'
    );
  }
}
