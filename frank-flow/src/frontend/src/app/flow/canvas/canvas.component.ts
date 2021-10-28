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
import { jsPlumbInstance } from 'jsplumb';
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
  private readonly LAST_ZOOM_LEVEL = 0.25;

  @Input() panzoomConfig!: PanZoomConfig;

  @ViewChild('canvas', { read: ViewContainerRef })
  viewContainerRef!: ViewContainerRef;

  jsPlumbInstance!: jsPlumbInstance;
  currentFileSubscription!: Subscription;
  flowUpdate = false;

  private errors!: string[] | undefined;
  locked!: boolean;

  @HostBinding('tabindex') tabindex = 1;
  private connectionIsMoving = false;

  @HostListener('window:keydown', ['$event'])
  onKeyUp(kbdEvent: KeyboardEvent): void {
    this.handleKeyboardUpEvent(kbdEvent);
  }

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
    this.jsPlumbInstance.setZoom(
      model.zoomLevel ? model.zoomLevel / 2 : this.LAST_ZOOM_LEVEL
    );
  }

  ngAfterViewInit(): void {
    this.nodeService.setRootViewContainerRef(this.viewContainerRef);
    this.setCurrentFileListener();
    if (this.panzoomConfig) {
      this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe(
        (model: PanZoomModel) => this.onModelChanged(model)
      );
    }
    this.currentFileService.reloadFile();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset();
    this.viewContainerRef.clear();
  }

  handleKeyboardUpEvent(kbdEvent: KeyboardEvent): void {
    if (kbdEvent.ctrlKey && kbdEvent.key === 's') {
      kbdEvent.preventDefault();
      this.currentFileService.save();
    }
    // TODO: Add undo/redo
  }

  setCurrentFileListener(): void {
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
    this.jsPlumbInstance.bind('connection', (info, originalEvent) => {
      if (originalEvent == null || this.connectionIsMoving) {
        this.connectionIsMoving = false;
        return;
      }
      this.flowStructureService.addConnection(info.sourceId, info.targetId);
    });

    this.jsPlumbInstance.bind('connectionDetached', (info, originalEvent) => {
      if (originalEvent == null) {
        return;
      }
      this.flowStructureService.deleteConnection(info.sourceId, info.targetId);
      this.connectionIsMoving = false;
    });

    this.jsPlumbInstance.bind('connectionMoved', (info, originalEvent) => {
      if (originalEvent == null) {
        return;
      }
      this.flowStructureService.moveConnection(
        info.originalSourceId,
        info.originalTargetId,
        info.newTargetId
      );
      this.connectionIsMoving = true;
    });

    this.jsPlumbInstance.bind('dblclick', (info, originalEvent) => {
      if (originalEvent == null) {
        return;
      }
      this.flowStructureService.deleteConnection(
        info.sourceId,
        info.targetId,
        true
      );
    });
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
