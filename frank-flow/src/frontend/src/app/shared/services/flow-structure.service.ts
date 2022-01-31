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
import { PanZoomService } from './pan-zoom.service';
import Sender from '../../flow/node/nodes/sender.model';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  public monacoEditorComponent?: MonacoEditorComponent;
  public selectedNode?: FlowStructureNode;

  private currentFile!: File;
  private flowStructure!: FlowStructure;
  private waitingOnNewStructure = false;
  private editAttributeQueue: Map<string, ChangedAttribute[]> = new Map();
  private flowUpdate!: boolean;

  constructor(
    private currentFileService: CurrentFileService,
    private panZoomService: PanZoomService
  ) {
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

  selectNodeByPosition(position: monaco.Position): void {
    this.selectedNode = this.flowStructure?.nodes.find(
      (node: FlowStructureNode): boolean =>
        this.isNodeAtPosition(node, position)
    );
    this.resetHighlightNodeInXml();
    this.panToNode();
  }

  isNodeAtPosition(
    node: FlowStructureNode,
    position: monaco.Position
  ): boolean {
    return (
      node.line <= position.lineNumber &&
      node.endLine >= position.lineNumber &&
      node.type !== 'Receiver'
    );
  }

  panToNode(): void {
    if (this.selectedNode) {
      const x = +this.selectedNode.positions.x;
      const y = +this.selectedNode.positions.y;
      if (x && y) {
        this.panZoomService.panTo(x, y);
      }
    }
  }

  selectNodeById(nodeId: string): void {
    this.selectedNode = this.flowStructure.nodes.find(
      (node: FlowStructureNode) => node.uid === nodeId
    );
    this.highlightNodeInXml();
  }

  highlightNodeInXml() {
    if (this.selectedNode) {
      const range: monaco.IRange = {
        startLineNumber: this.selectedNode.line,
        startColumn: 0,
        endColumn: 0,
        endLineNumber: this.selectedNode.endLine + 1,
      };
      this.monacoEditorComponent?.setPosition({
        lineNumber: range.startLineNumber,
        column: range.startColumn,
      });
      this.monacoEditorComponent?.highlightText(range);
    }
  }

  resetSelectNode() {
    this.selectedNode = undefined;
    this.resetHighlightNodeInXml();
  }

  resetHighlightNodeInXml() {
    this.monacoEditorComponent?.highlightText({
      startLineNumber: 0,
      startColumn: 0,
      endLineNumber: 0,
      endColumn: 0,
    });
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

    const text = `path="${newTarget?.name ?? newTargetId}"`;
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
    const targetNode = this.flowStructure.nodes.find(
      (node: FlowStructureNode) => node.uid === targetId
    );

    return (sourcePipe?.forwards ?? []).find(
      (forward: FlowStructureNode) =>
        forward.attributes['path'].value === targetNode?.name
    );
  }

  setFirstPipeById(firstPipeId: string): void {
    const firstPipeName = this.flowStructure.pipes?.find(
      (pipe) => pipe.uid === firstPipeId
    )?.name;

    if (firstPipeName) {
      this.setFirstPipe(firstPipeName);
    }
  }

  removeFirstPipe(flowUpdate = true): void {
    const pipelineAttributes = this.flowStructure.pipeline.attributes;
    if (pipelineAttributes['firstPipe']?.value) {
      this.deleteAttribute('firstPipe', pipelineAttributes, flowUpdate);
    } else {
      this.currentFile.flowNeedsUpdate = true;
      this.currentFileService.updateCurrentFile(this.currentFile);
    }
  }

  setFirstPipe(firstPipe: string): void {
    const pipeline = this.flowStructure.pipeline;
    const firstPipeAttribute = { name: 'firstPipe', value: firstPipe };

    if (this.attributeListIsEmpty(pipeline.attributes)) {
      this.createFirstAttribute(firstPipeAttribute, pipeline, true);
    } else {
      this.editSingleAttribute(firstPipeAttribute, pipeline.attributes, true);
    }
  }

  editSingleAttribute(
    changedAttribute: ChangedAttribute,
    attributeList: FlowNodeAttributes,
    flowUpdate = false
  ): void {
    const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    const editAttributeOperation = this.editAttribute(
      changedAttribute,
      attributeList,
      flowUpdate
    );
    if (editAttributeOperation) {
      editOperations.push(editAttributeOperation);
    }
    this.monacoEditorComponent?.applyEdits(editOperations, true);
  }

  createFirstAttribute(
    attribute: ChangedAttribute,
    node: FlowStructureNode,
    flowUpdate = false
  ): void {
    const text = ` ${attribute.name}="${attribute.value}"`;
    const range = {
      startLineNumber: node.line,
      startColumn: node.startColumn,
      endColumn: node.startColumn,
      endLineNumber: node.line,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }], flowUpdate);
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

    return nameIsUsed
      ? this.getUniqueNodeName(nodes, name, (increment ?? 1) + 1)
      : name + (increment ?? '');
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

  addSender(node: Sender): void {
    const pipes = this.flowStructure.pipes;
    const lastPipe = pipes[pipes.length - 1] ?? this.flowStructure.pipeline;
    const line =
      (pipes[pipes.length - 1] ? lastPipe.endLine : lastPipe.line) + 1;
    const senderName = this.getUniqueSenderName(node.getName());

    const text = `\t\t<SenderPipe name="${senderName}Pipe">\n\t\t\t<${node.getType()} name="${senderName}" />\n\t\t</SenderPipe>\n`;
    const range = {
      startLineNumber: line,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: line,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }], true);
  }

  getUniqueSenderName(name: string): string {
    return this.getUniqueNodeName(this.flowStructure.senders, name);
  }

  editNodePositions(options: {
    nodeId: string;
    xPos: number;
    yPos: number;
  }): void {
    this.editAttributes({
      nodeId: options.nodeId,
      attributes: [
        { name: 'flow:x', value: options.xPos },
        { name: 'flow:y', value: options.yPos },
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

    for (const attribute of options.attributes) {
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
    }
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
        for (const attribute of editAttributes) {
          const editOperation = this.editAttribute(attribute, node.attributes);

          if (editOperation) {
            editOperations.push(editOperation);
          }
        }

        return editOperations;
      }
    }
  }

  editAttribute(
    changedAttribute: ChangedAttribute,
    attributeList: FlowNodeAttributes,
    flowUpdate = false
  ): monaco.editor.IIdentifiedSingleEditOperation | void {
    const attribute = this.findAttribute(attributeList, changedAttribute.name);

    if (attribute) {
      const escapedValue = this.escapeSpecialChars(changedAttribute.value);
      this.escapeAttribute(attribute);

      const text = `${changedAttribute.name}="${escapedValue}"`;
      const range = {
        startLineNumber: attribute.line,
        startColumn: attribute.startColumn,
        endColumn: attribute.endColumn,
        endLineNumber: attribute.line,
      };

      return { text, range };
    } else {
      this.createAttribute(changedAttribute, attributeList, flowUpdate);
    }
  }

  findAttribute(
    attributeList: FlowNodeAttributes,
    search: string
  ): FlowNodeAttribute | undefined {
    let attribute: FlowNodeAttribute | undefined;

    for (const [attributeKey, currentAttribute] of Object.entries(
      attributeList
    )) {
      if (attributeKey === search) {
        attribute = currentAttribute;
      }
    }

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
    attributeName: string,
    attributeList: FlowNodeAttributes,
    flowUpdate = false
  ): void {
    const attribute = this.findAttribute(attributeList, attributeName);

    if (attribute) {
      const text = ``;
      this.escapeAttribute(attribute);
      const range = this.getDeleteAttributeRange(attribute);
      this.monacoEditorComponent?.applyEdits([{ range, text }], flowUpdate);
    }
  }

  getDeleteAttributeRange(attribute: FlowNodeAttribute): monaco.IRange {
    if (attribute.onTagStartLine) {
      return this.getDeleteAttributeWithLeadingWhitespaceRange(attribute);
    } else {
      if (attribute.onLineWithOthers) {
        return attribute.indexOnLine === 0
          ? this.getDeleteAttributeWithTrailingWhitespaceRange(attribute)
          : this.getDeleteAttributeWithLeadingWhitespaceRange(attribute);
      } else {
        return this.getDeleteSingleAttributeOnLineRange(attribute);
      }
    }
  }

  getDeleteAttributeWithLeadingWhitespaceRange(
    attribute: FlowNodeAttribute
  ): monaco.IRange {
    return {
      startLineNumber: attribute.line,
      startColumn: attribute.startColumn - 1,
      endColumn: attribute.endColumn,
      endLineNumber: attribute.line,
    };
  }

  getDeleteAttributeWithTrailingWhitespaceRange(
    attribute: FlowNodeAttribute
  ): monaco.IRange {
    return {
      startLineNumber: attribute.line,
      startColumn: attribute.startColumn,
      endColumn: attribute.endColumn + 1,
      endLineNumber: attribute.line,
    };
  }

  getDeleteSingleAttributeOnLineRange(
    attribute: FlowNodeAttribute
  ): monaco.IRange {
    return {
      startLineNumber: attribute.line,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: attribute.line + 1,
    };
  }

  createAttribute(
    changedAttribute: ChangedAttribute,
    attributeList: FlowNodeAttributes,
    flowUpdate = false
  ): void {
    if (this.attributeListIsEmpty(attributeList)) {
      return;
    }
    const text = ` ${changedAttribute.name}="${this.escapeSpecialChars(
      changedAttribute.value
    )}"`;
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

  attributeListIsEmpty(attributeList: FlowNodeAttributes): boolean {
    return Object.keys(attributeList).length === 0;
  }

  findLastAttribute(
    attributeList: FlowNodeAttributes
  ): FlowNodeAttribute | undefined {
    let currentLastAttribute: FlowNodeAttribute | undefined;

    for (const [attributeKey, attribute] of Object.entries(attributeList)) {
      if (!currentLastAttribute) {
        currentLastAttribute = attribute;
      }
      if (attribute.line > currentLastAttribute.line) {
        currentLastAttribute = attribute;
      } else if (attribute.endColumn > currentLastAttribute.endColumn) {
        currentLastAttribute = attribute;
      }
    }

    return currentLastAttribute;
  }

  deleteNode(node: FlowStructureNode): void {
    const forwardsWithTarget = this.findForwardsWithTarget(node);
    const editOperations = forwardsWithTarget.map((forwards) =>
      this.getDeleteOperationForNode(forwards)
    );

    if (
      this.flowStructure.pipeline.attributes['firstPipe']?.value === node.name
    ) {
      this.removeFirstPipe(false);
    }

    node = node.parent ?? node;
    const nodeDeleteOperastion = this.getDeleteOperationForNode(node);
    editOperations.push(nodeDeleteOperastion);
    this.monacoEditorComponent?.applyEdits(editOperations, true);
  }

  findForwardsWithTarget(node: FlowStructureNode): FlowStructureNode[] {
    const forwardsWithTarget = [];
    for (const currentNode of this.flowStructure.nodes) {
      for (const forward of currentNode.forwards ?? []) {
        if (forward.attributes['path'].value === node.name) {
          forwardsWithTarget.push(forward);
        }
      }
    }
    return forwardsWithTarget;
  }

  getDeleteOperationForNode(
    node: FlowStructureNode
  ): monaco.editor.IIdentifiedSingleEditOperation {
    return {
      range: {
        startLineNumber: node.line,
        endLineNumber: node.endLine + 1,
        startColumn: 0,
        endColumn: 0,
      },
      text: '',
    };
  }
}
