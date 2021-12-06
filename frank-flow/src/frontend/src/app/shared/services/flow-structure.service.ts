/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />

import { Injectable } from '@angular/core';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';
import { FlowNodeAttributes } from '../models/flow-node-attributes.model';
import Listener from '../../flow/node/nodes/listener.model';
import Pipe from '../../flow/node/nodes/pipe.model';
import { CurrentFileService } from './current-file.service';
import { File } from '../models/file.model';
import { FlowStructure } from '../models/flow-structure.model';
import { ChangedAttribute } from '../models/changed-attribute.model';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  public monacoEditorComponent?: MonacoEditorComponent;
  private currentFile!: File;
  private flowStructure!: FlowStructure;
  private waitingOnNewStructure = false;
  private editAttributeQueue: Map<string, ChangedAttribute[]> = new Map();
  private flowUpdate!: boolean;

  constructor(private currentFileService: CurrentFileService) {
    this.getCurrentFile();
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe({
      next: (currentFile: File): void => {
        this.currentFile = currentFile;
        if (currentFile.flowStructure) {
          this.setFlowStructure(currentFile.flowStructure);
        }
      },
    });
  }

  setFlowStructure(flowStructure: FlowStructure): void {
    if (this.flowStructure !== flowStructure) {
      this.flowStructure = flowStructure;
      this.waitingOnNewStructure = false;
      this.attemptEditAttributes();
    }
  }

  setMonacoEditorComponent(monacoEditorComponent: MonacoEditorComponent): void {
    this.monacoEditorComponent = monacoEditorComponent;
  }

  highlightPipe(nodeName: string, nodeType: string) {
    const currentNode = this.flowStructure.nodes.find(
      (node: FlowStructureNode) =>
        node.name === nodeName && node.type === nodeType
    );

    if (currentNode) {
      const range: monaco.IRange = {
        startLineNumber: currentNode.line,
        startColumn: 0,
        endColumn: 0,
        endLineNumber: currentNode.endLine + 1,
      };

      this.monacoEditorComponent?.highlightText(range);
    }
  }

  addConnection(sourceId: string, targetId: string): void {
    const endLine = this.getEndLineOfSourceElement(sourceId);
    const target = this.flowStructure.nodes.find(
      (node) => node.uid == targetId
    );

    const text = `\t\t\t\t<Forward name="success" path="${target?.name}" />\n`;
    const range = {
      startLineNumber: endLine,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: endLine,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }]);
  }

  getEndLineOfSourceElement(sourceId: string): number {
    const currentPipe = this.flowStructure.pipes.find(
      (pipe: FlowStructureNode) => pipe.uid === sourceId
    );

    return currentPipe!.endLine;
  }

  deleteConnection(
    sourceId: string,
    targetId: string,
    doubleClickEvent = false
  ): void {
    const targetForward = this.getTargetForward(sourceId, targetId);

    const text = '';
    const range = {
      startLineNumber: targetForward.line,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: targetForward.line + 1,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }], doubleClickEvent);
  }

  moveConnection(
    originalSourceId: string,
    originalTargetId: string,
    newTargetId: string
  ): void {
    const targetForward = this.getTargetForward(
      originalSourceId,
      originalTargetId
    );

    const pathAttribute = targetForward.attributes['path'];
    const newTarget = this.flowStructure.nodes.find(
      (node) => node.uid === newTargetId
    );

    const text = `path="${newTarget?.name}"`;
    const range = {
      startLineNumber: pathAttribute.line,
      startColumn: pathAttribute.startColumn,
      endColumn: pathAttribute.endColumn,
      endLineNumber: pathAttribute.line,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }]);
  }

  getTargetForward(sourceId: string, targetId: string): FlowStructureNode {
    const sourcePipe = this.flowStructure.pipes.find(
      (pipe: FlowStructureNode) => pipe.uid === sourceId
    );
    const targetPipe = this.flowStructure.nodes.find(
      (pipe: FlowStructureNode) => pipe.uid === targetId
    );

    return (sourcePipe?.forwards ?? []).find(
      (forward: FlowStructureNode) =>
        forward.attributes['path'].value === targetPipe?.name
    );
  }

  changeFirstPipe(newFirstPipe: string): void {
    const firstPipe = this.flowStructure.pipeline.attributes['firstPipe'];

    const text = `firstPipe="${newFirstPipe}"`;
    const range = {
      startLineNumber: firstPipe.line,
      startColumn: firstPipe.startColumn,
      endColumn: firstPipe.endColumn,
      endLineNumber: firstPipe.line,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }]);
  }

  addPipe(pipeData: Pipe): void {
    const pipes = this.flowStructure.pipes;
    const lastPipe = pipes[pipes.length - 1] ?? this.flowStructure.pipeline;
    const line =
      (pipes[pipes.length - 1] ? lastPipe.endLine : lastPipe.line) + 1;
    const pipeName = this.getUniquePipeName(pipeData.getName());

    const text = `\t\t\t<${pipeData.getType()} name="${pipeName}">\n\t\t\t</${pipeData.getType()}>\n`;
    const range = {
      startLineNumber: line,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: line,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }], true);
  }

  getUniquePipeName(name: string): string {
    return this.getUniqueNodeName(this.flowStructure.pipes, name);
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
    const line = this.flowStructure.pipeline.line;
    const listenerName = this.getUniqueListenerName(pipeData.getName());

    const text = `\t\t<Receiver name="${listenerName}Receiver">\n\t\t\t<${pipeData.getType()} name="${listenerName}" />\n\t\t</Receiver>\n`;
    const range = {
      startLineNumber: line,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: line,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }], true);
  }

  getUniqueListenerName(name: string): string {
    return this.getUniqueNodeName(this.flowStructure.listeners, name);
  }

  addExit(exitData: Exit): void {
    const exits = this.flowStructure.exits;
    const lastExit = exits[exits.length - 1] ?? this.flowStructure.pipeline;
    const line = lastExit.line + 1;
    const exitName = this.getUniqueExitPath(exitData.getName());

    const text = `\t\t\t<${exitData.getType()} path="${exitName}" />\n`;
    const range = {
      startLineNumber: line,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: line,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }], true);
  }

  getUniqueExitPath(name: string): string {
    return this.getUniqueNodeName(this.flowStructure.exits, name);
  }

  editNodePositions(options: {
    nodeId: string;
    xPos: number;
    yPos: number;
  }): void {
    this.editAttributes({
      nodeId: options.nodeId,
      attributes: [
        { name: 'x', value: options.xPos },
        { name: 'y', value: options.yPos },
      ],
      flowUpdate: false,
    });
  }

  editAttributes(options: {
    nodeId: string;
    attributes: ChangedAttribute[];
    flowUpdate: boolean;
  }): void {
    this.flowUpdate = options.flowUpdate;
    let nodeAttributes: ChangedAttribute[] = [];

    options.attributes.forEach((attribute) => {
      nodeAttributes =
        this.editAttributeQueue.get(options.nodeId) ?? nodeAttributes;
      if (nodeAttributes.length > 0) {
        nodeAttributes = this.addChangedAttributeToNode({
          nodeId: options.nodeId,
          nodeAttributes,
          attribute,
        });
      } else {
        nodeAttributes.push(attribute);
      }
      this.editAttributeQueue.set(options.nodeId, nodeAttributes);
    });
    this.attemptEditAttributes();
  }

  addChangedAttributeToNode(options: {
    nodeId: string;
    nodeAttributes: ChangedAttribute[];
    attribute: ChangedAttribute;
  }) {
    const indexOfSameAttribute = this.getIndexOfSameAttribute(
      options.nodeId,
      options.attribute.name
    );
    if (indexOfSameAttribute !== undefined) {
      options.nodeAttributes[indexOfSameAttribute] = options.attribute;
    } else {
      options.nodeAttributes.push(options.attribute);
    }
    return options.nodeAttributes;
  }

  getIndexOfSameAttribute(nodeId: string, name: string): number | undefined {
    const sameAttributeIndex = this.editAttributeQueue
      .get(nodeId)
      ?.findIndex((changedAttribute) => changedAttribute.name === name);
    return sameAttributeIndex !== undefined && sameAttributeIndex >= 0
      ? sameAttributeIndex
      : undefined;
  }

  attemptEditAttributes(): void {
    if (this.canApplyEditAttributes()) {
      this.waitingOnNewStructure = true;
      const editOperations = this.getEditOperationsForChangedAttributes();
      if (editOperations) {
        this.monacoEditorComponent?.applyEdits(editOperations, this.flowUpdate);
      }
      this.editAttributeQueue.clear();
    }
  }

  canApplyEditAttributes(): boolean {
    return !this.waitingOnNewStructure && this.editAttributeQueue.size > 0;
  }

  getEditOperationsForChangedAttributes():
    | monaco.editor.IIdentifiedSingleEditOperation[]
    | void {
    for (const [nodeId, editAttributes] of this.editAttributeQueue.entries()) {
      const node = this.currentFile.flowStructure?.nodes.find(
        (node: FlowStructureNode) => node.uid === nodeId
      );

      const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];

      if (node) {
        editAttributes.forEach((attribute) => {
          const editOperation = this.editAttribute(
            attribute.name,
            attribute.value,
            node.attributes
          );

          if (editOperation) {
            editOperations.push(editOperation);
          }
        });

        return editOperations;
      }
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
      this.createAttribute(key, value, attributeList);
    }
  }

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
      this.monacoEditorComponent?.applyEdits([{ range, text }], flowUpdate);
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

      this.monacoEditorComponent?.applyEdits([{ text, range }], flowUpdate);
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
