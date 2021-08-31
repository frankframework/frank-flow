import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faArrowLeft,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent {
  private readonly CanvasExpansionSize = 500;

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
  panzoomConfig: PanZoomConfig = new PanZoomConfig(this.panZoomConfigOptions);

  constructor(private renderer: Renderer2, private library: FaIconLibrary) {
    this.library.addIcons(faArrowDown, faArrowUp, faArrowRight, faArrowLeft);
  }

  decreaseRight(): void {
    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elWidth = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetWidth;

    this.renderer.setStyle(
      el,
      'width',
      elWidth - this.CanvasExpansionSize + 'px'
    );
  }

  decreaseBottom(): void {
    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elHeight = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetHeight;

    this.renderer.setStyle(
      el,
      'height',
      elHeight - this.CanvasExpansionSize + 'px'
    );
  }

  expandRight(): void {
    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elWidth = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetWidth;

    this.renderer.setStyle(
      el,
      'width',
      elWidth + this.CanvasExpansionSize + 'px'
    );
  }

  expandBottom(): void {
    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elHeight = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetHeight;

    this.renderer.setStyle(
      el,
      'height',
      elHeight + this.CanvasExpansionSize + 'px'
    );
  }
}
