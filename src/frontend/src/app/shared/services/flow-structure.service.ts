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

    // this.structure.next(this.structure.value);
  }

  editListenerPositions(
    listenerId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    // const root = Object.keys(this.structure.value)[0];
    // const receiver = this.structure.value[root].Adapter[0].Receiver[0];

    // if (receiver[type]) {
    //   receiver[type].forEach((listener: any) => {
    //     for (const attr in listener.$) {
    //       if (listener.$[attr] === listenerId) {
    //         listener.$.x = xPos;
    //         listener.$.y = yPos;
    //       }
    //     }
    //   });
    // }

    console.log(this.structure.value);
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

    if (x && y) {
      console.log('xy: ', x, y);
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

      console.log('DIFF: ', diff);
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

    // this.structure.next(this.structure.value);
  }

  editPipePositions(
    pipeId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    // const root = Object.keys(this.structure.value)[0];
    // const pipeline = this.structure.value[root].Adapter[0].Pipeline[0];
    // if (pipeline[type]) {
    //   pipeline[type].forEach((node: any) => {
    //     for (const attr in node.$) {
    //       if (node.$[attr] === pipeId) {
    //         node.$.x = xPos;
    //         node.$.y = yPos;
    //       }
    //     }
    //   });
    // }
    // this.structure.next(this.structure.value);
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
