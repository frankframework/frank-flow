import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent implements OnInit, OnDestroy {
  public disabledAttributes = ['line', 'startColumn', 'endColumn', 'x', 'y'];
  public availableAttributes: FlowNodeAttributeOptions[] = [];
  public attributes!: FlowNodeAttributes;
  public selectedAttribute!: any;
  public newAttributeValue!: string;
  public element?: any;
  public structureNode!: FlowStructureNode;
  public frankDocElementsURI =
    environment.runnerUri + '/' + environment.frankDocElements;

  private frankDoc: any;
  private flowNode!: Node;
  private changedAttributes: ChangedAttribute[] = [];
  private currentFile!: File;
  private frankDocSubscription!: Subscription;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private frankDocumentService: FrankDocService,
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
      .subscribe((frankDocument: any) => (this.frankDoc = frankDocument));
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
    this.editRelatedAttributesBasedOnName();
    this.flowStructureService.editAttributes({
      nodeId: this.flowNode.getId(),
      attributes: this.changedAttributes,
      flowUpdate: !!this.getChangedNameAttribute(),
    });
  }

  editRelatedAttributesBasedOnName(): void {
    const changedNameAttribute = this.getChangedNameAttribute();

    if (changedNameAttribute) {
      const originalName = this.flowNode.getName();
      const newName = changedNameAttribute.value.toString();

      this.editConnections(originalName, newName);
      this.editFirstPipe(originalName, newName);
    }
  }

  getChangedNameAttribute(): ChangedAttribute | undefined {
    return this.changedAttributes.find(
      (attribute: ChangedAttribute) =>
        attribute.name === 'name' || attribute.name === 'path'
    );
  }

  editConnections(originalName: string, newName: string) {
    const sourceNodes = this.getConnectionsWithTarget(originalName);
    sourceNodes?.forEach((sourceNode) => {
      this.flowStructureService.moveConnection(
        sourceNode.name,
        originalName,
        newName
      );
    });
  }

  getConnectionsWithTarget(target: string): FlowStructureNode[] | undefined {
    return this.currentFile.flowStructure?.nodes.filter(
      (node: FlowStructureNode) =>
        node.forwards?.find(
          (forward) => forward.attributes['path'].value === target
        )
    );
  }

  editFirstPipe(originalName: string, newName: string) {
    const firstPipe =
      this.currentFile.flowStructure?.pipeline.attributes['firstPipe'];

    if (firstPipe?.value === originalName) {
      this.flowStructureService.changeFirstPipe(newName);
    }
  }

  resetPreviousData() {
    this.attributes = {};
    this.changedAttributes = [];
    this.element = '';
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

    if (this.areTypeAndFrankDocSet()) {
      this.element = this.frankDoc.elements.find((element: any) =>
        element.elementNames.includes(this.structureNode?.type)
      );
      this.element?.attributes?.forEach((attribute: any) =>
        this.availableAttributes.push(attribute)
      );
    }
  }

  areTypeAndFrankDocSet(): boolean {
    return this.structureNode?.type && this.frankDoc;
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
}
