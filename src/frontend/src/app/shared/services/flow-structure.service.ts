import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, pipe, Subject } from 'rxjs';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import { CodeService } from './code.service';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  structure = new BehaviorSubject<any>({});

  monacoEditorComponent?: MonacoEditorComponent;

  structureObservable = this.structure.asObservable();

  constructor() {}

  setStructure(structure: any): void {
    this.structure.next(structure);
  }

  setEditorComponent(monacoEditorComponent: MonacoEditorComponent): void {
    this.monacoEditorComponent = monacoEditorComponent;
  }

  addPipe(pipeData: any): void {
    const root = Object.keys(this.structure.value)[0];
    const pipeline = this.structure.value[root].Adapter[0].Pipeline[0];

    if (pipeline[pipeData.name]) {
      pipeline[pipeData.name].push(this.generateNewNode(pipeData.name));
    } else {
      pipeline[pipeData.name] = this.generateNewNode(pipeData.name);
    }

    this.structure.next(this.structure.value);
  }

  addListener(pipeData: any): void {
    const root = Object.keys(this.structure.value)[0];
    const receiver = this.structure.value[root].Adapter[0].Receiver[0];

    if (receiver[pipeData.name]) {
      receiver[pipeData.name].push(this.generateNewNode(pipeData.name));
    } else {
      receiver[pipeData.name] = this.generateNewNode(pipeData.name);
    }
  }

  editListenerPositions(
    listenerId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    const root = this.structure.value;
    let x: any;
    let y: any;

    root.listeners.forEach((listener: any) => {
      if (listener.name === listenerId) {
        listener.attributes.forEach((attr: any) => {
          if (attr.x) {
            x = attr;
          } else if (attr.y) {
            y = attr;
          }
        });
      }
    });

    this.editPositions(x, y, xPos, yPos);
  }

  editPipePositions(
    pipeId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    const root = this.structure.value;
    let x: any;
    let y: any;

    for (const key in root.pipes) {
      if (key === pipeId) {
        root.pipes[key].attributes.forEach((attr: any) => {
          if (attr.x) {
            x = attr;
          } else if (attr.y) {
            y = attr;
          }
        });
      }
    }

    this.editPositions(x, y, xPos, yPos);
  }

  editExitPositions(
    exitId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    const root = this.structure.value;
    let x: any;
    let y: any;
    let pathFound = false;

    root.exits.forEach((exit: any) => {
      exit.attributes.forEach((attr: any) => {
        // TODO: (edge case) make sure path exists before x and y;
        if (attr.path && attr.path === exitId) {
          pathFound = true;
        }
        if (attr.x && pathFound) {
          x = attr;
        } else if (attr.y && pathFound) {
          y = attr;
        }
      });
      pathFound = false;
    });

    this.editPositions(x, y, xPos, yPos);
  }

  editPositions(x: any, y: any, xPos: number, yPos: number): void {
    if (x && y) {
      this.monacoEditorComponent?.applyEdit(
        {
          startLineNumber: x.line,
          startColumn: x.startColumn,
          endColumn: x.endColumn,
          endLineNumber: x.line,
        },
        'x="' + xPos + '"'
      );

      const diff = String(x.x).length - String(xPos).length;

      this.monacoEditorComponent?.applyEdit(
        {
          startLineNumber: y.line,
          startColumn: y.startColumn - diff,
          endColumn: y.endColumn - diff,
          endLineNumber: y.line,
        },
        'y="' + yPos + '"'
      );
    }
  }

  generateNewNode(name: string): any {
    const newNode = {
      $: {
        name,
      },
    };

    return newNode;
  }
}
