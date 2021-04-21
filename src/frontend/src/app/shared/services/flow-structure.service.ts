import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, pipe, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  structure = new BehaviorSubject<any>({});

  structureObservable = this.structure.asObservable();

  constructor() {}

  setStructure(structure: any): void {
    this.structure.next(structure);
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

    this.structure.next(this.structure.value);
  }

  editListenerPositions(
    listenerId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    const root = Object.keys(this.structure.value)[0];
    const receiver = this.structure.value[root].Adapter[0].Receiver[0];

    if (receiver[type]) {
      receiver[type].forEach((listener: any) => {
        for (const attr in listener.$) {
          if (listener.$[attr] === listenerId) {
            listener.$.x = xPos;
            listener.$.y = yPos;
          }
        }
      });
    }

    this.structure.next(this.structure.value);
  }

  editPipePositions(
    pipeId: string,
    type: string,
    xPos: number,
    yPos: number
  ): void {
    const root = Object.keys(this.structure.value)[0];
    const pipeline = this.structure.value[root].Adapter[0].Pipeline[0];

    if (pipeline[type]) {
      pipeline[type].forEach((node: any) => {
        for (const attr in node.$) {
          if (node.$[attr] === pipeId) {
            node.$.x = xPos;
            node.$.y = yPos;
          }
        }
      });
    }

    this.structure.next(this.structure.value);
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
