import {
  AfterViewInit,
  Component,
  HostBinding,
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
import { SettingsService } from 'src/app/header/settings/settings.service';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input()
  public panzoomConfig!: PanZoomConfig;
  @HostBinding('tabindex')
  public tabindex = 1;
  public flowUpdate = false;
  public locked!: boolean;
  @ViewChild('canvas', { read: ViewContainerRef })
  private viewContainerRef!: ViewContainerRef;
  private jsPlumbInstance!: jsPlumbInstance;
  private currentFileSubscription!: Subscription;
  private settingsSubscription!: Subscription;
  private errors!: string[] | undefined;
  private connectionIsMoving = false;
  private modelChangedSubscription!: Subscription;
  private currentFile!: File;

  constructor(
    private nodeService: NodeService,
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService,
    private graphService: GraphService,
    private nodeGeneratorService: NodeGeneratorService,
    private settingsService: SettingsService
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
    this.subscribeToSettings();
    if (this.panzoomConfig) {
      this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe(
        (model: PanZoomModel) => this.onModelChanged(model)
      );
    }
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.settingsSubscription.unsubscribe();
    this.jsPlumbInstance.reset();
    this.viewContainerRef.clear();
  }

  subscribeToCurrentFile(): void {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe({
        next: (currentFile: File): void => {
          this.errors = currentFile.errors;
          this.locked = this.XmlErrorsFound();
          this.currentFile = currentFile;
          if (currentFile.flowStructure && currentFile.flowNeedsUpdate) {
            this.generateFlow(currentFile.flowStructure);
          }
        },
      });
  }

  subscribeToSettings(): void {
    this.settingsSubscription = this.settingsService
      .getSettings()
      .subscribe(() => {
        if (this.flowStructureIsReceived()) {
          this.generateFlow(this.currentFile.flowStructure!);
        }
      });
  }

  flowStructureIsReceived(): boolean {
    return !!(this.currentFile && this.currentFile.flowStructure);
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

  generateFlow(structure: FlowStructure): void {
    if (this.flowUpdate) {
      return;
    }
    this.jsPlumbInstance.ready(() => {
      this.flowUpdate = true;
      this.jsPlumbInstance.reset(true);
      this.viewContainerRef.clear();
      this.nodeGeneratorService.resetNodes();

      setTimeout(() => {
        if (structure && structure.firstPipe) {
          this.nodeGeneratorService.generateNodes(
            structure.firstPipe,
            structure
          );
        }

        this.graphService.makeGraph(
          this.nodeGeneratorService.nodeMap,
          this.nodeGeneratorService.forwards
        );

        this.nodeGeneratorService.generateForwards();
        this.flowUpdate = false;
      });
    });
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
}
