import { Injectable } from '@angular/core';
import { MonacoEditorComponent } from 'src/app/editor/monaco-editor/monaco-editor.component';
import Exit from 'src/app/flow/node/nodes/exit.model';
import { Subject, Subscription } from 'rxjs';
import { FlowStructureNode } from '../models/flow-structure-node.model';
import { FlowNodeAttribute } from '../models/flow-node-attribute.model';
import { FlowNodeAttributes } from '../models/flow-node-attributes.model';
import { FlowGenerationData } from '../models/flow-generation-data.model';
import Listener from '../../flow/node/nodes/listener.model';
import Pipe from '../../flow/node/nodes/pipe.model';

@Injectable({
  providedIn: 'root',
})
export class FlowStructureService {
  structure: any = {};
  structureSubject: Subject<any> = new Subject<any>();
  errorSubject: Subject<string[]> = new Subject<string[]>();
  positionsUpdate = false;

  flowGenerator?: Worker;
  monacoEditorComponent?: MonacoEditorComponent;
  structureSubscription?: Subscription;

  errorObservable = () => this.errorSubject.asObservable();

  constructor() {
    this.initializeWorker();
  }

  initializeWorker(): void {
    if (Worker) {
      this.flowGenerator = new Worker(
        new URL('../../shared/workers/flow-generator.worker', import.meta.url),
        {
          name: 'flow-generator',
          type: 'module',
        }
      );

      this.flowGenerator.onmessage = ({ data }) => {
        if (data) {
          if (!this.parsingErrorsFound(data)) {
            this.structure = data.structure;
            this.structureSubject.next(data.structure);
          }
        }
      };
    }
  }

  parsingErrorsFound(data: FlowGenerationData): boolean {
    return data.errors.length > 0;
  }

  updateStructure(): void {
    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );
  }

  setStructure(structure: any): void {
    this.structureSubject.next(structure);
    this.structure = structure;
  }

  getStructure(): any {
    return this.structure;
  }

  refreshStructure(): void {
    this.flowGenerator?.postMessage(
      this.monacoEditorComponent?.codeEditorInstance.getValue()
    );
  }

  setEditorComponent(monacoEditorComponent: MonacoEditorComponent): void {
    this.monacoEditorComponent = monacoEditorComponent;
  }

  addConnection(sourceName: string, targetName: string): void {
    this.positionsUpdate = true;
    const pipes = this.structure.pipes;
    const newForward =
      '\n\t\t\t\t<Forward name="success" path="' + targetName + '" />';
    let lastForward;
    const currentPipe = pipes.find(
      (pipe: FlowStructureNode) => pipe.attributes['name'].value === sourceName
    );
    const forwards = currentPipe.forwards;
    if (forwards) {
      lastForward = forwards[forwards.length - 1];
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
            startLineNumber: currentPipe.line,
            startColumn: currentPipe.column,
            endColumn: currentPipe.column,
            endLineNumber: currentPipe.line,
          },
          newForward,
          false
        );
      }
    }
  }

  deleteConnection(sourceName: string, targetName: string): void {
    const sourcePipe = this.structure.pipes.find(
      (pipe: FlowStructureNode) => pipe.name === sourceName
    );
    const targetForward = sourcePipe.forwards.find(
      (forward: FlowStructureNode) =>
        forward.attributes['path'].value === targetName
    );

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

  addPipe(pipeData: Pipe): void {
    const pipes = this.structure.pipes;
    const lastPipe = pipes[pipes.length - 1] ?? this.structure.pipeline;
    const line =
      (pipes[pipes.length - 1] ? lastPipe.endLine : lastPipe.line) + 1;
    const pipeName = this.getUniquePipeName(pipeData.getName());

    const pipeTemplate = `\t\t\t<${pipeData.getType()} name="${pipeName}">\n\t\t\t</${pipeData.getType()}>\n`;

    this.monacoEditorComponent?.applyEdit(
      {
        startLineNumber: line,
        startColumn: lastPipe.startColumn,
        endColumn: lastPipe.endColumn,
        endLineNumber: line,
      },
      pipeTemplate,
      false
    );
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

    const listenerTemplate = `\t\t<Receiver name="${listenerName}">
        \t<${pipeData.getType()} name="${listenerName}" />
        </Receiver>\n`;

    this.monacoEditorComponent?.applyEdit(
      {
        startLineNumber: lastReceiver.endLine + 1,
        startColumn: lastReceiver.startColumn,
        endColumn: lastReceiver.endColumn,
        endLineNumber: lastReceiver.endLine + 1,
      },
      listenerTemplate,
      false
    );
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

    const exitTemplate = `\t\t\t<${exitData.getType()} path="${exitName}" />\n`;

    this.monacoEditorComponent?.applyEdit(
      {
        startLineNumber: lastExit.line + 1,
        startColumn: lastExit.startColumn,
        endColumn: lastExit.endColumn,
        endLineNumber: lastExit.line + 1,
      },
      exitTemplate,
      false
    );
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
    this.editAttributes(structureNodes, nodeId, [
      { attribute: 'x', value: xPos },
      { attribute: 'y', value: yPos },
    ]);
  }

  editAttributes(
    structureNodes: string,
    nodeId: string,
    attributes: { attribute: string; value: string | number }[]
  ): void {
    this.structureSubscription?.unsubscribe();
    const currentAttribute = attributes.pop();
    if (currentAttribute) {
      if (attributes) {
        this.structureSubscription = this.structureSubject
          .asObservable()
          .subscribe({
            next: (data) => {
              this.structure = data;
              this.editAttributes(structureNodes, nodeId, attributes);
            },
          });
      }
      const node = this.structure[structureNodes]?.find(
        (node: any) => node.name === nodeId
      );
      if (node) {
        this.editAttribute(
          currentAttribute.attribute,
          currentAttribute.value,
          node.attributes,
          attributes.length !== 0
        );
        this.updateStructure();
      }
    }
  }

  editAttribute(
    key: string,
    value: any,
    attributeList: FlowNodeAttributes,
    flowUpdate = false
  ): void {
    const attribute = this.findAttribute(attributeList, key);

    if (attribute) {
      const escapedValue = this.escapeSpecialChars(value);
      const valueTemplate = `${key}="${escapedValue}"`;
      this.escapeAttribute(attribute);

      this.monacoEditorComponent?.applyEdit(
        {
          startLineNumber: attribute.line,
          startColumn: attribute.startColumn,
          endColumn: attribute.endColumn,
          endLineNumber: attribute.line,
        },
        valueTemplate,
        flowUpdate
      );
    } else {
      this.createAttribute(key, value, attributeList, flowUpdate);
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
      const newValue = ``;
      this.escapeAttribute(attribute);

      this.monacoEditorComponent?.applyEdit(
        {
          startLineNumber: attribute.line,
          startColumn: attribute.startColumn,
          endColumn: attribute.endColumn,
          endLineNumber: attribute.line,
        },
        newValue,
        flowUpdate
      );
    }
  }

  createAttribute(
    key: string,
    value: any,
    attributeList: FlowNodeAttributes,
    flowUpdate: boolean
  ): void {
    if (Object.entries(attributeList).length === 0) {
      return;
    }

    const newValue = ` ${key}="${this.escapeSpecialChars(value)}"`;
    const lastAttribute = this.findLastAttribute(attributeList);

    if (lastAttribute) {
      this.monacoEditorComponent?.applyEdit(
        {
          startLineNumber: lastAttribute.line,
          endLineNumber: lastAttribute.line,
          startColumn: lastAttribute.endColumn,
          endColumn: lastAttribute.endColumn,
        },
        newValue,
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
