import { Component } from '@angular/core';
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

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent {
  disabledAttributes = ['line', 'startColumn', 'endColumn', 'x', 'y'];
  frankDoc: any;
  attributeOptions: FlowNodeAttributeOptions[] = [];
  node!: Node;
  attributes!: FlowNodeAttributes;
  changedAttributes: { attribute: string; value: string | number }[] = [];
  selectedAttribute!: any;
  newAttributeValue!: string;
  nodeName!: string | undefined;
  nodeDescription?: string;
  private currentFileSubscription!: Subscription;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private frankDocService: FrankDocService,
    private flowStructureService: FlowStructureService,
    private currentFileService: CurrentFileService
  ) {
    this.getFrankDoc();
  }

  getFrankDoc(): void {
    this.frankDocService
      .getFrankDoc()
      .subscribe((frankDoc: any) => (this.frankDoc = frankDoc));
  }

  getCurrentFile(): void {
    this.currentFileSubscription = this.currentFileService.currentFileObservable.subscribe(
      {
        next: (currentFile: File) => {
          const node = currentFile.flowStructure?.nodes.find(
            (pipe: FlowStructureNode) => pipe.name === this.nodeName
          );

          if (node) {
            this.node;
            this.attributes = node.attributes;
            console.log(this.attributes);
          }
        },
      }
    );
  }

  onDataAdded(): void {
    // TODO: Doesnt get the newest node, use the node from local structure observed in this class.
    this.node = this.ngxSmartModalService.getModalData('optionsModal');
    this.getCurrentFile();
    this.resetPreviousData();
    this.getAttributesForNode();
  }

  onAnyCloseEvent(): void {
    this.currentFileSubscription.unsubscribe();
    this.flowStructureService.editAttributes(
      'nodes',
      this.node.getId(),
      this.changedAttributes
    );
  }

  // reloadAttributes() {
  //   // TODO: this.flowStructureService.refreshStructure();
  //   setTimeout(() => {
  //     this.attributes = this.getUpdatedAttributes().attributes;
  //   }, 100);
  // }

  resetPreviousData() {
    this.attributes = {};
    this.changedAttributes = [];
    this.attributeOptions = [];
    this.nodeName = '';
    this.nodeDescription = '';
    this.clearNewAttribute();
  }

  clearNewAttribute() {
    this.selectedAttribute = undefined;
    this.newAttributeValue = '';
  }

  getAttributesForNode(): void {
    const attributes = this.node?.getAttributes();

    this.nodeName = this.node?.getName();
    if (attributes) {
      this.attributes = attributes;
    }

    const nodeType = this.node?.getType();

    if (nodeType && this.frankDoc) {
      const element = this.frankDoc.elements.find((node: any) =>
        node.elementNames.includes(nodeType)
      );
      this.nodeDescription = element?.descriptionHeader;
      element?.attributes?.forEach((attribute: any) =>
        this.attributeOptions.push(attribute)
      );
    }
  }

  addAttribute(): void {
    this.flowStructureService.createAttribute(
      this.selectedAttribute.name,
      this.newAttributeValue,
      this.attributes,
      false
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
