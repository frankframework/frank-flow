/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />

import { Injectable } from '@angular/core';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';
import { FlowNodeAttributes } from '../models/flow-node-attributes.model';
import Listener from '../../flow/node/nodes/receiver.model';
import Pipe from '../../flow/node/nodes/pipe.model';
import { CurrentFileService } from './current-file.service';
import { File } from '../models/file.model';
import { FlowStructure } from '../models/flow-structure.model';
import { ChangedAttribute } from '../models/changed-attribute.model';
import { PanZoomService } from './pan-zoom.service';
import Sender from '../../flow/node/nodes/sender.model';
import { SettingsService } from '../../header/settings/settings.service';
import { Settings } from '../../header/settings/settings.model';
import { LayoutService } from './layout.service';
import { Node } from '../../flow/node/nodes/node.model';
import { NgxSmartModalService } from 'ngx-smart-modal';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  public monacoEditorComponent?: MonacoEditorComponent;
  public selectedNode?: FlowStructureNode;
  public settings!: Settings;

  private currentFile!: File;
  private flowStructure!: FlowStructure;
  private waitingOnNewStructure = false;
  private editAttributeQueue: Map<string, ChangedAttribute[]> = new Map();
  private flowUpdate!: boolean;
  private nodeMap: Map<string, Node> | undefined;

  constructor(
    private currentFileService: CurrentFileService,
    private panZoomService: PanZoomService,
    private settingsService: SettingsService,
    private graphService: LayoutService,
    private ngxSmartModalService: NgxSmartModalService
  ) {
    this.getCurrentFile();
    this.subscribeToSettings();
    this.subscribeToNodesMap();
  }

  subscribeToSettings(): void {
    this.settingsService.settingsObservable.subscribe(
      (settings) => (this.settings = settings)
    );
  }

  subscribeToNodesMap(): void {
    this.graphService.nodesObservable.subscribe({
      next: (nodeMap) => {
        this.nodeMap = nodeMap;
      },
    });
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
    if (this.settings.automaticPan) {
      this.panToNode();
    }
  }

  isNodeAtPosition(
    node: FlowStructureNode,
    position: monaco.Position
  ): boolean {
    return (
      node.line <= position.lineNumber && node.endLine >= position.lineNumber
    );
  }

  panToNode(): void {
    if (this.selectedNode) {
      const x = +this.selectedNode.positions.x;
      const y = +this.selectedNode.positions.y;
      if (x && y) {
        this.panZoomService.panTo(x, y);
      } else {
        const node = this.nodeMap?.get(this.selectedNode.uid);
        if (node) {
          const nodeLeft = node.getLeft();
          const nodeTop = node.getTop();

          if (nodeLeft && nodeTop) this.panZoomService.panTo(nodeLeft, nodeTop);
        }
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

  createForwardName(sourceId: string, targetId: string) {
    const sourceNode = this.getSourceNode(sourceId);
    if (!sourceNode) {
      return;
    }

    if (this.hasSuccessForward(sourceNode)) {
      this.ngxSmartModalService.getModal('createForward').setData(
        {
          node: sourceNode,
          targetId: targetId,
          actionFunction: this.addConnectionFunction,
        },
        true
      );
    } else {
      this.addConnection(sourceNode, targetId, 'success');
    }
  }

  hasSuccessForward(sourceNode: FlowStructureNode) {
    return sourceNode.forwards?.some((forward) => forward.name === 'success');
  }

  addConnectionFunction = (
    sourceNode: FlowStructureNode,
    targetId: string,
    forwardName: string
  ): void => {
    this.addConnection(sourceNode, targetId, forwardName);
  };

  addConnection(
    sourceNode: FlowStructureNode,
    targetId: string,
    forwardName: string
  ): void {
    const target = this.flowStructure.nodes.find(
      (node) => node.uid == targetId
    );

    let endLine = sourceNode.endLine ?? 0;
    endLine += sourceNode.isSelfClosing ? 1 : 0;

    const text = `\t\t\t\t<Forward name="${forwardName}" path="${
      target?.name ?? 'READY'
    }" />\n`;
    const range = {
      startLineNumber: endLine,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: endLine,
    };

    if (sourceNode.isSelfClosing) {
      this.addNestedElementToSelfClosingElement(sourceNode, { text, range });
    } else if (this.isElementOnSingleLine(sourceNode)) {
      this.addNestedElementToSingleLineElement(sourceNode, { text, range });
    } else {
      this.monacoEditorComponent?.applyEdits([{ range, text }], true);
    }

    if (targetId === 'implicitExit') {
      const exit = new Exit({ id: 'Exit', name: 'READY', type: 'Exit' });
      this.addExit(exit);
    }
  }

  isElementOnSingleLine(node: FlowStructureNode): boolean {
    return node.endLine === node.line;
  }

  addNestedElementToSelfClosingElement(
    node: FlowStructureNode,
    editOperation: monaco.editor.ISingleEditOperation
  ): void {
    this.monacoEditorComponent?.applyEdits(
      [
        this.getClosingBracketEditOperation(node),
        editOperation,
        this.getClosingTagEditOperation(node),
      ],
      true
    );
  }

  getSourceNode(sourceId: string): FlowStructureNode | undefined {
    return this.flowStructure.pipes.find(
      (pipe: FlowStructureNode) => pipe.uid === sourceId
    );
  }

  getClosingBracketEditOperation(
    sourceNode: FlowStructureNode
  ): monaco.editor.ISingleEditOperation {
    const text = `>`;
    let column = sourceNode.column - 2;
    if (this.hasSpaceBeforeClosingBracket(sourceNode)) {
      column -= 1;
    }
    const range = {
      startLineNumber: sourceNode.endLine,
      startColumn: column,
      endColumn: sourceNode.column,
      endLineNumber: sourceNode.endLine,
    };

    return { range, text };
  }

  hasSpaceBeforeClosingBracket(sourceNode: FlowStructureNode): boolean {
    const lastAttribute = this.findLastAttribute(sourceNode.attributes);
    return (
      sourceNode.column - (lastAttribute?.endColumn ?? 0) >= 3 &&
      lastAttribute?.line === sourceNode.endLine
    );
  }

  getClosingTagEditOperation(
    sourceNode: FlowStructureNode
  ): monaco.editor.ISingleEditOperation {
    const text = `\t\t\t</${sourceNode.type}>\n`;
    const range = {
      startLineNumber: sourceNode.endLine + 1,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: sourceNode.endLine + 1,
    };

    return { range, text };
  }

  addNestedElementToSingleLineElement(
    node: FlowStructureNode,
    editOperation: monaco.editor.ISingleEditOperation
  ): void {
    const text = `\n${editOperation.text}\t\t\t`;
    const range = {
      startLineNumber: node.line,
      startColumn: node.column,
      endLineNumber: node.line,
      endColumn: node.column,
    };
    this.monacoEditorComponent?.applyEdits([{ range, text }], true);
  }

  deleteConnection(sourceId: string, targetId: string): void {
    const targetForward = this.getTargetForward(sourceId, targetId);

    const text = '';
    const range = {
      startLineNumber: targetForward.line,
      startColumn: 0,
      endColumn: 0,
      endLineNumber: targetForward.line + 1,
    };

    this.monacoEditorComponent?.applyEdits([{ range, text }], true);
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
      this.editSingleAttribute(firstPipeAttribute, pipeline.attributes);
    }
  }

  editSingleAttribute(
    changedAttribute: ChangedAttribute,
    attributeList: FlowNodeAttributes,
    flowUpdate = true
  ): void {
    const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    const editAttributeOperation = this.editAttribute(
      changedAttribute,
      attributeList
    );
    if (editAttributeOperation) {
      editOperations.push(editAttributeOperation);
    }
    this.monacoEditorComponent?.applyEdits(editOperations, flowUpdate);
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

    const text = `\t\t\t<${pipeData.getType()} name="${pipeName}" />\n`;
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

  addExit(exit: Exit): void {
    const exitName = this.getUniqueExitPath(exit.getName());
    let text = `\t\t\t\t<${exit.getType()} path="${exitName}" state="success" ${this.addXAndYIfPresent(
      exit
    )}/>\n`;

    const exitsTag = this.getExitsTag();
    if (exitsTag) {
      const range = {
        startLineNumber: exitsTag.endLine,
        endLineNumber: exitsTag.endLine,
        startColumn: 0,
        endColumn: 0,
      };
      this.monacoEditorComponent?.applyEdits([{ range, text }], true);
    } else {
      this.createExitsTagWithExit(text);
    }
  }

  getUniqueExitPath(name: string): string {
    return this.getUniqueNodeName(this.flowStructure.exits, name);
  }

  addXAndYIfPresent(exit: Exit) {
    return exit.getLeft() && exit.getTop()
      ? `flow:y="${exit.getTop()}" flow:x="${exit.getLeft()}" `
      : '';
  }

  getExitsTag(): FlowStructureNode | undefined {
    return this.flowStructure.nodes.find((node: FlowStructureNode) =>
      node.uid.startsWith('Exits(Exits)')
    );
  }

  createExitsTagWithExit(currentExitText: string): void {
    const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    const text = `\t\t\t<Exits>\n${this.getAllExistingExitTexts()}${currentExitText}\t\t\t</Exits>\n`;
    const range = {
      startLineNumber: this.flowStructure.pipeline.line + 1,
      endLineNumber: this.flowStructure.pipeline.line + 1,
      startColumn: 0,
      endColumn: 0,
    };
    for (const exit of this.flowStructure.exits) {
      const nodeDeleteOperation = this.getDeleteOperationForNode(exit);
      editOperations.push(nodeDeleteOperation);
    }
    editOperations.push({ range, text });
    this.monacoEditorComponent?.applyEdits(editOperations, true);
  }

  getAllExistingExitTexts() {
    const text = this.flowStructure.exits
      .map((exit: FlowStructureNode) => this.getNodeText(exit))
      .join('\n');
    return text ? text + '\n' : text;
  }

  getNodeText(node: FlowStructureNode): string | undefined {
    const range = {
      startLineNumber: node.line,
      startColumn: 0,
      endColumn: node.column,
      endLineNumber: node.endLine,
    };

    return this.monacoEditorComponent?.getTextInRange(range);
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
    this.editNodeAttributes({
      nodeId: options.nodeId,
      attributes: [
        { name: 'flow:y', value: options.yPos },
        { name: 'flow:x', value: options.xPos },
      ],
      flowUpdate: false,
    });
  }

  setFlowSetting(
    name: string,
    value: string | number,
    flowUpdate = true
  ): void {
    const configuration = this.flowStructure.configuration;
    if (configuration) {
      const flowSetting = { name, value };

      if (this.attributeListIsEmpty(configuration.attributes)) {
        this.createFirstAttribute(flowSetting, configuration);
      } else {
        this.editSingleAttribute(
          flowSetting,
          configuration.attributes,
          flowUpdate
        );
      }
    }
  }

  deleteFlowSetting(deleteFlowSetting: string) {
    if (this.flowStructure.configuration == undefined) {
      return;
    }
    const configurationAttributes = this.flowStructure.configuration.attributes;

    this.deleteAttribute(deleteFlowSetting, configurationAttributes, true);
  }

  deleteFlowSettings() {
    const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];

    this.addConfigurationEditOperation(editOperations);
    this.addFlowEditOperation(editOperations);

    this.monacoEditorComponent?.applyEdits(editOperations, true);
  }

  addConfigurationEditOperation(
    editOperations: monaco.editor.IIdentifiedSingleEditOperation[]
  ): void {
    const configuration = this.flowStructure.configuration;
    if (configuration) {
      const configurationAttributes = configuration.attributes;
      const deleteFlowSettingsList = [
        'flow:direction',
        'flow:forwardStyle',
        'flow:gridSize',
        'xmlns:flow',
      ];
      const configurationEditOperations =
        this.getEditOperationsDeleteAttributes(
          deleteFlowSettingsList,
          configurationAttributes
        );

      editOperations.push(...configurationEditOperations);
    }
  }

  addFlowEditOperation(
    editOperations: monaco.editor.IIdentifiedSingleEditOperation[]
  ): void {
    const deleteFlowPositionsList = ['flow:y', 'flow:x'];
    for (const node of this.flowStructure.nodes) {
      const nodeAttributes = node.attributes;
      const flowEditOperations = this.getEditOperationsDeleteAttributes(
        deleteFlowPositionsList,
        nodeAttributes
      );
      editOperations.push(...flowEditOperations);
    }
  }

  getEditOperationsDeleteAttributes(
    attributeNames: string[],
    attributeList: FlowNodeAttributes
  ): monaco.editor.IIdentifiedSingleEditOperation[] {
    const ranges: monaco.editor.IIdentifiedSingleEditOperation[][] = [];

    this.calculateAttributeRanges(attributeNames, attributeList, ranges);

    return this.generateEditOperations(ranges, attributeNames);
  }

  calculateAttributeRanges(
    attributeNames: string[],
    attributeList: FlowNodeAttributes,
    ranges: monaco.editor.IIdentifiedSingleEditOperation[][]
  ): void {
    for (const attributeName of attributeNames) {
      const attribute = this.findAttribute(attributeList, attributeName);
      if (attribute) {
        const text = ``;
        this.escapeAttribute(attribute);
        const range = this.getDeleteAttributeRange(attribute);
        ranges[attribute.line] = ranges[attribute.line] ?? [];
        ranges[attribute.line][attribute.startColumn] = { text, range };
      }
    }
  }

  generateEditOperations(
    ranges: monaco.editor.IIdentifiedSingleEditOperation[][],
    attributeNames: string[]
  ): monaco.editor.IIdentifiedSingleEditOperation[] {
    const editOperations: any[] = [];
    for (const [line, columns] of Object.entries(ranges)) {
      for (const column of Object.values(columns)) {
        const lastEditOperation = editOperations[editOperations.length - 1];
        if (
          lastEditOperation &&
          lastEditOperation.range &&
          this.isSameLineAndConnected(lastEditOperation, +line, column.range)
        ) {
          lastEditOperation.range.endColumn = column.range.endColumn;
          continue;
        }
        editOperations.push({
          range: column.range,
          text: column.text,
        });
      }
    }
    return editOperations;
  }

  isSameLineAndConnected(
    lastEditOperation: any,
    line: number,
    range: any
  ): boolean {
    return (
      lastEditOperation.range.startLineNumber === line &&
      range.startColumn <= lastEditOperation.range.endColumn
    );
  }

  editNodeAttributes(options: {
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
      this.monacoEditorComponent?.applyEdits(
        editOperations ?? [],
        this.flowUpdate
      );
    }
  }

  canApplyEditAttributes(): boolean {
    return !this.waitingOnNewStructure && this.editAttributeQueue.size > 0;
  }

  getEditOperationsForChangedAttributes():
    | monaco.editor.IIdentifiedSingleEditOperation[]
    | void {
    const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    for (const [nodeId, editAttributes] of this.editAttributeQueue.entries()) {
      const node = this.currentFile.flowStructure?.nodes.find(
        (node: FlowStructureNode) => node.uid === nodeId
      );

      if (node) {
        for (const attribute of editAttributes) {
          const editOperation = this.editAttribute(attribute, node.attributes);

          if (editOperation) {
            editOperations.push(editOperation);
          }
        }
      }
    }
    this.editAttributeQueue.clear();
    return editOperations;
  }

  editAttribute(
    changedAttribute: ChangedAttribute,
    attributeList: FlowNodeAttributes
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
      return this.createAttributeEditOperation(changedAttribute, attributeList);
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
  ): monaco.editor.IIdentifiedSingleEditOperation | void {
    const editOperation = this.createAttributeEditOperation(
      changedAttribute,
      attributeList
    );

    if (editOperation) {
      this.monacoEditorComponent?.applyEdits([editOperation], flowUpdate);
    }
  }

  createAttributeEditOperation(
    changedAttribute: ChangedAttribute,
    attributeList: FlowNodeAttributes
  ): monaco.editor.IIdentifiedSingleEditOperation | void {
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
      return { range, text };
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

  deleteNode(node: FlowStructureNode, nestedElement = false): void {
    let editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    if (!nestedElement) {
      const forwardsWithTarget = this.findForwardsWithTarget(node);
      editOperations = forwardsWithTarget.map((forwards) =>
        this.getDeleteOperationForNode(forwards)
      );

      if (
        this.flowStructure.pipeline.attributes['firstPipe']?.value === node.name
      ) {
        this.removeFirstPipe(false);
      }
    }

    const nodeDeleteOperation = this.getDeleteOperationForNode(node);
    editOperations.push(nodeDeleteOperation);
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

  createNestedElement(
    parameter: { type: string; name: string },
    parent: FlowStructureNode
  ): void {
    const lastNestedElement = this.findLastNestedElement(parent);
    let text = `\t\t\t\t<${parameter.type} name="${parameter.name}" />\n`;

    let endLine = parent.endLine ?? 0;
    endLine += parent.isSelfClosing ? 1 : 0;

    const range = lastNestedElement
      ? {
          startLineNumber: lastNestedElement.endLine + 1,
          endLineNumber: lastNestedElement.endLine + 1,
          startColumn: 0,
          endColumn: 0,
        }
      : {
          startLineNumber: endLine,
          endLineNumber: endLine,
          startColumn: 0,
          endColumn: 0,
        };

    if (parent.isSelfClosing) {
      this.addNestedElementToSelfClosingElement(parent, { text, range });
    } else if (this.isElementOnSingleLine(parent)) {
      this.addNestedElementToSingleLineElement(parent, { text, range });
    } else {
      this.monacoEditorComponent?.applyEdits([{ range, text }], true);
    }
  }

  findLastNestedElement(
    parent: FlowStructureNode
  ): FlowStructureNode | undefined {
    let currentLastNestedElement: FlowStructureNode | undefined;

    for (const [category, nodes] of Object.entries(parent.nestedElements)) {
      const lastNode = nodes[nodes.length - 1];
      if (!currentLastNestedElement) {
        currentLastNestedElement = lastNode;
      }
      if (lastNode.endLine > currentLastNestedElement.endLine) {
        currentLastNestedElement = lastNode;
      }
    }

    return currentLastNestedElement;
  }

  addDefaultExit(x: number = 700, y: number = 100): void {
    const exit = new Exit({
      id: 'Exit',
      name: 'READY',
      type: 'Exit',
      top: y,
      left: x,
    });
    this.addExit(exit);
  }
}
