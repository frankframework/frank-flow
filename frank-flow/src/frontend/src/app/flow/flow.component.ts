import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faArrowLeft,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { CodeService } from '../shared/services/code.service';
import { GraphService } from '../shared/services/graph.service';

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
  panzoomConfig: PanZoomConfig = new PanZoomConfig(this.panZoomConfigOptions);

  @ViewChild('nodeContainer', { read: ElementRef })
  nodeContainerRef!: ElementRef;
  private offset = 500;

  constructor(
    private graphService: GraphService,
    private codeService: CodeService,
    private renderer: Renderer2,
    private library: FaIconLibrary
  ) {
    this.library.addIcons(faArrowDown, faArrowUp, faArrowRight, faArrowLeft);
  }

  expandLeft(): void {
    this.graphService.expanding = true;

    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elWidth = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetWidth;
    this.renderer.setStyle(el, 'width', elWidth - this.offset + 'px');
    this.codeService.reloadFile();
  }

  expandTop(): void {
    this.graphService.expanding = true;

    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elHeight = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetHeight;
    this.renderer.setStyle(el, 'height', elHeight - this.offset + 'px');

    this.codeService.reloadFile();
  }

  expandRight(): void {
    this.graphService.expanding = true;

    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elWidth = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetWidth;
    this.renderer.setStyle(el, 'width', elWidth + this.offset + 'px');

    setTimeout(() => {
      this.graphService.expanding = false;
    }, 100);
  }

  expandBottom(): void {
    this.graphService.expanding = true;

    const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0];
    const elHeight = this.nodeContainerRef.nativeElement.getElementsByClassName(
      'canvas'
    )[0].offsetHeight;
    this.renderer.setStyle(el, 'height', elHeight + this.offset + 'px');

    setTimeout(() => {
      this.graphService.expanding = false;
    }, 100);
  }
}
