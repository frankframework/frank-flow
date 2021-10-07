import { Component, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowNodeAttribute } from 'src/app/shared/models/flow-node-attribute.model';
import { FlowNodeAttributeOptions } from 'src/app/shared/models/flow-node-attribute-options.model';
import { FlowNodeAttributes } from 'src/app/shared/models/flow-node-attributes.model';
import { FlowStructureNode } from 'src/app/shared/models/flow-structure-node.model';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FrankDocService } from 'src/app/shared/services/frank-doc.service';
import { Node } from '../node/nodes/node.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { File } from '../../shared/models/file.model';
import { FlowStructure } from '../../shared/models/flow-structure.model';
import { PaletteComponent } from '../palette/palette.component';
import { Subscription } from 'rxjs';
import { OptionsChangedAttribute } from './options-changed-attribute.model';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent implements OnInit {
  disabledAttributes = ['line', 'startColumn', 'endColumn', 'x', 'y'];
  frankDoc: any;
  availableAttributes: FlowNodeAttributeOptions[] = [];
  flowNode!: Node;
  attributes!: FlowNodeAttributes;
  changedAttributes: OptionsChangedAttribute[] = [];
  selectedAttribute!: any;
  newAttributeValue!: string;
  nodeName!: string | undefined;
  nodeDescription?: string;
  private currentFile!: File;
  structureNode!: FlowStructureNode;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private frankDocService: FrankDocService,
    private flowStructureService: FlowStructureService,
    private currentFileService: CurrentFileService
  ) {}

  ngOnInit(): void {
    this.getFrankDoc();
    this.getCurrentFile();
  }

  getFrankDoc(): void {
    this.frankDocService
      .getFrankDoc()
      .subscribe((frankDoc: any) => (this.frankDoc = frankDoc));
  }

  getCurrentFile(): void {
    this.currentFileService.currentFileObservable.subscribe({
      next: (currentFile: File) => {
        this.currentFile = currentFile;
        this.getAttributesOnNode();
      },
    });
  }

  onDataAdded(): void {
    this.flowNode = this.ngxSmartModalService.getModalData('optionsModal');
    this.resetPreviousData();
  }

  onOpen() {
    this.getAttributesOnNode();
    this.getAvailableAttributesForNode();
  }

  onAnyCloseEvent(): void {
    this.flowStructureService.editAttributes(
      'nodes',
      this.flowNode.getId(),
      this.changedAttributes,
      this.changedAttributesHasNodeName()
    );
  }

  changedAttributesHasNodeName(): boolean {
    return !!this.changedAttributes.find(
      (attribute: OptionsChangedAttribute) =>
        attribute.attribute === 'name' || attribute.attribute === 'path'
    );
  }

  resetPreviousData() {
    this.attributes = {};
    this.changedAttributes = [];
    this.nodeDescription = '';
    this.clearNewAttribute();
  }

  clearNewAttribute() {
    this.selectedAttribute = undefined;
    this.newAttributeValue = '';
  }

  getAttributesOnNode(): void {
    const node = this.currentFile.flowStructure?.nodes.find(
      (node: FlowStructureNode) => node.name === this.flowNode?.getName()
    );

    if (node) {
      this.structureNode = node;
      this.attributes = node.attributes;
    }
  }

  getAvailableAttributesForNode(): void {
    this.availableAttributes = [];

    if (this.structureNode?.type && this.frankDoc) {
      const element = this.frankDoc.elements.find((element: any) =>
        element.elementNames.includes(this.structureNode?.type)
      );
      this.nodeDescription = element?.description;
      element?.attributes?.forEach((attribute: any) =>
        this.availableAttributes.push(attribute)
      );
    }
  }

  addAttribute(): void {
    this.flowStructureService.createAttribute(
      this.selectedAttribute.name,
      this.newAttributeValue,
      this.attributes
    );
    this.clearNewAttribute();
  }

  changeAttribute(key: string, event: Event): void {
    const index = this.changedAttributes?.findIndex(
      (attribute) => attribute.attribute == key
    );

    if (index !== -1) {
      this.changedAttributes[index] = { attribute: key, value: event as any };
    } else {
      this.changedAttributes.push({ attribute: key, value: event as any });
    }
  }

  deleteAttribute(key: string): void {
    setTimeout(() => {
      this.removeChangedAttribute(key);
      this.flowStructureService.deleteAttribute(key, this.attributes);
    });
  }

  removeChangedAttribute(key: string): void {
    const index = this.changedAttributes?.findIndex(
      (attribute) => attribute.attribute == key
    );
    this.changedAttributes.splice(index);
  }

  debounce(func: any, wait: number): any {
    let timeout: ReturnType<typeof setTimeout> | null;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
  }

  customTrackBy(index: number, obj: any): any {
    return index;
  }

  attributeIsUsed(attributeName: string | undefined): boolean {
    return Object.keys(this.attributes).includes(attributeName ?? '');
  }
}
