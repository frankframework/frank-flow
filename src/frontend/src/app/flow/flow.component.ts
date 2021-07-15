import {
  Component,
  ElementRef,
  OnInit,
  Renderer2,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {
  PanZoomConfig,
  PanZoomConfigOptions,
  PanZoomAPI,
  PanZoomModel,
} from 'ngx-panzoom';
import { Subscription } from 'rxjs';
import { NodeGeneratorService } from '../shared/services/node-generator.service';

@Component({
  selector: 'app-flow',
  templateUrl: './flow.component.html',
  styleUrls: ['./flow.component.scss'],
})
export class FlowComponent implements OnInit {
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
  private modelChangedSubscription!: Subscription;
  private panZoomAPI!: PanZoomAPI;
  private apiSubscription!: Subscription;

  @ViewChild('nodeContainer', { read: ElementRef })
  nodeContainerRef!: ElementRef;

  constructor(
    private nodeGeneratorService: NodeGeneratorService,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    console.log('hoi?');
    this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe(
      (model: PanZoomModel) => this.onModelChanged(model)
    );
    this.apiSubscription = this.panzoomConfig.api.subscribe(
      (api: PanZoomAPI) => (this.panZoomAPI = api)
    );
  }

  onModelChanged(model: PanZoomModel): void {
    // console.log('change in model: ', model);
    const offset = 500;

    if (this.nodeContainerRef) {
      if (model.pan.x >= 0) {
        this.nodeGeneratorService.offX = offset;
        //this.panZoomAPI.resetView();
        this.panZoomAPI.centerContent(10);
        console.log(
          'expand canvas: ',
          this.nodeContainerRef.nativeElement.getElementsByClassName(
            'canvas'
          )[0].offsetWidth
        );
        const el = this.nodeContainerRef.nativeElement.getElementsByClassName(
          'canvas'
        )[0];
        const elWidth = this.nodeContainerRef.nativeElement.getElementsByClassName(
          'canvas'
        )[0].offsetWidth;
        this.renderer.setStyle(el, 'width', elWidth + offset + 'px');
      } else if (model.pan.y >= 0) {
        this.nodeGeneratorService.offY = offset;
        this.nodeContainerRef.nativeElement.style.height =
          this.nodeContainerRef.nativeElement.style.height + offset + 'px';
      }
    }
  }
}
