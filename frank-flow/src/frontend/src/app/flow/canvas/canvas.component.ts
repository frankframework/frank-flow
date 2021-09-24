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
import { CodeService } from '../../shared/services/code.service';
import { jsPlumbInstance } from 'jsplumb';
import { Subscription } from 'rxjs';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { GraphService } from '../../shared/services/graph.service';
import { NodeGeneratorService } from '../../shared/services/node-generator.service';
import { FlowStructure } from '../../shared/models/flow-structure.model';
import { PanZoomConfig } from 'ngx-panzoom/lib/panzoom-config';
import { PanZoomModel } from 'ngx-panzoom/lib/panzoom-model';
import { ToastrService } from 'ngx-toastr';
import { FlowGenerationData } from '../../shared/models/flow-generation-data.model';
import { XmlParseError } from '../../shared/models/xml-parse-error.model';

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
  flowGenerator!: Worker;
  errorsFound!: boolean;

  @HostBinding('tabindex') tabindex = 1;

  @HostListener('window:keydown', ['$event'])
  onKeyUp(kbdEvent: KeyboardEvent): void {
    this.handleKeyboardUpEvent(kbdEvent);
  }

  private modelChangedSubscription!: Subscription;

  constructor(
    private nodeService: NodeService,
    private codeService: CodeService,
    private flowStructureService: FlowStructureService,
    private graphService: GraphService,
    private nodeGeneratorService: NodeGeneratorService,
    private toastr: ToastrService
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
    this.createGeneratorWorker();
    this.setCurrentFileListener();
    this.setGeneratorWorkerListener();
    if (this.panzoomConfig) {
      this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe(
        (model: PanZoomModel) => this.onModelChanged(model)
      );
    }
    this.codeService.reloadFile();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
    this.jsPlumbInstance.reset(true);
    this.viewContainerRef.clear();
  }

  createGeneratorWorker(): void {
    if (Worker) {
      this.flowGenerator = new Worker(
        new URL('../../shared/workers/flow-generator.worker', import.meta.url),
        {
          name: 'flow-generator',
          type: 'module',
        }
      );
    }
  }

  handleKeyboardUpEvent(kbdEvent: KeyboardEvent): void {
    if (kbdEvent.ctrlKey && kbdEvent.key === 'z') {
      this.codeService.undo();
    } else if (kbdEvent.ctrlKey && kbdEvent.key === 'y') {
      this.codeService.redo();
    } else if (kbdEvent.ctrlKey && kbdEvent.key === 's') {
      kbdEvent.preventDefault();
      this.codeService.save();
    }
  }

  setGeneratorWorkerListener(): void {
    this.flowGenerator.onmessage = ({ data }) => {
      this.toastr.clear();
      if (data) {
        if (this.parsingErrorsFound(data)) {
          this.showParsingErrors(data.errors);
        } else {
          this.flowStructureService.setStructure(data.structure);
          this.generateFlow(data.structure);
        }
      }
    };
  }

  parsingErrorsFound(data: FlowGenerationData): boolean {
    this.errorsFound = data.errors.length > 0;
    return this.errorsFound;
  }

  showParsingErrors(errors: string[]): void {
    const parsedErrors = this.groupSimilarErrors(errors);
    parsedErrors.forEach((error: XmlParseError) => {
      this.toastr.error(
        error.getTemplateString(),
        'Parsing error found in XML',
        {
          disableTimeOut: true,
        }
      );
    });
  }

  groupSimilarErrors(errors: string[]): XmlParseError[] {
    const groupedErrors: XmlParseError[] = [];
    errors.forEach((errorMessage, index) => {
      const lastError = groupedErrors[groupedErrors.length - 1];
      const error = this.parseErrorMessage(errorMessage);
      if (this.errorMessageEqualToLast(error, lastError)) {
        if (this.errorColumnFollowsLast(error, lastError)) {
          lastError.endColumn = error.startColumn;
        } else if (this.errorLineFollowsLast(error, lastError)) {
          lastError.endLine = error.startLine;
        }
      } else {
        groupedErrors.push(error);
      }
    });
    return groupedErrors;
  }

  errorMessageEqualToLast(
    error: XmlParseError,
    lastError: XmlParseError
  ): boolean {
    return lastError && lastError.message === error.message;
  }

  errorColumnFollowsLast(
    error: XmlParseError,
    lastError: XmlParseError
  ): boolean {
    return (
      lastError.endLine === error.startLine &&
      lastError.endColumn + 1 === error.startColumn
    );
  }

  errorLineFollowsLast(
    error: XmlParseError,
    lastError: XmlParseError
  ): boolean {
    return lastError.endLine + 1 === error.startLine && error.startColumn === 1;
  }

  parseErrorMessage(error: string): XmlParseError {
    const [startLine, startColumn, message] = error
      .split(/([0-9]+):([0-9]+):\s(.+)/)
      .filter((i) => i);
    return new XmlParseError({
      startLine: +startLine,
      startColumn: +startColumn,
      message,
    });
  }

  setCurrentFileListener(): void {
    this.currentFileSubscription = this.codeService.curFileObservable.subscribe(
      {
        next: (data): void => {
          this.flowGenerator.postMessage(data.data);
        },
      }
    );
  }

  setConnectionEventListeners(): void {
    this.jsPlumbInstance.bind('connection', (info, originalEvent) => {
      if (originalEvent) {
        const sourceName = info.sourceEndpoint.anchor.elementId;
        const targetName = info.targetEndpoint.anchor.elementId;

        this.flowStructureService.addConnection(sourceName, targetName);
      }
    });

    this.jsPlumbInstance.bind('connectionDetached', (info, originalEvent) => {
      if (originalEvent) {
        const sourceName = info.sourceEndpoint.anchor.elementId;
        const targetName = info.targetEndpoint.anchor.elementId;

        this.flowStructureService.deleteConnection(sourceName, targetName);
      }
    });

    this.jsPlumbInstance.bind('dblclick', (info, originalEvent) => {
      if (originalEvent) {
        const sourceName = info.source.children[0].children[2].innerHTML.trim();
        const targetName = info.target.children[0].children[2].innerHTML.trim();

        if (sourceName && targetName) {
          this.flowStructureService.deleteConnection(sourceName, targetName);
        }
      }
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
