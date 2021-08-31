import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
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
export class FlowComponent {
  nodes = [];
  connections = [];
  private panZoomConfigOptions: PanZoomConfigOptions = {
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

  @ViewChild('nodeContainer', { read: ElementRef })
  nodeContainerRef!: ElementRef;
  private offset = 500;

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

    this.renderer.setStyle(el, 'width', elWidth - this.offset + 'px');
  }

  decreaseBottom(): void {
    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elHeight = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetHeight;

    this.renderer.setStyle(el, 'height', elHeight - this.offset + 'px');
  }

  expandRight(): void {
    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elWidth = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetWidth;

    this.renderer.setStyle(el, 'width', elWidth + this.offset + 'px');
  }

  expandBottom(): void {
    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elHeight = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetHeight;

    this.renderer.setStyle(el, 'height', elHeight + this.offset + 'px');
  }
}
