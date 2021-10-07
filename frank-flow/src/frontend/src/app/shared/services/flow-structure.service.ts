/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />

import { Injectable } from '@angular/core';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
import { Subject, Subscription } from 'rxjs';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';
import { FlowNodeAttributes } from '../models/flow-node-attributes.model';
import Listener from '../../flow/node/nodes/listener.model';
import Pipe from '../../flow/node/nodes/pipe.model';
import { CurrentFileService } from './current-file.service';
import { File } from '../models/file.model';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  private currentFile!: File;
  structure: any = {};
  positionsUpdate = false;

  monacoEditorComponent?: MonacoEditorComponent;

  constructor(private currentFileService: CurrentFileService) {
    this.getCurrentFile();
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe({
      next: (currentFile: File): void => {
        this.currentFile = currentFile;
      },
    });
  }

  setMonacoEditorComponent(monacoEditorComponent: MonacoEditorComponent): void {
    this.monacoEditorComponent = monacoEditorComponent;
  }

  addConnection(sourceName: string, targetName: string): void {
    this.positionsUpdate = true;
    const text = `\t\t\t\t<Forward name="success" path="${targetName}" />`;

    const elementAbove = this.getElementAboveForward(sourceName);
    const range = {
      startLineNumber: elementAbove.line,
      startColumn: elementAbove.column,
      endColumn: elementAbove.column,
      endLineNumber: elementAbove.line,
    };

    this.monacoEditorComponent?.applyEditsFuckingHell([{ range, text }], false);
  }

  getElementAboveForward(sourceName: string): FlowStructureNode {
    const currentPipe = this.structure.pipes.find(
      (pipe: FlowStructureNode) => pipe.attributes['name'].value === sourceName
    );

    const lastForward = currentPipe.forwards[currentPipe.forwards?.length - 1];

    if (lastForward) {
      return lastForward;
    }
    return currentPipe;
  }

  deleteConnection(sourceName: string, targetName: string): void {
    const targetForward = this.getTargetForward(sourceName, targetName);

    const text = '';
    const range = {
      startLineNumber: targetForward.line,
      startColumn: 0,
      endColumn: targetForward.column,
      endLineNumber: targetForward.line,
    };

    this.monacoEditorComponent?.applyEditsFuckingHell([{ range, text }], false);
  }

  getTargetForward(sourceName: string, targetName: string): FlowStructureNode {
    const sourcePipe = this.structure.pipes.find(
      (pipe: FlowStructureNode) => pipe.name === sourceName
    );

    return sourcePipe.forwards.find(
      (forward: FlowStructureNode) =>
        forward.attributes['path'].value === targetName
    );
  }

  addPipe(pipeData: Pipe): void {
    const pipes = this.structure.pipes;
    const lastPipe = pipes[pipes.length - 1] ?? this.structure.pipeline;
    const line =
      (pipes[pipes.length - 1] ? lastPipe.endLine : lastPipe.line) + 1;
    const pipeName = this.getUniquePipeName(pipeData.getName());

    const text = `\t\t\t<${pipeData.getType()} name="${pipeName}">\n\t\t\t</${pipeData.getType()}>\n`;
    const range = {
      startLineNumber: line,
      startColumn: lastPipe.startColumn,
      endColumn: lastPipe.endColumn,
      endLineNumber: line,
    };

    this.monacoEditorComponent?.applyEditsFuckingHell([{ range, text }], false);
  }

  getUniquePipeName(name: string): string {
    return this.getUniqueNodeName(this.structure.pipes, name);
  }

  getUniqueNodeName(
    nodes: FlowStructureNode[],
    name: string,
    increment?: number
  ): string {
    const nameIsUsed = nodes.find(
      (pipe: FlowStructureNode) => pipe.name === name + (increment ?? '')
    );

    if (nameIsUsed) {
      return this.getUniqueNodeName(nodes, name, (increment ?? 1) + 1);
    } else {
      return name + (increment ?? '');
    }
  }

  addListener(pipeData: Listener): void {
    const receivers = this.structure.receivers;
    const lastReceiver = receivers[receivers.length - 1];
    const listenerName = this.getUniqueListenerName(pipeData.getName());

    const text = `\t\t<Receiver name="${listenerName}">
        \t<${pipeData.getType()} name="${listenerName}" />
        </Receiver>\n`;
    const range = {
      startLineNumber: lastReceiver.endLine + 1,
      startColumn: lastReceiver.startColumn,
      endColumn: lastReceiver.endColumn,
      endLineNumber: lastReceiver.endLine + 1,
    };

    this.monacoEditorComponent?.applyEditsFuckingHell([{ range, text }], false);
  }

  getUniqueListenerName(name: string): string {
    return this.getUniqueNodeName(this.structure.listeners, name);
  }

  addExit(exitData: Exit): void {
    const exits = this.structure.exits;
    const lastExit =
      exits[exits.length - 1] ??
      this.structure.pipes[this.structure.pipes.length - 1];
    lastExit.line = exits[exits.length - 1] ? lastExit.line : lastExit.endLine;
    const exitName = this.getUniqueExitPath(exitData.getName());

    const text = `\t\t\t<${exitData.getType()} path="${exitName}" />\n`;
    const range = {
      startLineNumber: lastExit.line + 1,
      startColumn: lastExit.startColumn,
      endColumn: lastExit.endColumn,
      endLineNumber: lastExit.line + 1,
    };

    this.monacoEditorComponent?.applyEditsFuckingHell([{ range, text }], false);
  }

  getUniqueExitPath(name: string): string {
    return this.getUniqueNodeName(this.structure.exits, name);
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
    this.editAttributes('huh', nodeId, [
      { attribute: 'x', value: xPos },
      { attribute: 'y', value: yPos },
    ]);
  }

  // TODO: Cant edit attributes to fast. Need to have a new structure.
  editAttributes(
    dom: any,
    nodeId: string,
    attributes: { attribute: string; value: string | number }[],
    flowUpdate: boolean = false
  ): void {
    const node = this.currentFile.flowStructure?.nodes.find(
      (node: any) => node.name === nodeId
    );

    const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];

    if (node) {
      attributes.forEach((attribute) => {
        const editOperation = this.editAttribute(
          attribute.attribute,
          attribute.value,
          node.attributes
        );

        if (editOperation) {
          editOperations.push(editOperation);
        }
      });

      this.monacoEditorComponent?.applyEditsFuckingHell(
        editOperations,
        flowUpdate
      );
    }
  }

  editAttribute(
    key: string,
    value: any,
    attributeList: FlowNodeAttributes
  ): monaco.editor.IIdentifiedSingleEditOperation | void {
    const attribute = this.findAttribute(attributeList, key);

    if (attribute) {
      const escapedValue = this.escapeSpecialChars(value);
      this.escapeAttribute(attribute);

      const text = `${key}="${escapedValue}"`;
      const range = {
        startLineNumber: attribute.line,
        startColumn: attribute.startColumn,
        endColumn: attribute.endColumn,
        endLineNumber: attribute.line,
      };

      return { text, range };
    } else {
      this.createAttribute(key, value, attributeList, false);
    }
  }

  // this.structureSubscription?.unsubscribe();
  // const currentAttribute = attributes.pop();
  // if (currentAttribute) {
  //   if (attributes) {
  //     this.structureSubscription = this.structureSubject
  //       .asObservable()
  //       .subscribe({
  //         next: (data) => {
  //           this.structure = data;
  //           this.editAttributes(structureNodes, nodeId, attributes);
  //         },
  //       });
  //   }
  //   const node = this.structure[structureNodes]?.find(
  //     (node: any) => node.name === nodeId
  //   );
  //   if (node) {
  //     this.editAttribute(
  //       currentAttribute.attribute,
  //       currentAttribute.value,
  //       node.attributes,
  //       attributes.length !== 0
  //     );
  //     this.updateStructure();
  //   }
  // }

  //
  // editAttributes(
  //   structureNodes: string,
  //   nodeId: string,
  //   attributes: { attribute: string; value: string | number }[]
  // ): void {
  //   const currentAttribute = attributes.pop();
  //   if (currentAttribute) {
  //     // if (attributes) {
  //     //   this.editAttributes(structureNodes, nodeId, attributes);
  //     // }
  //
  //     const node = this.currentFile.flowStructure?.nodes.find(
  //       (node: any) => node.name === nodeId
  //     );
  //
  //     const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = []
  //
  //     attributes.forEach((attribute) => {
  //
  //     })
  //     if (node) {
  //       this.editAttribute(
  //         currentAttribute.attribute,
  //         currentAttribute.value,
  //         node.attributes,
  //         attributes.length !== 0
  //       );
  //     }
  //   }
  // }
  //
  // editAttribute(
  //   key: string,
  //   value: any,
  //   attributeList: FlowNodeAttributes,
  //   flowUpdate = false
  // ): monaco.editor.IIdentifiedSingleEditOperation {
  //   const attribute = this.findAttribute(attributeList, key);
  //
  //   if (attribute) {
  //     const escapedValue = this.escapeSpecialChars(value);
  //     this.escapeAttribute(attribute);
  //
  //     const text = `${key}="${escapedValue}"`;
  //     const range = {
  //       startLineNumber: attribute.line,
  //       startColumn: attribute.startColumn,
  //       endColumn: attribute.endColumn,
  //       endLineNumber: attribute.line,
  //     };
  //
  //     this.monacoEditorComponent?.applyEdits([{range, text}], flowUpdate);
  //   } else {
  //     this.createAttribute(key, value, attributeList, flowUpdate);
  //   }
  // }

  findAttribute(
    attributeList: FlowNodeAttributes,
    search: string
  ): FlowNodeAttribute | undefined {
    let attribute: FlowNodeAttribute | undefined = undefined;

    Object.entries(attributeList).forEach(
      ([attributeKey, currentAttribute]: [string, FlowNodeAttribute]) => {
        if (attributeKey === search) {
          attribute = currentAttribute;
        }
      }
    );

    return attribute;
  }

  escapeSpecialChars(value: any): string {
    return typeof value === 'string'
      ? value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;')
      : value;
  }

  escapeAttribute(attribute: FlowNodeAttribute): void {
    const escapedValue = this.escapeSpecialChars(attribute.value);
    const lengthDifferance = escapedValue.length - attribute.value.length;
    attribute.startColumn -= lengthDifferance;
  }

  deleteAttribute(
    key: string,
    attributeList: FlowNodeAttributes,
    flowUpdate = false
  ): void {
    const attribute = this.findAttribute(attributeList, key);

    if (attribute) {
      const text = ``;
      this.escapeAttribute(attribute);
      const range = {
        startLineNumber: attribute.line,
        startColumn: attribute.startColumn,
        endColumn: attribute.endColumn,
        endLineNumber: attribute.line,
      };
      this.monacoEditorComponent?.applyEditsFuckingHell(
        [{ range, text }],
        flowUpdate
      );
    }
  }

  createAttribute(
    key: string,
    value: any,
    attributeList: FlowNodeAttributes,
    flowUpdate: boolean = false
  ): void {
    if (Object.entries(attributeList).length === 0) {
      return;
    }

    const text = ` ${key}="${this.escapeSpecialChars(value)}"`;
    const lastAttribute = this.findLastAttribute(attributeList);
    if (lastAttribute) {
      const range = {
        startLineNumber: lastAttribute.line,
        endLineNumber: lastAttribute.line,
        startColumn: lastAttribute.endColumn,
        endColumn: lastAttribute.endColumn,
      };

      this.monacoEditorComponent?.applyEditsFuckingHell(
        [{ text, range }],
        flowUpdate
      );
    }
  }

  findLastAttribute(
    attributeList: FlowNodeAttributes
  ): FlowNodeAttribute | undefined {
    let currentLastAttribute: FlowNodeAttribute | undefined = undefined;

    Object.entries(attributeList).forEach(
      ([attributeKey, attribute]: [string, FlowNodeAttribute]) => {
        if (!currentLastAttribute) {
          currentLastAttribute = attribute;
        }
        if (attribute.line > currentLastAttribute.line) {
          currentLastAttribute = attribute;
        } else if (attribute.endColumn > currentLastAttribute.endColumn) {
          currentLastAttribute = attribute;
        }
      }
    );

    return currentLastAttribute;
  }
}
