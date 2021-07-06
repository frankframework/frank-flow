import { Injectable } from '@angular/core';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
import { Subject, Subscription } from 'rxjs';
import { FlowStructureNode } from '../models/flowStructureNode.model';
import { FlowNodeAttribute } from '../models/flowNodeAttribute.model';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  structure: any = {};
  structureObservable: Subject<any> = new Subject<any>();
  positionsUpdate = false;

  flowGenerator?: Worker;
  monacoEditorComponent?: MonacoEditorComponent;
  structureSubscription?: Subscription;

  constructor() {
    this.initializeWorker();
  }

  initializeWorker(): void {
    if (Worker) {
      this.flowGenerator = new Worker(
        new URL('../../shared/workers/flow-generator.worker', import.meta.url),
        {
          name: 'flow-generator',
          type: 'module',
        }
      );

      this.flowGenerator.onmessage = ({ data }) => {
        if (data) {
          this.structure = data;
          this.structureObservable.next(data);
        }
      };
    }
  }

  updateStructure(): void {
    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );
  }

  setStructure(structure: any): void {
    this.structureObservable.next(structure);
    this.structure = structure;
  }

  getStructure(): any {
    return this.structure;
  }

  refreshStructure(): void {
    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );
  }

  setEditorComponent(monacoEditorComponent: MonacoEditorComponent): void {
    this.monacoEditorComponent = monacoEditorComponent;
  }

  addConnection(sourceName: string, targetName: string): void {
    this.positionsUpdate = true;
    const pipes = this.structure.pipes;
    const newForward =
      '\n\t\t<Forward name="success" path="' + targetName + '" />';
    let lastForward;
    const currentPipe = pipes.find(
      (pipe: FlowStructureNode) => pipe.attributes['name'].value === sourceName
    );
    const forwards = currentPipe.forwards;
    if (forwards) {
      lastForward = forwards[forwards.length - 1];
    }

    if (currentPipe) {
      if (lastForward) {
        this.monacoEditorComponent?.applyEdit(
          {
            startLineNumber: lastForward.line,
            startColumn: lastForward.column,
            endColumn: lastForward.column,
            endLineNumber: lastForward.line,
          },
          newForward,
          false
        );
      } else {
        this.monacoEditorComponent?.applyEdit(
          {
            startLineNumber: currentPipe.line - 1,
            startColumn: currentPipe.column,
            endColumn: currentPipe.column,
            endLineNumber: currentPipe.line - 1,
          },
          newForward,
          false
        );
      }
    }
  }

  deleteConnection(sourceName: string, targetName: string): void {
    const sourcePipe = this.structure.pipes.find(
      (pipe: FlowStructureNode) => pipe.name === sourceName
    );
    const targetForward = sourcePipe.forwards.find(
      (forward: FlowStructureNode) => forward.name === targetName
    );

    if (targetForward) {
      this.monacoEditorComponent?.applyEdit(
        {
          startLineNumber: targetForward.line,
          startColumn: 0,
          endColumn: targetForward.column,
          endLineNumber: targetForward.line,
        },
        '',
        false
      );
    }
  }

  addPipe(pipeData: any): void {
    const pipes = this.structure.pipes;
    const newPipe = `\n\t  <${pipeData.type} name="${pipeData.name}" x="${pipeData.left}" y="${pipeData.top}">\n\t  </${pipeData.type}>`;

    const lastPipe = pipes[pipes.length - 1];

    if (lastPipe) {
      this.monacoEditorComponent?.applyEdit(
        {
          startLineNumber: lastPipe.line + 1,
          startColumn: lastPipe.startColumn,
          endColumn: lastPipe.endColumn,
          endLineNumber: lastPipe.line + 1,
        },
        newPipe,
        false
      );
    }
  }

  addListener(pipeData: any): void {
    const listeners = this.structure.pipes;
    const lastListener = listeners[listeners.length - 1];

    const newListener = `\t  <${pipeData.type} name="${pipeData.name}" x="${pipeData.left}" y="${pipeData.top}" />\n`;

    this.monacoEditorComponent?.applyEdit(
      {
        startLineNumber: lastListener.line + 1,
        startColumn: lastListener.startColumn,
        endColumn: lastListener.endColumn,
        endLineNumber: lastListener.line + 1,
      },
      newListener,
      false
    );
  }

  addExit(exitData: Exit): void {
    const exits = this.structure.exits;
    const lastListener = exits[exits.length - 1];

    const newExit = `\t  <${exitData.getType()} path="${exitData.getName()}" x="${exitData.getLeft()}" y="${exitData.getTop()}" />\n`;

    this.monacoEditorComponent?.applyEdit(
      {
        startLineNumber: lastListener.line + 1,
        startColumn: lastListener.startColumn,
        endColumn: lastListener.endColumn,
        endLineNumber: lastListener.line + 1,
      },
      newExit,
      false
    );
  }

  editListenerPositions(nodeId: string, xPos: number, yPos: number): void {
    this.editNodePositions('listeners', nodeId, xPos, yPos);
  }

  editExitPositions(nodeId: string, xPos: number, yPos: number): void {
    this.editNodePositions('exits', nodeId, xPos, yPos);
  }

  editPipePositions(nodeId: string, xPos: number, yPos: number): void {
    this.editNodePositions('pipes', nodeId, xPos, yPos);
  }

  editNodePositions(
    structureNodes: string,
    nodeId: string,
    xPos: number,
    yPos: number
  ): void {
    this.structureSubscription?.unsubscribe();
    this.structureSubscription = this.structureObservable
      .asObservable()
      .subscribe({
        next: (data) =>
          this.editNodePosition(data[structureNodes], nodeId, 'y', yPos, false),
      });
    this.editNodePosition(
      this.structure[structureNodes],
      nodeId,
      'x',
      xPos,
      true
    );
    this.updateStructure();
  }

  editNodePosition(
    structureNodes: any,
    nodeId: string,
    positionType: string,
    position: number,
    flowUpdate: boolean
  ): void {
    const node = structureNodes.find((node: any) => node.name === nodeId);
    this.editAttribute(positionType, position, node.attributes, flowUpdate);
  }

  editAttribute(
    key: string,
    value: any,
    attributeList: any[],
    flowUpdate = false
  ): void {
    Object.entries(attributeList).forEach(
      ([attributeKey, attribute]: [string, FlowNodeAttribute]) => {
        if (attributeKey === key) {
          const newValue = `${key}="${value}"`;
          this.monacoEditorComponent?.applyEdit(
            {
              startLineNumber: attribute.line,
              startColumn: attribute.startColumn,
              endColumn: attribute.endColumn,
              endLineNumber: attribute.line,
            },
            newValue,
            flowUpdate
          );
        }
      }
    );
  }
}
