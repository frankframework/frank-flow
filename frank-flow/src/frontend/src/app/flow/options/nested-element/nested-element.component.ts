import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FlowStructureNode } from '../../../shared/models/flow-structure-node.model';
import { File } from '../../../shared/models/file.model';
import { Subscription } from 'rxjs';
import { FrankDocumentService } from '../../../shared/services/frank-document.service';
import { CurrentFileService } from '../../../shared/services/current-file.service';
import { ChangedAttribute } from '../../../shared/models/changed-attribute.model';
import { FlowStructureService } from '../../../shared/services/flow-structure.service';
import { FlowNodeAttributes } from '../../../shared/models/flow-node-attributes.model';
import { FlowNodeAttributeOptions } from '../../../shared/models/flow-node-attribute-options.model';
import { environment } from '../../../../environments/environment';
import { Node } from '../../node/nodes/node.model';

@Component({
  selector: 'app-nested-element',
  templateUrl: './nested-element.component.html',
  styleUrls: ['./nested-element.component.scss'],
})
export class NestedElementComponent implements OnInit, OnDestroy {
  @Input() _element!: any | null;
  @Input() parent!: FlowStructureNode;

  @Input() set element(value: any | null) {
    this.saveChanges();
    this._element = value;
  }

  get element(): any | null {
    return this._element;
  }

  private frankDocSubscription!: Subscription;
  private currentFileSubscription!: Subscription;
  private frankDoc!: any;
  private currentFile!: File;
  private frankDocElement!: any | undefined;
  private changedAttributes: ChangedAttribute[] = [];

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
  public attributes!: FlowNodeAttributes;
  public selectedAttribute!: any;
  public newAttributeValue!: string;
  public frankDocParentElements: any[] = [];
  public structureNode!: FlowStructureNode;
  public frankDocElementsURI =
    environment.runnerUri + '/' + environment.frankDocElements;
  public selectedNestedElement!: string;

  private flowNode!: Node;

  constructor(
    private frankDocumentService: FrankDocumentService,
    private currentFileService: CurrentFileService,
    private flowStructureService: FlowStructureService
  ) {}

  ngOnInit(): void {
    this.getFrankDoc();
    this.getCurrentFile();
  }

  ngOnDestroy(): void {
    this.saveChanges();
    this.frankDocSubscription.unsubscribe();
    this.currentFileSubscription.unsubscribe();
  }

  getFrankDoc(): void {
    this.frankDocSubscription = this.frankDocumentService
      .getFrankDoc()
      .subscribe((frankDocument: any) => (this.frankDoc = frankDocument));
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

  onOpen() {
    this.getAttributesOnNode();
    this.getFrankDocElement();
    this.getFrankDocParentElements(this.frankDocElement?.fullName);
    this.getAvailableAttributesForNode();
    this.getAvailableNestedElementsForNode();
  }

  onAnyCloseEvent(): void {
    // this.flowStructureService.editAttributes({
    //   nodeId: this.flowNode.getId(),
    //   attributes: this.changedAttributes,
    //   flowUpdate: !!this.getChangedNameAttribute(),
    // });
  }

  getChangedNameAttribute(): ChangedAttribute | undefined {
    return this.changedAttributes.find(
      (attribute: ChangedAttribute) =>
        attribute.name === 'name' || attribute.name === 'path'
    );
  }

  resetPreviousData() {
    this.attributes = {};
    this.changedAttributes = [];
    this.frankDocElement = '';
    this.frankDocParentElements = [];
    this.clearNewAttribute();
  }

  clearNewAttribute() {
    this.selectedAttribute = undefined;
    this.newAttributeValue = '';
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
    this.availableNestedElements = [];

    for (const nestedElement of this.frankDocElement?.children ?? []) {
      this.availableNestedElements.push(nestedElement);
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
    this.flowStructureService.createAttribute(
      {
        name: this.selectedAttribute.name,
        value: this.newAttributeValue,
      },
      this.attributes
    );
    this.clearNewAttribute();
  }

  changeAttribute(name: string, event: Event): void {
    const index = this.changedAttributes?.findIndex(
      (attribute) => attribute.name == name
    );

    const value = event as any as string | number;
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
    // TODO: lala
  }

  saveChanges(): void {
    console.log('save ' + this.element);
  }
}
