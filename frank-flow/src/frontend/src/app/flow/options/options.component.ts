import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowNodeAttributeOptions } from 'src/app/shared/models/flow-node-attribute-options.model';
import { FlowNodeAttributes } from 'src/app/shared/models/flow-node-attributes.model';
import { FlowStructureNode } from 'src/app/shared/models/flow-structure-node.model';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FrankDoc } from 'src/app/shared/services/frank-doc.service';
import { Node } from '../node/nodes/node.model';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { File } from '../../shared/models/file.model';
import { ChangedAttribute } from '../../shared/models/changed-attribute.model';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent implements OnInit, OnDestroy {
  public disabledAttributes = [
    'line',
    'startColumn',
    'endColumn',
    'flow:x',
    'flow:y',
  ];
  public nonRemovableAttributes = ['name', 'path'];
  public availableAttributes: FlowNodeAttributeOptions[] = [];
  public availableNestedElements?: any[];
  public availableTypesForNestedElement?: any[];
  public attributes!: FlowNodeAttributes;
  public selectedAttribute!: any;
  public newAttributeValue!: string;
  public selectedNewNestedElement!: any;
  public selectedNewNestedElementName!: string | undefined;
  public newNestedElementName!: string;
  public frankDocElement?: any;
  public frankDocParentElements: any[] = [];
  public structureNode!: FlowStructureNode;
  public frankDocElementsURI = environment.frankDocElements;
  public selectedNestedElement!: any;
  public showNestedElements = false;

  private frankDoc: any;
  private flowNode!: Node;
  private changedAttributes: ChangedAttribute[] = [];
  private currentFile!: File;
  private frankDocSubscription!: Subscription;
  private currentFileSubscription!: Subscription;

  constructor(
    private library: FaIconLibrary,
    private ngxSmartModalService: NgxSmartModalService,
    private frankDocService: FrankDoc,
    private flowStructureService: FlowStructureService,
    private currentFileService: CurrentFileService
  ) {}

  get shownAvailableAttributes() {
    return this.availableAttributes?.filter(
      (attribute) =>
        !(this.attributeIsUsed(attribute?.name) || attribute?.deprecated)
    );
  }

  ngOnInit(): void {
    this.library.addIcons(faTrash);
    this.getFrankDoc();
    this.getCurrentFile();
  }

  ngOnDestroy(): void {
    this.frankDocSubscription.unsubscribe();
    this.currentFileSubscription.unsubscribe();
  }

  getFrankDoc(): void {
    this.frankDocSubscription = this.frankDocService
      .getFrankDoc()
      .subscribe((frankDoc: any) => (this.frankDoc = frankDoc));
  }

  getCurrentFile(): void {
    this.currentFileSubscription =
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
    this.getFrankDocElement();
    this.getFrankDocParentElements(this.frankDocElement?.fullName);
    this.getAvailableAttributesForNode();
    this.getAvailableNestedElementsForNode();
  }

  onAnyCloseEvent(): void {
    this.save();
    this.showNestedElements = false;
  }

  save() {
    this.saveAttributes();
    this.editRelatedAttributesBasedOnName();
  }

  editRelatedAttributesBasedOnName(): void {
    const changedNameAttribute = this.getChangedNameAttribute();

    if (changedNameAttribute) {
      const newName = changedNameAttribute.value.toString();

      this.editConnections(newName);
      this.editFirstPipe(newName);
      this.editFlowNode(newName);
    }
  }

  getChangedNameAttribute(): ChangedAttribute | undefined {
    return this.changedAttributes.find(
      (attribute: ChangedAttribute) =>
        attribute.name === 'name' || attribute.name === 'path'
    );
  }

  editConnections(newName: string) {
    const sourceNodes = this.getConnectionsWithTarget();
    for (const sourceNode of sourceNodes ?? []) {
      this.flowStructureService.moveConnection(
        sourceNode.uid,
        this.flowNode.getId(),
        newName
      );
    }
  }

  getConnectionsWithTarget(): FlowStructureNode[] | undefined {
    return this.currentFile.flowStructure?.nodes.filter(
      (node: FlowStructureNode) =>
        node.forwards?.find(
          (forward) =>
            forward.attributes['path'].value === this.flowNode.getName()
        )
    );
  }

  editFirstPipe(newName: string) {
    const firstPipe =
      this.currentFile.flowStructure?.pipeline.attributes['firstPipe'];

    if (firstPipe?.value === this.flowNode.getName()) {
      this.flowStructureService.changeFirstPipe(newName);
    }
  }

  editFlowNode(newName: string) {
    this.flowNode.setName(newName);
  }

  resetPreviousData() {
    this.attributes = {};
    this.changedAttributes = [];
    this.frankDocElement = '';
    this.frankDocParentElements = [];
    this.clearNewAttribute();
    this.selectedNestedElement = undefined;
    this.clearNewNestedElement();
  }

  clearNewAttribute() {
    this.selectedAttribute = undefined;
    this.newAttributeValue = '';
  }

  clearNewNestedElement() {
    this.selectedNewNestedElement = undefined;
    this.selectedNewNestedElementName = undefined;
    this.newNestedElementName = '';
  }

  getAttributesOnNode(): void {
    const node = this.currentFile.flowStructure?.nodes.find(
      (node: FlowStructureNode) => node.uid === this.flowNode?.getId()
    );

    if (node) {
      this.structureNode = node;
      this.attributes = node.attributes;
    }
  }

  getFrankDocElement() {
    this.frankDocElement = this.frankDoc.elements.find((element: any) =>
      element.elementNames.includes(this.structureNode?.type)
    );
  }

  getFrankDocParentElements(fullParentName: string | undefined) {
    const parent = this.frankDoc.elements.find(
      (element: any) => element.fullName === fullParentName
    );

    this.frankDocParentElements.push(parent);

    if (parent?.parent) {
      this.getFrankDocParentElements(parent.parent);
    }
  }

  getAvailableAttributesForNode(): void {
    this.availableAttributes = [];

    for (const attribute of this.frankDocElement?.attributes ?? []) {
      this.availableAttributes.push(attribute);
    }

    for (const parent of this.frankDocParentElements ?? []) {
      for (const attribute of parent.attributes ?? []) {
        if (!this.availableAttributes.includes(attribute)) {
          this.availableAttributes.push(attribute);
        }
      }
    }
  }

  getAvailableNestedElementsForNode(): void {
    this.showNestedElements = true;
    this.availableNestedElements = [];

    for (const child of this.frankDocElement?.children ?? []) {
      this.availableNestedElements.push(child);
    }

    for (const parent of this.frankDocParentElements ?? []) {
      for (const nestedElement of parent.children ?? []) {
        if (!this.availableNestedElements.includes(nestedElement)) {
          this.availableNestedElements.push(nestedElement);
        }
      }
    }
  }

  addAttribute(): void {
    this.save();
    // TODO: Remove timeout
    setTimeout(() => {
      this.flowStructureService.createAttribute(
        {
          name: this.selectedAttribute.name,
          value: this.newAttributeValue,
        },
        this.attributes
      );
      this.clearNewAttribute();
    }, 500);
  }

  changeAttribute(name: string, event: Event): void {
    const index = this.changedAttributes?.findIndex(
      (attribute) => attribute.name == name
    );

    const value = event as any as string | number;
    if (index === -1) {
      this.changedAttributes.push({ name, value });
    } else {
      this.changedAttributes[index] = { name, value };
    }
  }

  deleteAttribute(key: string): void {
    this.save();
    // TODO: Remove timeout
    setTimeout(() => {
      this.removeChangedAttribute(key);
      this.flowStructureService.deleteAttribute(key, this.attributes);
    }, 500);
  }

  removeChangedAttribute(key: string): void {
    const index = this.changedAttributes?.findIndex(
      (attribute) => attribute.name == key
    );
    if (index >= 0) {
      this.changedAttributes.splice(index, 1);
    }
  }

  debounce(function_: any, wait: number): any {
    let timeout: ReturnType<typeof setTimeout> | null;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(
        () => Reflect.apply(function_, this, arguments),
        wait
      );
    };
  }

  customTrackBy(index: number, object: any): any {
    return index;
  }

  attributeIsUsed(attributeName: string | undefined): boolean {
    return Object.keys(this.attributes).includes(attributeName ?? '');
  }

  deleteNode() {
    this.flowStructureService.deleteNode(this.structureNode);
    this.ngxSmartModalService.close('optionsModal');
  }

  setNestedElement(element: any): void {
    this.clearNewNestedElement();
    this.selectedNestedElement = element;
    if (element) {
      this.getAvailableTypesForNestedElement(element);
      this.checkIfOnlyOneTypeIsAvailable();
    }
  }

  getAvailableTypesForNestedElement(element: any): void {
    this.availableTypesForNestedElement = [];

    const type = this.frankDoc.types.find(
      (type: any) => type.name === element.type
    );

    for (const member of Object.values(type.members) ?? []) {
      for (const element of this.frankDoc.elements ?? []) {
        if (element.fullName === member) {
          this.availableTypesForNestedElement.push(element);
        }
      }
    }
  }

  checkIfOnlyOneTypeIsAvailable(): void {
    if (this.availableTypesForNestedElement?.length === 1) {
      this.selectedNewNestedElement = this.availableTypesForNestedElement[0];
    }
    this.checkIfOnlyOneElementNameIsAvailable();
  }

  checkIfOnlyOneElementNameIsAvailable(): void {
    this.selectedNewNestedElementName =
      this.selectedNewNestedElement?.elementNames.length === 1
        ? this.selectedNewNestedElement?.elementNames[0]
        : undefined;
  }

  nestedElementIs(element: any): boolean {
    return this.selectedNestedElement === element;
  }

  addNestedElement() {
    if (this.newNestedElementName && this.selectedNewNestedElementName) {
      this.flowStructureService.createNestedElement(
        {
          type: this.selectedNewNestedElementName,
          name: this.newNestedElementName,
        },
        this.structureNode
      );
      this.clearNewNestedElement();
    }
  }

  saveAttributes() {
    this.flowStructureService.editNodeAttributes({
      nodeId: this.flowNode.getId(),
      attributes: this.changedAttributes,
      flowUpdate: !!this.getChangedNameAttribute(),
    });
  }
}
