import { Injectable } from '@angular/core';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
import { Subject, Subscription } from 'rxjs';
import { FlowTreeNode } from '../models/flowTreeNode.model';

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
      this.flowGenerator = new Worker('../workers/flow-generator.worker', {
        type: 'module',
      });

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
    this.structure = structure;
  }

  setEditorComponent(monacoEditorComponent: MonacoEditorComponent): void {
    this.monacoEditorComponent = monacoEditorComponent;
  }

  addConnection(sourceName: string, targetName: string): void {
    const pipes = this.structure.pipes;
    const newForward =
      '\n\t <Forward name="success" path="' + targetName + '" />\n';
    let lastForward;
    const currentPipe = pipes.find(
      (pipe: FlowTreeNode) => pipe.name === sourceName
    );
    const forwards = currentPipe.forwards;
    if (forwards) {
      lastForward = forwards[forwards.length - 1];
    }

    if (currentPipe) {
      if (lastForward) {
        this.monacoEditorComponent?.applyEdit(
          {
            startLineNumber: lastForward.line + 1,
            startColumn: lastForward.column,
            endColumn: lastForward.column,
            endLineNumber: lastForward.line + 1,
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
    const root = this.structure;
    const listeners = root.listeners;
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
    const root = this.structure;
    const exits = root.exits;
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
          this.editNodePosition(data[structureNodes], nodeId, 'y', yPos),
      });
    this.editNodePosition(this.structure[structureNodes], nodeId, 'x', xPos);
    this.updateStructure();
  }

  editNodePosition(
    structureNodes: any,
    nodeId: string,
    positionType: string,
    position: number
  ): void {
    console.log(structureNodes);
    const node = structureNodes.find(
      (structureNode: any) =>
        structureNode.name === nodeId || structureNode.path === nodeId
    );
    this.editAttribute(positionType, position, node.attributes);
  }

  editAttribute(key: string, value: any, attributeList: any[]): void {
    attributeList.forEach((attr: any) => {
      if (attr[key]) {
        const newValue = `${key}="${value}"`;
        this.monacoEditorComponent?.applyEdit(
          {
            startLineNumber: attr.line,
            startColumn: attr.startColumn,
            endColumn: attr.endColumn,
            endLineNumber: attr.line,
          },
          newValue,
          true
        );
      }
    });
  }
}
