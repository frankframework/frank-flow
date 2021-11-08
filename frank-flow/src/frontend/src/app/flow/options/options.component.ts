import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowNodeAttributeOptions } from 'src/app/shared/models/flow-node-attribute-options.model';
import { FlowNodeAttributes } from 'src/app/shared/models/flow-node-attributes.model';
import { FlowStructureNode } from 'src/app/shared/models/flow-structure-node.model';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FrankDocService } from 'src/app/shared/services/frank-doc.service';
import { Node } from '../node/nodes/node.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { File } from '../../shared/models/file.model';
import { ChangedAttribute } from '../../shared/models/changed-attribute.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent implements OnInit, OnDestroy {
  disabledAttributes = ['line', 'startColumn', 'endColumn', 'x', 'y'];
  frankDoc: any;
  availableAttributes: FlowNodeAttributeOptions[] = [];
  flowNode!: Node;
  attributes!: FlowNodeAttributes;
  changedAttributes: ChangedAttribute[] = [];
  selectedAttribute!: any;
  newAttributeValue!: string;
  nodeName!: string | undefined;
  nodeDescription?: string;
  private currentFile!: File;
  structureNode!: FlowStructureNode;
  frankDocSubscription!: Subscription;

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

  ngOnDestroy(): void {
    this.frankDocSubscription.unsubscribe();
  }

  getFrankDoc(): void {
    this.frankDocSubscription = this.frankDocService
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
      this.flowNode.getId(),
      this.changedAttributes,
      this.changedAttributesHasNodeName()
    );
  }

  changedAttributesHasNodeName(): boolean {
    return !!this.changedAttributes.find(
      (attribute: ChangedAttribute) =>
        attribute.name === 'name' || attribute.name === 'path'
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

  changeAttribute(name: string, event: Event): void {
    const index = this.changedAttributes?.findIndex(
      (attribute) => attribute.name == name
    );

    const value = (event as any) as string | number;
    if (index !== -1) {
      this.changedAttributes[index] = { name, value };
    } else {
      this.changedAttributes.push({ name, value });
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
      (attribute) => attribute.name == key
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
