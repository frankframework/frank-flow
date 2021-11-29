import {
  AfterViewInit,
  Component,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { NodeService } from '../node/node.service';
import { CurrentFileService } from '../../shared/services/current-file.service';
import {
  ConnectionMadeEventInfo,
  jsPlumbInstance,
  OnConnectionBindInfo,
} from 'jsplumb';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { GraphService } from '../../shared/services/graph.service';
import { NodeGeneratorService } from '../../shared/services/node-generator.service';
import { FlowStructure } from '../../shared/models/flow-structure.model';
import { PanZoomConfig } from 'ngx-panzoom/lib/panzoom-config';
import { PanZoomModel } from 'ngx-panzoom/lib/panzoom-model';
import { File } from '../../shared/models/file.model';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() panzoomConfig!: PanZoomConfig;
  @ViewChild('canvas', { read: ViewContainerRef })
  viewContainerRef!: ViewContainerRef;
  @HostBinding('tabindex') tabindex = 1;

  jsPlumbInstance!: jsPlumbInstance;
  currentFileSubscription!: Subscription;
  flowUpdate = false;
  locked!: boolean;

  private errors!: string[] | undefined;
  private connectionIsMoving = false;
  private modelChangedSubscription!: Subscription;

  constructor(
    private nodeService: NodeService,
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService,
    private graphService: GraphService,
    private nodeGeneratorService: NodeGeneratorService
  ) {
    this.jsPlumbInstance = this.nodeService.getInstance();
    this.setConnectionEventListeners();
  }

  onModelChanged(model: PanZoomModel): void {
    const zoom = this.calculateZoomLevel(model.zoomLevel);
    this.jsPlumbInstance.setZoom(zoom);
  }

  calculateZoomLevel(zoomLevel: number): number {
    const neutralZoomLevel = 1;
    const minZoomLevel = 0.5;
    const zoomStep = 0.5;
    const zoomOutLevel = minZoomLevel + zoomLevel * zoomStep;
    const isZoomingIn = zoomLevel > neutralZoomLevel;
    return isZoomingIn ? zoomLevel : zoomOutLevel;
  }

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);
    this.subscribeToCurrentFile();
    if (this.panzoomConfig) {
      this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe(
        (model: PanZoomModel) => this.onModelChanged(model)
      );
    }
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset();
    this.viewContainerRef.clear();
  }

  subscribeToCurrentFile(): void {
    this.currentFileSubscription = this.currentFileService.currentFileObservable.subscribe(
      {
        next: (currentFile: File): void => {
          this.errors = currentFile.errors;
          this.locked = this.XmlErrorsFound();
          if (currentFile.flowStructure && currentFile.flowNeedsUpdate) {
            this.generateFlow(currentFile.flowStructure);
          }
        },
      }
    );
  }

  XmlErrorsFound(): boolean {
    return this.errors !== undefined && this.errors.length > 0;
  }

  setConnectionEventListeners(): void {
    this.jsPlumbInstance.bind('connection', (info, originalEvent) =>
      this.onConnection(info, originalEvent)
    );
    this.jsPlumbInstance.bind('connectionDetached', (info, originalEvent) =>
      this.onConnectionDetached(info, originalEvent)
    );
    this.jsPlumbInstance.bind('connectionMoved', (info, originalEvent) =>
      this.onConnectionMoved(info, originalEvent)
    );
    this.jsPlumbInstance.bind('dblclick', (info, originalEvent) =>
      this.onDoubleClick(info, originalEvent)
    );
  }

  private onConnection(
    info: ConnectionMadeEventInfo,
    originalEvent: Event
  ): void {
    if (originalEvent == null || this.connectionIsMoving) {
      this.connectionIsMoving = false;
      return;
    }
    this.flowStructureService.addConnection(info.sourceId, info.targetId);
  }

  private onConnectionDetached(
    info: OnConnectionBindInfo,
    originalEvent: Event
  ) {
    if (originalEvent == null) {
      return;
    }
    this.flowStructureService.deleteConnection(info.sourceId, info.targetId);
    this.connectionIsMoving = false;
  }

  private onConnectionMoved(info: OnConnectionBindInfo, originalEvent: Event) {
    if (originalEvent == null) {
      return;
    }
    this.flowStructureService.moveConnection(
      info.originalSourceId,
      info.originalTargetId,
      info.newTargetId
    );
    this.connectionIsMoving = true;
  }

  private onDoubleClick(info: OnConnectionBindInfo, originalEvent: Event) {
    if (originalEvent == null) {
      return;
    }
    this.flowStructureService.deleteConnection(
      info.sourceId,
      info.targetId,
      true
    );
  }

  generateFlow(structure: FlowStructure): void {
    this.jsPlumbInstance.ready(() => {
      this.jsPlumbInstance.reset(true);
      this.viewContainerRef.clear();
      this.nodeGeneratorService.resetNodes();

      setTimeout(() => {
        if (structure && structure.firstPipe) {
          this.nodeGeneratorService.generateNodes(
            structure.firstPipe,
            structure.listeners,
            structure.pipes,
            structure.exits
          );
        }

        this.graphService.makeGraph(
          this.nodeGeneratorService.nodeMap,
          this.nodeGeneratorService.forwards
        );

        this.nodeGeneratorService.generateForwards();
      });
    });
  }
}
