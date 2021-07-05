import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { FrankDocService } from 'src/app/shared/services/frank-doc.service';
import { Node } from '../node/nodes/node.model';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent {
  frankDoc: any;
  node?: Node;
  // TODO: Make types.
  attributes!: [{ [key: string]: string }];
  attributeOptions: {
    name: string;
    describer: string;
    deprecated?: boolean;
    default?: string;
  }[] = [];
  selectedAttribute!: any;
  newAttributeValue!: string;
  disabledAttributes = ['line', 'startColumn', 'endColumn', 'x', 'y'];
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
    this.getAttributesForNode();
  }

  getAttributesForNode(): void {
    const attributes = this.node?.getAttributes();

    this.nodeName = this.node?.getName();
    if (attributes) {
      this.attributes = attributes as [{ [key: string]: string }];
    }

    const nodeType = this.node?.getType();

    if (nodeType && this.frankDoc) {
      const element = this.frankDoc.elements.find(
        // TODO: + Pipe might not be needed with the frankDoc.
        (node: any) => node.name === nodeType || node.name + 'Pipe' === nodeType
      );
      this.nodeDescription = element?.descriptionHeader;
      this.attributeOptions = [];
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
      return structure.pipes[nodeName].attributes;
    } else {
      return null;
    }
  }

  changeAttribute(key: string, attribute: any): void {
    this.flowStructureService.refreshStructure();
    setTimeout(() => {
      const attributeList = this.getUpdatedAttributes();
      if (attributeList) {
        if (key === 'name') {
          this.nodeName = attribute[key];
        }
        this.flowStructureService.editAttribute(
          key,
          attribute[key],
          attributeList
        );
      }
    }, 500);
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
