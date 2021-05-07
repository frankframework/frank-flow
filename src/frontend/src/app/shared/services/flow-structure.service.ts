import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, pipe, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
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
    console.log('new structure');
    this.structure = structure;
  }

  setEditorComponent(monacoEditorComponent: MonacoEditorComponent): void {
    this.monacoEditorComponent = monacoEditorComponent;
  }

  addPipe(pipeData: any): void {
    const root = this.structure;
    const pipes = root.pipes;
    let lastPipe;

    const newPipe =
      '\n\t  <' +
      pipeData.type +
      ' name="' +
      pipeData.name +
      '" x="' +
      pipeData.left +
      '" y="' +
      pipeData.top +
      '">' +
      '\n\n\t  </' +
      pipeData.type +
      '> \n';

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

    const newListener =
      '\t  <' +
      pipeData.type +
      ' name="' +
      pipeData.name +
      '" x="' +
      pipeData.left +
      '" y="' +
      pipeData.top +
      '" />\n';
    console.log('add', pipeData, listeners[listeners.length - 1]);

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

    const newExit =
      '\t  <' +
      exitData.getType() +
      ' path="' +
      exitData.getName() +
      '" x="' +
      exitData.getLeft() +
      '" y="' +
      exitData.getTop() +
      '" />\n';
    console.log('add', exitData, exits[exits.length - 1]);

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

  editListenerPositions(
    listenerId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    this.structure.listeners.forEach((listener: any) => {
      if (listener.name === listenerId) {
        console.log('exit: ', listener);
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

  editPipePositions(
    pipeId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    for (const key in this.structure.pipes) {
      if (key === pipeId) {
        this.editAttribute('x', xPos, this.structure.pipes[key].attributes);
      }
    }

    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );

    setTimeout(() => {
      console.log('AFTER: ', this.structure);
      for (const key in this.structure.pipes) {
        if (key === pipeId) {
          this.editAttribute('y', yPos, this.structure.pipes[key].attributes);
        }
      }
    }, 100);
  }

  editExitPositions(
    exitId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    this.structure.exits.forEach((exit: any) => {
      if (exit.path === exitId) {
        console.log('exit: ', exit);
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
        console.log('val is: ', attr);
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
        // this.reloadStructure();
      }
    });
  }
}
