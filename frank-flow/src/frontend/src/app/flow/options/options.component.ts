import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowNodeAttribute } from 'src/app/shared/models/flowNodeAttribute.model';
import { FlowNodeAttributeOptions } from 'src/app/shared/models/flowNodeAttributeOptions.model';
import { FlowNodeAttributes } from 'src/app/shared/models/flowNodeAttributes.model';
import { FlowStructureNode } from 'src/app/shared/models/flowStructureNode.model';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FrankDocService } from 'src/app/shared/services/frank-doc.service';
import { Node } from '../node/nodes/node.model';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent {
  disabledAttributes = ['line', 'startColumn', 'endColumn', 'x', 'y'];
  frankDoc: any;
  node?: Node;
  attributes!: FlowNodeAttributes;
  attributeOptions: FlowNodeAttributeOptions[] = [];
  selectedAttribute!: any;
  newAttributeValue!: string;
  nodeName!: string | undefined;
  nodeDescription?: string;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private frankDocService: FrankDocService,
    private flowStructureService: FlowStructureService
  ) {
    this.getFrankDoc();
  }

  getFrankDoc(): void {
    this.frankDocService
      .getFrankDoc()
      .subscribe((frankDoc: any) => (this.frankDoc = frankDoc));
  }

  onDataAdded(): void {
    this.node = this.ngxSmartModalService.getModalData('optionsModal');
    this.resetPreviousData();
    this.getAttributesForNode();
  }

  reloadAttributes() {
    this.flowStructureService.refreshStructure();
    setTimeout(() => {
      this.attributes = this.getUpdatedAttributes().attributes;
    }, 100);
  }

  resetPreviousData() {
    this.attributes = {};
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
      element?.attributes?.forEach((attribute: any) => {
        this.attributeOptions.push(attribute);
      });
    }
  }

  getUpdatedAttributes(): any {
    const nodeType = this.node?.getType();
    const nodeName = this.nodeName;

    const structure = this.flowStructureService.getStructure();

    if (nodeType?.match(/Pipe/) && nodeName) {
      return structure.pipes.find(
        (pipe: FlowStructureNode) => pipe.name === nodeName
      );
    } else {
      return null;
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

    this.reloadAttributes();
  }

  changeAttribute(key: string, attribute: any): void {
    this.flowStructureService.refreshStructure();
    setTimeout(() => {
      const attributeList = this.getUpdatedAttributes();
      if (attributeList) {
        if (key === 'name') {
          this.nodeName = attribute.value.value;
        }
        this.flowStructureService.editAttribute(
          key,
          attribute.value.value,
          attributeList.attributes
        );
      }
    });
  }

  deleteAttribute(key: string): void {
    this.flowStructureService.refreshStructure();
    setTimeout(() => {
      const attributeList = this.getUpdatedAttributes();
      if (attributeList) {
        this.flowStructureService.deleteAttribute(
          key,
          attributeList.attributes
        );
      }
      this.reloadAttributes();
    });
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
}
