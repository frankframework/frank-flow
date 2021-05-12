import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, pipe, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
import { FlowTree } from '../models/flowTree.model';
import { FlowTreeNode } from '../models/flowTreeNode.model';
import { CodeService } from './code.service';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  structure: any = {};
  positionsUpdate = false;

  flowGenerator?: Worker;
  monacoEditorComponent?: MonacoEditorComponent;

  constructor() {
    if (Worker) {
      const flowGenerator = new Worker('../workers/flow-generator.worker', {
        type: 'module',
      });
      this.flowGenerator = flowGenerator;

      this.flowGenerator.onmessage = ({ data }) => {
        if (data) {
          this.structure = data;
        }
      };
    }
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
      '\n\t\t<Forward name="success" path="' + targetName + '" />';
    let lastForward;
    let currentPipe;
    for (const key in pipes) {
      if (key === sourceName) {
        const forwards = pipes[key].forwards;
        currentPipe = pipes[key];
        lastForward = forwards[forwards.length - 1];
      }
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
    const pipes = this.structure.pipes;

    let targetForward: any;

    for (const key in pipes) {
      if (key === sourceName) {
        const forwards = pipes[key].forwards;
        forwards.forEach((element: FlowTreeNode) => {
          if (element.path === targetName) {
            targetForward = element;
          }
        });
      }
    }

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
    const root = this.structure;
    const pipes = root.pipes;
    let lastPipe;

    const newPipe = `\n\t
    <${pipeData.type}  name="${pipeData.name}" x="${pipeData.left}'" y="${pipeData.top}">
    \n\n\t</${pipeData.type}>\n`;

    const line = 0;
    for (const key in pipes) {
      if (pipes[key].line > line) {
        lastPipe = pipes[key];
      }
    }

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

    const newExit = `\t  <${exitData.getType()} name="${exitData.getName()}" x="${exitData.getLeft()}" y="${exitData.getTop()}" />\n`;

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

  editListenerPositions(listenerId: string, xPos: number, yPos: number): void {
    this.structure.listeners.forEach((listener: any) => {
      if (listener.name === listenerId) {
        this.editAttribute('x', xPos, listener.attributes);
      }
    });

    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );

    setTimeout(() => {
      this.structure.listeners.forEach((listener: any) => {
        if (listener.name === listenerId) {
          this.editAttribute('y', yPos, listener.attributes);
        }
      });
    }, 100);
  }

  editPipePositions(pipeId: string, xPos: number, yPos: number): void {
    for (const key in this.structure.pipes) {
      if (key === pipeId) {
        this.editAttribute('x', xPos, this.structure.pipes[key].attributes);
      }
    }

    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );

    setTimeout(() => {
      for (const key in this.structure.pipes) {
        if (key === pipeId) {
          this.editAttribute('y', yPos, this.structure.pipes[key].attributes);
        }
      }
    }, 100);
  }

  editExitPositions(exitId: string, xPos: number, yPos: number): void {
    this.structure.exits.forEach((exit: any) => {
      if (exit.path === exitId) {
        this.editAttribute('x', xPos, exit.attributes);
      }
    });

    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );

    setTimeout(() => {
      this.structure.exits.forEach((exit: any) => {
        if (exit.path === exitId) {
          this.editAttribute('y', yPos, exit.attributes);
        }
      });
    }, 100);
  }

  editAttribute(key: string, value: any, attributeList: any[]): void {
    attributeList.forEach((attr: any) => {
      if (attr[key]) {
        const newValue = key + '="' + value + '"';
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
    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );
  }
}
